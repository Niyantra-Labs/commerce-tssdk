/** Base error for every SDK failure. */
export class CommerceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** An HTTP response with a non-success status. */
export class CommerceApiError extends CommerceError {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** A server HTTP 429 response. Also a CommerceApiError for broad HTTP error handling. */
export class CommerceRateLimitError extends CommerceApiError {}

/** A successful HTTP response that violates the expected Commerce protocol. */
export class CommerceProtocolError extends CommerceError {}

/** A fetch-level failure. */
export class CommerceNetworkError extends CommerceError {}

/** The caller cancelled the operation. */
export class CommerceAbortError extends CommerceError {}

/** The configured deadline expired. */
export class CommerceTimeoutError extends CommerceError {}

/** The optional client-side rate-limit wait queue has reached its configured cap. */
export class CommerceLocalRateLimitError extends CommerceError {}

/** An invalid SDK option or request value. */
export class CommerceValidationError extends CommerceError {}

/** Cryptographic verification or signing failed. */
export class CommerceCryptoError extends CommerceError {}
