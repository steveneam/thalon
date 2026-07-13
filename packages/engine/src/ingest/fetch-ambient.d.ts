export {};

/**
 * Minimal ambient `fetch` typing. Node 20's runtime ships a global `fetch`
 * (undici), but @types/node doesn't declare it and this package's tsconfig
 * deliberately stays DOM-free rather than pull in the whole browser lib for
 * one call (zero new deps ground rule). Only the subset the engine's
 * callers use is typed here (text bodies for fetcher.ts and the trend
 * drivers; arrayBuffer for B7.1 binary asset pinning).
 */
declare global {
  function fetch(
    input: string,
    init?: Record<string, unknown>,
  ): Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    headers: { get(name: string): string | null };
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
  }>;
}
