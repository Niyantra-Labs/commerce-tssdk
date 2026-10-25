import {
  CommerceAbortError,
  CommerceApiError,
  CommerceNetworkError,
  CommerceProtocolError,
  CommerceTimeoutError,
  CommerceValidationError,
} from './errors.js';

export type Authentication =
  | { apiKey: string; bearerToken?: never }
  | { apiKey?: never; bearerToken: string | (() => string | Promise<string>) };

export interface ClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  /** Optional per-client request budget. */
  rateLimit?: { requestsPerSecond: number; burst?: number };
  /** All credentials are intended for trusted runtimes. */
  auth: Authentication;
}

export interface RequestOptions {
  signal?: AbortSignal;
  requestId?: string;
  timeoutMs?: number;
}

export type ResponseKind = 'data' | 'list' | 'raw' | 'none';
export interface RequestSpec {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Exact JSON bytes, for requests whose signature covers the body. */
  serializedBody?: string;
  kind?: ResponseKind;
  unauthenticated?: boolean;
  unprefixed?: boolean;
  headers?: Readonly<Record<string, string>>;
  retryable?: boolean;
  acceptedStatuses?: readonly number[];
}

const MAX_JSON_BYTES = 8 * 1024 * 1024;
const MAX_ERROR_BYTES = 4096;

function parseJsonLosslessly(text: string): unknown {
  const tokens = /"(?:\\.|[^"\\])*"|(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  for (const match of text.matchAll(tokens)) {
    if (match[1] !== undefined) {
      const value = Number(match[1]);
      if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
        throw new CommerceProtocolError('Response contains an unsafe JSON number');
      }
    }
  }
  return JSON.parse(text) as unknown;
}

export function pathSegment(value: string): string {
  if (!value || value === '.' || value === '..')
    throw new CommerceValidationError('Invalid path ID');
  return encodeURIComponent(value);
}

function assertSafeNumbers(value: unknown, seen = new WeakSet<object>()): void {
  if (
    typeof value === 'number' &&
    (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))
  ) {
    throw new CommerceValidationError('Request contains a non-finite or unsafe integer');
  }
  if (typeof value === 'bigint')
    throw new CommerceValidationError('BigInt has no JSON wire format');
  if (value instanceof Date && Number.isNaN(value.getTime()))
    throw new CommerceValidationError('Invalid date');
  if (typeof value !== 'object' || value === null || value instanceof Date) return;
  if (seen.has(value)) throw new CommerceValidationError('Cyclic request body');
  seen.add(value);
  for (const child of Object.values(value)) assertSafeNumbers(child, seen);
  seen.delete(value);
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Math.min(Number(value) * 1000, 30000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.min(date - Date.now(), 30000));
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal.reason);
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const length = response.headers.get('content-length');
  if (length && Number(length) > maxBytes)
    throw new CommerceProtocolError('Response exceeds size limit');
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > maxBytes) throw new CommerceProtocolError('Response exceeds size limit');
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** Shared cross-runtime Commerce HTTP transport. */
export class Transport {
  private readonly base: URL;
  private readonly fetcher: typeof fetch;
  private readonly auth: Authentication;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly rateLimit?: { intervalMs: number; burst: number; nextAvailable: number[] };

  constructor(options: ClientOptions) {
    if (!options || !options.auth) throw new CommerceValidationError('Authentication is required');
    const auth = options.auth;
    if (
      'apiKey' in auth === 'bearerToken' in auth ||
      ('apiKey' in auth && !auth.apiKey) ||
      ('bearerToken' in auth && !auth.bearerToken)
    ) {
      throw new CommerceValidationError('Choose one non-empty authentication mode');
    }
    const base = new URL(options.baseUrl ?? 'http://localhost:9094');
    if (
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      !['http:', 'https:'].includes(base.protocol)
    ) {
      throw new CommerceValidationError('Invalid base URL');
    }
    if (base.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
      throw new CommerceValidationError('Remote base URL must use HTTPS');
    }
    if (/\/api\/v1\/?$/.test(base.pathname))
      throw new CommerceValidationError('Base URL must exclude /api/v1');
    this.base = base;
    this.fetcher = options.fetch ?? globalThis.fetch;
    if (!this.fetcher) throw new CommerceValidationError('fetch is unavailable');
    this.auth = auth;
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.maxRetries = options.maxRetries ?? 2;
    if (options.rateLimit) {
      const { requestsPerSecond, burst = 1 } = options.rateLimit;
      if (
        !Number.isFinite(requestsPerSecond) ||
        requestsPerSecond <= 0 ||
        !Number.isSafeInteger(burst) ||
        burst < 1
      )
        throw new CommerceValidationError('Invalid rate limit');
      this.rateLimit = { intervalMs: 1000 / requestsPerSecond, burst, nextAvailable: [] };
    }
    if (
      !Number.isFinite(this.timeoutMs) ||
      this.timeoutMs <= 0 ||
      !Number.isInteger(this.maxRetries) ||
      this.maxRetries < 0 ||
      this.maxRetries > 10
    ) {
      throw new CommerceValidationError('Invalid timeout or retry count');
    }
  }

  get apiKey(): string | undefined {
    return 'apiKey' in this.auth ? this.auth.apiKey : undefined;
  }

  async request<T>(spec: RequestSpec, options: RequestOptions = {}): Promise<T> {
    const path = `${this.base.pathname.replace(/\/$/, '')}${spec.unprefixed ? '' : '/api/v1'}${spec.path}`;
    if (
      !spec.path.startsWith('/') ||
      spec.path.includes('?') ||
      spec.path.includes('#') ||
      spec.path.split('/').includes('..')
    ) {
      throw new CommerceValidationError('Invalid request path');
    }
    const url = new URL(this.base.origin + path);
    for (const [key, value] of Object.entries(spec.query ?? {})) {
      if (value === null)
        throw new CommerceValidationError(`Query parameter ${key} cannot be null`);
      if (
        typeof value === 'number' &&
        (!Number.isSafeInteger(value) ||
          (key === 'limit' && value < 1) ||
          (key === 'offset' && value < 0))
      ) {
        throw new CommerceValidationError(`Invalid query parameter ${key}`);
      }
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    let body: string | undefined = spec.serializedBody;
    if (body === undefined && spec.body !== undefined) {
      assertSafeNumbers(spec.body);
      body = JSON.stringify(spec.body);
    }
    const headers = new Headers({ Accept: 'application/json' });
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    if (options.requestId) headers.set('X-Request-ID', options.requestId);
    if (!spec.unauthenticated) {
      if ('apiKey' in this.auth) headers.set('X-API-Key', this.auth.apiKey!);
      else {
        const token =
          typeof this.auth.bearerToken === 'function'
            ? await this.auth.bearerToken()
            : this.auth.bearerToken;
        if (!token) throw new CommerceValidationError('Bearer token is empty');
        headers.set('Authorization', `Bearer ${token}`);
      }
    }
    for (const [key, value] of Object.entries(spec.headers ?? {})) {
      if (/^(authorization|x-api-key|host|content-type)$/i.test(key))
        throw new CommerceValidationError('Protected header override');
      headers.set(key, value);
    }
    const timeout = options.timeoutMs ?? this.timeoutMs;
    if (!Number.isFinite(timeout) || timeout <= 0)
      throw new CommerceValidationError('Invalid timeout');
    const controller = new AbortController();
    const onAbort = () => controller.abort(new CommerceAbortError('Request cancelled'));
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
    const timer = setTimeout(
      () => controller.abort(new CommerceTimeoutError('Request timed out')),
      timeout,
    );
    const retryable = spec.retryable ?? spec.method === 'GET';
    try {
      for (let attempt = 0; ; attempt++) {
        if (controller.signal.aborted) throw controller.signal.reason;
        if (this.rateLimit) {
          const state = this.rateLimit;
          const now = Date.now();
          while (state.nextAvailable.length && state.nextAvailable[0]! <= now)
            state.nextAvailable.shift();
          const previous = state.nextAvailable.at(-1) ?? now;
          const start = state.nextAvailable.length < state.burst ? now : Math.max(now, previous);
          state.nextAvailable.push(start + state.intervalMs);
          if (start > now) await wait(start - now, controller.signal);
        }
        let response: Response;
        try {
          response = await this.fetcher(url, {
            method: spec.method,
            headers,
            body: body ?? null,
            signal: controller.signal,
            redirect: 'manual',
          });
        } catch (cause) {
          if (controller.signal.aborted) throw controller.signal.reason;
          if (retryable && attempt < this.maxRetries) {
            await wait(Math.random() * Math.min(500 * 2 ** attempt, 5000), controller.signal);
            continue;
          }
          throw new CommerceNetworkError('Network request failed', { cause });
        }
        if (
          retryable &&
          attempt < this.maxRetries &&
          [429, 502, 503, 504].includes(response.status)
        ) {
          const delay =
            parseRetryAfter(response.headers.get('retry-after')) ??
            Math.random() * Math.min(500 * 2 ** attempt, 5000);
          await response.body?.cancel();
          await wait(delay, controller.signal);
          continue;
        }
        if (!response.ok && !spec.acceptedStatuses?.includes(response.status)) {
          let parsed: unknown;
          try {
            parsed = parseJsonLosslessly(await readLimited(response, MAX_ERROR_BYTES));
          } catch {
            parsed = undefined;
          }
          const envelope =
            parsed && typeof parsed === 'object'
              ? (parsed as Record<string, unknown>).error
              : undefined;
          const api =
            envelope && typeof envelope === 'object'
              ? (envelope as Record<string, unknown>)
              : undefined;
          throw new CommerceApiError(
            response.status,
            typeof api?.code === 'string' ? api.code : `http_${response.status}`,
            typeof api?.message === 'string' ? api.message : `HTTP ${response.status}`,
            response.headers.get('x-request-id') ?? undefined,
            api?.details,
          );
        }
        if (spec.kind === 'none') {
          await response.body?.cancel();
          return undefined as T;
        }
        if (spec.kind === 'raw') return response as T;
        if (!response.headers.get('content-type')?.includes('json'))
          throw new CommerceProtocolError('Expected JSON response');
        let parsed: unknown;
        try {
          parsed = parseJsonLosslessly(await readLimited(response, MAX_JSON_BYTES));
        } catch (cause) {
          throw new CommerceProtocolError('Invalid JSON response', { cause });
        }
        if (spec.kind === 'data' || spec.kind === 'list') {
          if (!parsed || typeof parsed !== 'object' || !('data' in parsed))
            throw new CommerceProtocolError('Missing data envelope');
          if (spec.kind === 'data') return (parsed as { data: T }).data;
          const value = parsed as { data: unknown; total?: unknown };
          if (!Array.isArray(value.data) || typeof value.total !== 'number')
            throw new CommerceProtocolError('Invalid list envelope');
        }
        return parsed as T;
      }
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }
}
