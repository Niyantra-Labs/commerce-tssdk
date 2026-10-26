import type { ListResponse, PageParams } from '../models/generated.js';
import { CommerceProtocolError } from '../errors.js';
import type { RequestOptions, ResponseKind } from '../transport.js';
import { pathSegment, Transport } from '../transport.js';

/** Shared read/list behavior for a collection. */
export class CollectionService<R, List extends PageParams = PageParams, Detail = R> {
  constructor(
    protected readonly http: Transport,
    protected readonly path: string,
  ) {}

  /** One page of results as `{ data, total }`. */
  list(params?: List, options?: RequestOptions): Promise<ListResponse<R>> {
    return this.http.request(
      {
        method: 'GET',
        path: this.path,
        query: params as unknown as Record<string, string | number | boolean | undefined>,
        kind: 'list',
      },
      options,
    );
  }

  /** Get one item by ID. A missing or foreign item rejects with `CommerceApiError` 404. */
  get(id: string, options?: RequestOptions): Promise<Detail> {
    return this.http.request({ method: 'GET', path: this.item(id), kind: 'data' }, options);
  }

  protected item(id: string): string {
    return `${this.path}/${pathSegment(id)}`;
  }

  protected action<T>(
    id: string,
    suffix: string,
    body?: unknown,
    options?: RequestOptions,
    kind: ResponseKind = 'data',
  ): Promise<T> {
    return this.http.request(
      { method: 'POST', path: `${this.item(id)}/${suffix}`, body, kind },
      options,
    );
  }

  /** Iterate pages lazily. A later-page failure rejects iteration. */
  async *listAll(params?: List, options?: RequestOptions): AsyncIterableIterator<R> {
    const limit = params?.limit ?? 25;
    if (!Number.isSafeInteger(limit) || limit < 1)
      throw new RangeError('limit must be a positive safe integer');
    let offset = params?.offset ?? 0;
    if (!Number.isSafeInteger(offset) || offset < 0)
      throw new RangeError('offset must be non-negative');
    for (;;) {
      const page = await this.list({ ...params, limit, offset } as List, options);
      if (page.data.length === 0) {
        if (offset < page.total)
          throw new CommerceProtocolError('Empty page before pagination total');
        return;
      }
      for (const item of page.data) yield item;
      offset += page.data.length;
      if (offset >= page.total) return;
    }
  }
}

/** Standard CRUD behavior; only use for routes that implement all five operations. */
export class ResourceService<
  R,
  // Public CRUD input parameters bind service methods to generated wire types.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  Create,
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  Update,
  List extends PageParams = PageParams,
  CreateResult = R,
  Detail = R,
> extends CollectionService<R, List, Detail> {
  /** Create an item. */
  create(params: Create, options?: RequestOptions): Promise<CreateResult> {
    return this.http.request(
      { method: 'POST', path: this.path, body: params, kind: 'data' },
      options,
    );
  }
  /** Partially update an item (PATCH): omitted fields are left unchanged. */
  update(id: string, params: Update, options?: RequestOptions): Promise<R> {
    return this.http.request(
      { method: 'PATCH', path: this.item(id), body: params, kind: 'data' },
      options,
    );
  }
  /** Delete an item. */
  delete(id: string, options?: RequestOptions): Promise<void> {
    return this.http.request({ method: 'DELETE', path: this.item(id), kind: 'none' }, options);
  }
}

/** Collect an async iterable (such as `listAll()`) into an array, rejecting once `cap` items are exceeded. */
export async function collectAll<T>(items: AsyncIterable<T>, cap = 10000): Promise<T[]> {
  if (!Number.isSafeInteger(cap) || cap < 1) throw new RangeError('cap must be positive');
  const result: T[] = [];
  for await (const item of items) {
    if (result.length >= cap) throw new RangeError('Pagination cap exceeded');
    result.push(item);
  }
  return result;
}
