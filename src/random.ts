const UINT32_RANGE = 2 ** 32;

/** Uniform over [0, n); rejection discards the incomplete final bucket. */
export function uniformIndex(n: number, readUint32?: () => number): number {
  if (!Number.isSafeInteger(n) || n < 1 || n > UINT32_RANGE) {
    throw new RangeError('Invalid participant count');
  }
  const read = readUint32 ?? (() => {
    if (!globalThis.crypto?.getRandomValues) throw new Error('Web Crypto unavailable');
    return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]!;
  });
  const limit = Math.floor(UINT32_RANGE / n) * n;
  for (;;) {
    const value = read();
    if (!Number.isInteger(value) || value < 0 || value >= UINT32_RANGE) {
      throw new RangeError('Expected a Uint32 value');
    }
    if (value < limit) return value % n;
  }
}
