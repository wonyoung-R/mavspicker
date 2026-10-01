import { describe, expect, it, vi } from 'vitest';
import { uniformIndex } from '../src/random';

describe('uniformIndex rejection sampling', () => {
  it.each([2, 3, 5, 17])('maps every complete bucket uniformly for n=%i', n => {
    for (let bucket = 0; bucket < 10; bucket++) {
      expect(Array.from({ length: n }, (_, i) => uniformIndex(n, () => bucket * n + i)))
        .toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });
  it.each([2, 3, 5])('accepts zero and limit minus one for n=%i', n => {
    const limit = Math.floor(2 ** 32 / n) * n;
    expect(uniformIndex(n, () => 0)).toBe(0);
    expect(uniformIndex(n, () => limit - 1)).toBe(n - 1);
  });
  it.each([3, 5])('rejects limit and Uint32 max for n=%i', n => {
    const limit = Math.floor(2 ** 32 / n) * n;
    const source = vi.fn().mockReturnValueOnce(limit).mockReturnValueOnce(0xffffffff).mockReturnValueOnce(n + 1);
    expect(uniformIndex(n, source)).toBe(1);
    expect(source).toHaveBeenCalledTimes(3);
  });
  it('accepts maximum Uint32 for n=2 and supports endpoints', () => {
    expect(uniformIndex(2, () => 0xffffffff)).toBe(1);
    expect(uniformIndex(1, () => 0xffffffff)).toBe(0);
    expect(uniformIndex(2 ** 32, () => 0xffffffff)).toBe(0xffffffff);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 2 ** 32 + 1])('rejects invalid n=%s', n => {
    expect(() => uniformIndex(n, () => 0)).toThrow(RangeError);
  });
  it.each([-1, 2 ** 32, NaN, 0.5])('rejects invalid source %s', value => {
    expect(() => uniformIndex(2, () => value)).toThrow(RangeError);
  });
  it('uses Web Crypto rather than a fallback', () => {
    const getRandomValues = vi.fn((array: Uint32Array) => { array[0] = 8; return array; });
    vi.stubGlobal('crypto', { getRandomValues });
    expect(uniformIndex(3)).toBe(2);
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
  it('throws when Web Crypto is missing', () => {
    vi.stubGlobal('crypto', undefined);
    expect(() => uniformIndex(2)).toThrow('Web Crypto unavailable');
    vi.unstubAllGlobals();
  });
});
