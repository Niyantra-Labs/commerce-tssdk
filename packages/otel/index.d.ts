import type { TransportHooks } from '@niyantra/commerce';

export interface OTelCounter {
  add(value: number, attributes: Record<string, string | number>): void;
}
export interface OTelHistogram {
  record(value: number, attributes: Record<string, string | number>): void;
}
export interface OTelMeter {
  createCounter(name: string): OTelCounter;
  createHistogram(name: string, options: { unit: string }): OTelHistogram;
}
export interface OTelTracer {
  startSpan(
    name: string,
    options: { attributes: Record<string, string | number> },
  ): { end(): void };
}
export function createOtelHooks(input: { tracer: OTelTracer; meter: OTelMeter }): TransportHooks;
