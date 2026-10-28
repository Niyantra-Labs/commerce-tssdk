import {
  CommerceAbortError,
  CommerceApiError,
  CommerceLocalRateLimitError,
  CommerceNetworkError,
  CommerceProtocolError,
  CommerceRateLimitError,
  CommerceTimeoutError,
  CommerceValidationError,
} from './errors.js';
import { protectSecretView, redactedView, SDK_VERSION, SECRET_FIELD } from './utils.js';

/** Metadata supplied to opt-in hooks. Dynamic path segments and query values are omitted. */
export interface RequestHookEvent {
  readonly method: RequestSpec['method'];
  readonly path: string;
  readonly attempt: number;
  readonly durationMs: number;
  readonly requestId?: string;
}

/** HTTP response metadata, emitted once per received response, including retried responses. */
export interface ResponseHookEvent extends RequestHookEvent {
  readonly status: number;
}

/** Retry metadata, emitted before the cancellable backoff. */
export interface RetryHookEvent extends RequestHookEvent {
  readonly reason: string;
  readonly delayMs: number;
}

export interface TransportHooks {
  onRequest?: (event: Readonly<RequestHookEvent>) => void | Promise<void>;
  onResponse?: (event: Readonly<ResponseHookEvent>) => void | Promise<void>;
  onRetry?: (event: Readonly<RetryHookEvent>) => void | Promise<void>;
}

/** Optional diagnostic sink. The SDK passes only redacted, frozen metadata. */
export interface CommerceLogger {
  debug(
    message: string,
    event: Readonly<RequestHookEvent | ResponseHookEvent | RetryHookEvent>,
  ): void;
  info(
    message: string,
    event: Readonly<RequestHookEvent | ResponseHookEvent | RetryHookEvent>,
  ): void;
  warn(
    message: string,
    event: Readonly<RequestHookEvent | ResponseHookEvent | RetryHookEvent>,
  ): void;
  error(
    message: string,
    event: Readonly<RequestHookEvent | ResponseHookEvent | RetryHookEvent>,
  ): void;
}

/** Middleware sees only a collection path and method; request bytes stay private. */
export interface MiddlewareRequest {
  readonly method: RequestSpec['method'];
  readonly path: string;
}

export type TransportMiddleware = (
  request: Readonly<MiddlewareRequest>,
  next: (request: Readonly<MiddlewareRequest>) => Promise<unknown>,
) => Promise<unknown>;

/** Injectable time source for deterministic client rate-limit tests. */
export interface RateLimitClock {
  now(): number;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
}

function emitHook<T>(
  hook: ((event: Readonly<T>) => void | Promise<void>) | undefined,
  event: T,
): void {
  if (!hook) return;
  try {
    const result = hook(Object.freeze(event));
    if (result) Promise.resolve(result).catch(() => undefined);
  } catch {
    // Instrumentation must never change request behavior.
  }
}

function sdkRuntime(): 'node' | 'bun' | 'deno' | 'workerd' | undefined {
  const globals = globalThis as unknown as Record<string, unknown>;
  if (globals.window !== undefined && globals.document !== undefined) return undefined;
  if (globals.Bun !== undefined) return 'bun';
  if (globals.Deno !== undefined) return 'deno';
  if (globals.WebSocketPair !== undefined) return 'workerd';
  const processValue = globals.process as { versions?: { node?: string } } | undefined;
  if (processValue?.versions?.node) return 'node';
  return undefined;
}

/** Exactly one credential: an API key (server-side only) or a bearer token, optionally a function returning a fresh token per request. */
export type Authentication =
  | { apiKey: string; bearerToken?: never }
  | { apiKey?: never; bearerToken: string | (() => string | Promise<string>) };

/** Options for `new Client()`. @example `new Client({ auth: { apiKey }, debug: true, logger })` */
export interface ClientOptions {
  /** Server origin, optionally with a base path. HTTPS is required except for localhost. */
  baseUrl?: string;
  /** fetch implementation to use (defaults to the global fetch). */
  fetch?: typeof fetch;
  /** Per-request timeout in milliseconds (response headers for streamed downloads). */
  timeoutMs?: number;
  /** Retries for GET requests on 429/502/503/504 and network failures. Mutations are never retried. */
  maxRetries?: number;
  /** Also retry other HTTP 5xx responses for safe GETs. Default false. */
  retryOther5xx?: boolean;
  /** Exponential backoff multiplier for safe GET retries (default 2). */
  backoffMultiplier?: number;
  /** Backoff jitter for safe GET retries (default full). Retry-After is always respected. */
  jitter?: 'full' | 'equal' | 'none';
  /** Optional per-client request budget. */
  rateLimit?: {
    requestsPerSecond: number;
    burst?: number;
    /** Maximum waiting requests; default 1000. Zero disables waiting. */
    maxQueue?: number;
    clock?: RateLimitClock;
  };
  /** Synchronous, best-effort metadata hooks. Keep callbacks fast; returned promises are not awaited. */
  hooks?: TransportHooks;
  /** Emit redacted attempt events to logger.debug when true. Default false. */
  debug?: boolean;
  /** Logging sink; defaults to a no-op. It never receives headers, bodies, or credentials. */
  logger?: CommerceLogger;
  /** All credentials are intended for trusted runtimes. */
  auth: Authentication;
}

/** Per-call options accepted as the last argument of every method. @example `client.products.list(undefined, { signal, requestId })` */
export interface RequestOptions {
  /** Cancels the request, any retry backoff, and a streamed body while it is read. */
  signal?: AbortSignal;
  /** Sent as `X-Request-ID` for correlating server logs. */
  requestId?: string;
  /** Overrides the client timeout for this call. */
  timeoutMs?: number;
  /** Additional per-call headers. Auth, signature, routing, and content headers are protected. */
  headers?: Readonly<Record<string, string>>;
}

/** How a response body is decoded: `data` unwraps `{ data }`, `list` validates `{ data, total }`, `raw` returns the `Response`, `none` discards the body; omitted returns the JSON as-is. */
export type ResponseKind = 'data' | 'list' | 'raw' | 'none';
/** A low-level request description for `Transport.request` (advanced use). */
export interface RequestSpec {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Exact JSON bytes, for requests whose signature covers the body. */
  serializedBody?: string;
  /** Multipart body; fetch sets the boundary in Content-Type. Never retried. */
  formData?: FormData;
  kind?: ResponseKind;
  unauthenticated?: boolean;
  unprefixed?: boolean;
  headers?: Readonly<Record<string, string>>;
  /** Can disable GET retries. Mutations are never retried, even when true. */
  retryable?: boolean;
  acceptedStatuses?: readonly number[];
}

/**
 * Release a response body we will not read. Not awaited: some fetch
 * implementations (test doubles, wrappers) never settle cancel(), and the
 * caller must not wait on it.
 */
function discardBody(response: Response): void {
  response.body?.cancel().catch(() => undefined);
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

/** Percent-encode one dynamic path segment so IDs cannot inject `/`, `?`, or `#`. */
export function pathSegment(value: string): string {
  if (!value || value === '.' || value === '..')
    throw new CommerceValidationError('Invalid path ID');
  return encodeURIComponent(value);
}

function assertSafeNumbers(value: unknown, seen = new WeakSet()): void {
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

function signalError(signal: AbortSignal): Error {
  return signal.reason instanceof Error
    ? signal.reason
    : new CommerceAbortError('Request cancelled');
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signalError(signal));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signalError(signal));
    }
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function withAbort<T>(value: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signalError(signal));
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(signalError(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    value.then(
      (result) => {
        signal.removeEventListener('abort', onAbort);
        resolve(result);
      },
      (cause: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(
          cause instanceof Error ? cause : new CommerceValidationError('Async operation failed'),
        );
      },
    );
  });
}

/** Whether an error's message, stack, or nested cause text contains secret. */
function mentions(error: unknown, secret: string | undefined): boolean {
  if (!secret) return false;
  for (let e: unknown = error, depth = 0; e != null && depth < 5; depth++) {
    const text =
      e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : typeof e === 'string' ? e : '';
    if (text.includes(secret)) return true;
    e = e instanceof Error ? e.cause : undefined;
  }
  return false;
}

function gatherSecrets(value: unknown, secrets: Set<string>, sensitive = false): void {
  if (typeof value === 'string') {
    if (sensitive && value) secrets.add(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) gatherSecrets(item, secrets, sensitive);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value))
    gatherSecrets(item, secrets, sensitive || SECRET_FIELD.test(key));
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const length = response.headers.get('content-length');
  if (length && Number(length) > maxBytes) {
    discardBody(response);
    throw new CommerceProtocolError('Response exceeds size limit');
  }
  const reader = response.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      size += result.value.byteLength;
      if (size > maxBytes) {
        reader.cancel().catch(() => undefined);
        throw new CommerceProtocolError('Response exceeds size limit');
      }
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
  private readonly retryOther5xx: boolean;
  private readonly backoffMultiplier: number;
  private readonly jitter: 'full' | 'equal' | 'none';
  private readonly hooks: TransportHooks | undefined;
  private readonly debug: boolean;
  private readonly logger: CommerceLogger | undefined;
  private readonly middleware: TransportMiddleware[] = [];
  private readonly rateLimit?: {
    intervalMs: number;
    burst: number;
    maxQueue: number;
    tokens: number;
    lastRefill: number;
    clock: RateLimitClock;
    tail: Promise<void>;
    queued: number;
  };

  constructor(options: ClientOptions) {
    if (!(options as ClientOptions | null | undefined)?.auth)
      throw new CommerceValidationError('Authentication is required');
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
    const fetcher = options.fetch ?? (globalThis as { fetch?: typeof fetch }).fetch;
    if (!fetcher) throw new CommerceValidationError('fetch is unavailable');
    // Never call fetch as a method of another object: browsers throw
    // "Illegal invocation" when window.fetch runs with a foreign `this`.
    this.fetcher = (input, init) => fetcher(input, init);
    this.auth = auth;
    Object.defineProperty(this, 'auth', { enumerable: false });
    this.timeoutMs = options.timeoutMs ?? 30000;
    this.maxRetries = options.maxRetries ?? 2;
    this.retryOther5xx = options.retryOther5xx ?? false;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
    this.jitter = options.jitter ?? 'full';
    this.hooks = options.hooks;
    this.debug = options.debug ?? false;
    this.logger = options.logger;
    if (options.rateLimit) {
      const {
        requestsPerSecond,
        burst = 1,
        maxQueue = 1000,
        clock = { now: Date.now, sleep: wait },
      } = options.rateLimit;
      if (
        !Number.isFinite(requestsPerSecond) ||
        requestsPerSecond <= 0 ||
        !Number.isFinite(1000 / requestsPerSecond) ||
        !Number.isSafeInteger(burst) ||
        burst < 1 ||
        !Number.isSafeInteger(maxQueue) ||
        maxQueue < 0 ||
        maxQueue > 100000
      )
        throw new CommerceValidationError('Invalid rate limit');
      this.rateLimit = {
        intervalMs: 1000 / requestsPerSecond,
        burst,
        maxQueue,
        tokens: burst,
        lastRefill: clock.now(),
        clock,
        tail: Promise.resolve(),
        queued: 0,
      };
    }
    if (
      !Number.isFinite(this.timeoutMs) ||
      this.timeoutMs <= 0 ||
      !Number.isInteger(this.maxRetries) ||
      this.maxRetries < 0 ||
      this.maxRetries > 10 ||
      typeof this.retryOther5xx !== 'boolean' ||
      !Number.isFinite(this.backoffMultiplier) ||
      this.backoffMultiplier < 1 ||
      this.backoffMultiplier > 10 ||
      !['full', 'equal', 'none'].includes(this.jitter)
    ) {
      throw new CommerceValidationError('Invalid timeout or retry count');
    }
  }

  get apiKey(): string | undefined {
    return 'apiKey' in this.auth ? this.auth.apiKey : undefined;
  }

  /** Register metadata-only middleware; call before issuing requests. */
  use(middleware: TransportMiddleware): this {
    this.middleware.push(middleware);
    return this;
  }

  private emitDiagnostic(
    name: 'request' | 'response' | 'retry',
    event: RequestHookEvent | ResponseHookEvent | RetryHookEvent,
  ): void {
    const frozen = Object.freeze(event);
    if (name === 'request') emitHook(this.hooks?.onRequest, frozen as RequestHookEvent);
    if (name === 'response') emitHook(this.hooks?.onResponse, frozen as ResponseHookEvent);
    if (name === 'retry') emitHook(this.hooks?.onRetry, frozen as RetryHookEvent);
    if (this.debug && this.logger) {
      try {
        this.logger.debug(`commerce.${name}`, frozen);
      } catch {
        // Diagnostics never affect the HTTP request.
      }
    }
  }

  private retryDelay(attempt: number): number {
    const cap = Math.min(500 * this.backoffMultiplier ** attempt, 5000);
    if (this.jitter === 'none') return cap;
    if (this.jitter === 'equal') return cap / 2 + (Math.random() * cap) / 2;
    return Math.random() * cap;
  }

  private acquireRateToken(signal: AbortSignal): Promise<void> | undefined {
    const state = this.rateLimit;
    if (!state) return;
    const refill = () => {
      const now = state.clock.now();
      state.tokens = Math.min(
        state.burst,
        state.tokens + Math.max(0, now - state.lastRefill) / state.intervalMs,
      );
      state.lastRefill = now;
    };
    if (state.queued === 0) {
      refill();
      if (state.tokens >= 1) {
        state.tokens -= 1;
        return;
      }
    }
    if (state.queued >= state.maxQueue)
      throw new CommerceLocalRateLimitError('Local rate-limit queue is full');
    const previous = state.tail;
    let release!: () => void;
    state.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    state.queued++;
    return (async () => {
      try {
        await withAbort(previous, signal);
        for (;;) {
          refill();
          if (state.tokens >= 1) {
            state.tokens -= 1;
            return;
          }
          await state.clock.sleep(Math.ceil((1 - state.tokens) * state.intervalMs), signal);
        }
      } finally {
        // An aborted queued request cannot let a later request pass the
        // active holder. Its turn is released only after the prior turn.
        void previous.then(
          () => {
            state.queued--;
            release();
          },
          () => {
            state.queued--;
            release();
          },
        );
      }
    })();
  }

  /** Send one request through the shared pipeline (auth, retries, timeout, decoding). */
  async request<T>(spec: RequestSpec, options: RequestOptions = {}): Promise<T> {
    if (
      !spec.path.startsWith('/') ||
      spec.path.includes('?') ||
      spec.path.includes('#') ||
      spec.path.split('/').includes('..')
    )
      throw new CommerceValidationError('Invalid request path');
    if (this.middleware.length === 0) return this.execute<T>(spec, options);
    const request = Object.freeze({
      method: spec.method,
      path: `${spec.unprefixed ? '' : '/api/v1'}/${spec.path.split('/')[1] ?? ''}`,
    });
    const chain = [...this.middleware];
    const dispatch = (index: number): Promise<unknown> => {
      if (index === chain.length) return this.execute<T>(spec, options);
      const middleware = chain[index];
      if (!middleware) return this.execute<T>(spec, options);
      let called = false;
      return Promise.resolve(
        middleware(request, (forwarded) => {
          if (forwarded !== request || called)
            throw new CommerceValidationError('Middleware must forward the original request once');
          called = true;
          return dispatch(index + 1);
        }),
      );
    };
    return dispatch(0) as Promise<T>;
  }

  private async execute<T>(spec: RequestSpec, options: RequestOptions): Promise<T> {
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
      if ((value as unknown) === null)
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
    let body: string | FormData | undefined = spec.formData ?? spec.serializedBody;
    if (spec.formData && (spec.serializedBody !== undefined || spec.body !== undefined))
      throw new CommerceValidationError('A request has either a JSON or a multipart body');
    if (body === undefined && spec.body !== undefined) {
      assertSafeNumbers(spec.body);
      body = JSON.stringify(spec.body);
    }
    const secretValues = new Set<string>();
    gatherSecrets(spec.body, secretValues);
    gatherSecrets(spec.query, secretValues);
    for (const value of Object.values(spec.headers ?? {})) if (value) secretValues.add(value);
    for (const value of Object.values(options.headers ?? {})) if (value) secretValues.add(value);
    if (spec.serializedBody) {
      try {
        gatherSecrets(JSON.parse(spec.serializedBody), secretValues);
      } catch {
        // Exact signed bytes are opaque to the transport.
      }
    }
    for (const [key, value] of spec.formData ?? [])
      if (typeof value === 'string') gatherSecrets(value, secretValues, SECRET_FIELD.test(key));
    const timeout = options.timeoutMs ?? this.timeoutMs;
    if (!Number.isFinite(timeout) || timeout <= 0)
      throw new CommerceValidationError('Invalid timeout');
    const controller = new AbortController();
    const onAbort = () => {
      controller.abort(new CommerceAbortError('Request cancelled'));
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
    const timer = setTimeout(() => {
      controller.abort(new CommerceTimeoutError('Request timed out'));
    }, timeout);
    const retryable = !spec.formData && spec.method === 'GET' && spec.retryable !== false;
    // Only the collection segment is exposed; later segments may be IDs,
    // license keys, or download tokens. Never expose query values.
    const hookPath = `${spec.unprefixed ? '' : '/api/v1'}/${spec.path.split('/')[1] ?? ''}`;
    const hookBase = (attempt: number, started: number, credential?: string) => ({
      method: spec.method,
      path: hookPath,
      attempt,
      durationMs: Math.max(0, Date.now() - started),
      ...(options.requestId &&
      options.requestId !== credential &&
      !secretValues.has(options.requestId)
        ? { requestId: options.requestId }
        : {}),
    });
    // A raw (streamed) response outlives this call: keep honouring the
    // caller's signal while the body is read. The timeout covers headers only.
    let streaming = false;
    try {
      const headers = new Headers({ Accept: 'application/json' });
      const setHeader = (name: string, value: string) => {
        try {
          headers.set(name, value);
        } catch {
          throw new CommerceValidationError('Invalid request header');
        }
      };
      const runtime = sdkRuntime();
      if (runtime) setHeader('User-Agent', `niyantra-commerce-ts/${SDK_VERSION} (${runtime})`);
      let credential: string | undefined;
      if (typeof body === 'string') setHeader('Content-Type', 'application/json');
      if (options.requestId) setHeader('X-Request-ID', options.requestId);
      if (!spec.unauthenticated) {
        if ('apiKey' in this.auth) {
          credential = this.auth.apiKey;
          if (!credential) throw new CommerceValidationError('API key is empty');
          setHeader('X-API-Key', credential);
        } else {
          controller.signal.throwIfAborted();
          const bearer = this.auth.bearerToken;
          const token =
            typeof bearer === 'function'
              ? await withAbort(Promise.resolve().then(bearer), controller.signal)
              : bearer;
          if (!token) throw new CommerceValidationError('Bearer token is empty');
          credential = token;
          setHeader('Authorization', `Bearer ${token}`);
        }
      }
      if (credential) secretValues.add(credential);
      const secrets = [...secretValues];
      for (const [key, value] of Object.entries(spec.headers ?? {})) {
        if (/^(authorization|x-api-key|host|content-type|user-agent)$/i.test(key))
          throw new CommerceValidationError('Protected header override');
        setHeader(key, value);
      }
      for (const [key, value] of Object.entries(options.headers ?? {})) {
        if (
          /^(authorization|x-api-key|host|content-type|user-agent|cookie|x-request-id|x-org-id|idempotency-key|x-usage-|x-niyantra-)/i.test(
            key,
          )
        )
          throw new CommerceValidationError('Protected header override');
        setHeader(key, value);
      }
      for (let attempt = 0; ; attempt++) {
        const started = Date.now();
        if (controller.signal.aborted) throw controller.signal.reason;
        const rateWait = this.acquireRateToken(controller.signal);
        if (rateWait) await rateWait;
        let response: Response;
        try {
          this.emitDiagnostic('request', hookBase(attempt + 1, started, credential));
          response = await this.fetcher(url, {
            method: spec.method,
            headers,
            body: body ?? null,
            signal: controller.signal,
            redirect: 'manual',
          });
        } catch (cause) {
          controller.signal.throwIfAborted();
          if (retryable && attempt < this.maxRetries) {
            const delay = this.retryDelay(attempt);
            this.emitDiagnostic('retry', {
              ...hookBase(attempt + 1, started, credential),
              reason: 'network',
              delayMs: delay,
            });
            await wait(delay, controller.signal);
            continue;
          }
          // Keep the fetch error for diagnosis (DNS, refused connection, TLS)
          // unless it could echo the credential, as a custom fetch might.
          throw new CommerceNetworkError('Network request failed', {
            cause: secrets.some((secret) => mentions(cause, secret))
              ? new Error('Fetch failed')
              : cause,
          });
        }
        const responseId = response.headers.get('x-request-id');
        this.emitDiagnostic('response', {
          ...hookBase(attempt + 1, started, credential),
          status: response.status,
          ...(responseId && responseId !== credential && !secretValues.has(responseId)
            ? { requestId: responseId }
            : {}),
        });
        if (
          retryable &&
          attempt < this.maxRetries &&
          ([429, 502, 503, 504].includes(response.status) ||
            (this.retryOther5xx && response.status >= 500 && response.status <= 599))
        ) {
          const delay =
            parseRetryAfter(response.headers.get('retry-after')) ?? this.retryDelay(attempt);
          discardBody(response);
          this.emitDiagnostic('retry', {
            ...hookBase(attempt + 1, started, credential),
            reason: `http_${String(response.status)}`,
            delayMs: delay,
          });
          await wait(delay, controller.signal);
          continue;
        }
        if (response.status >= 300 && response.status < 400) {
          discardBody(response);
          throw new CommerceProtocolError('Unexpected redirect response');
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
          const ApiError = response.status === 429 ? CommerceRateLimitError : CommerceApiError;
          throw new ApiError(
            response.status,
            typeof api?.code === 'string'
              ? (redactedView(api.code, secrets) as string)
              : `http_${String(response.status)}`,
            typeof api?.message === 'string'
              ? (redactedView(api.message, secrets) as string)
              : `HTTP ${String(response.status)}`,
            (redactedView(response.headers.get('x-request-id'), secrets) as string | null) ??
              undefined,
            redactedView(api?.details, secrets),
          );
        }
        if (spec.kind === 'none') {
          discardBody(response);
          return undefined as T;
        }
        if (spec.kind === 'raw') {
          streaming = true;
          return response as T;
        }
        const mediaType = response.headers
          .get('content-type')
          ?.split(';', 1)[0]
          ?.trim()
          .toLowerCase();
        if (mediaType !== 'application/json' && !mediaType?.endsWith('+json'))
          throw new CommerceProtocolError('Expected JSON response');
        let parsed: unknown;
        try {
          parsed = parseJsonLosslessly(await readLimited(response, MAX_JSON_BYTES));
        } catch {
          throw new CommerceProtocolError('Invalid JSON response', {
            cause: new Error('JSON decode failed'),
          });
        }
        protectSecretView(parsed, secrets);
        if (spec.kind === 'data' || spec.kind === 'list') {
          if (!parsed || typeof parsed !== 'object' || !('data' in parsed))
            throw new CommerceProtocolError('Missing data envelope');
          if (spec.kind === 'data') return (parsed as { data: T }).data;
          const value = parsed as { data: unknown; total?: unknown };
          if (value.data === null && value.total === 0) value.data = [];
          if (
            !Array.isArray(value.data) ||
            typeof value.total !== 'number' ||
            !Number.isSafeInteger(value.total) ||
            value.total < 0
          )
            throw new CommerceProtocolError('Invalid list envelope');
        }
        return parsed as T;
      }
    } finally {
      clearTimeout(timer);
      if (!streaming) options.signal?.removeEventListener('abort', onAbort);
    }
  }
}
