import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhotoAssignments } from '../src/assignment';

function choicesFor(size: number): number[][] {
  if (size === 1) return [[]];
  return Array.from({ length: size }, (_, first) =>
    choicesFor(size - 1).map(tail => [first, ...tail])).flat();
}

describe('random photo assignments', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([[2, 2], [3, 6], [5, 120]])('each Fisher–Yates choice sequence gives a distinct permutation of %i photos', (size, count) => {
    const permutations = choicesFor(size).map(sequence => {
      const source = [...sequence];
      const photos = new PhotoAssignments(size, () => source.shift()!);
      const order = Array.from({ length: size }, (_, slot) => photos.get(slot));
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: size }, (_, i) => i));
      expect(source).toEqual([]);
      return order.join(',');
    });
    expect(permutations).toHaveLength(count);
    expect(new Set(permutations).size).toBe(count);
  });

  it('creates the shuffle lazily and preserves slot correspondence for unordered lookups', () => {
    const choose = vi.fn((_n: number) => 0);
    const photos = new PhotoAssignments(5, choose);
    expect(choose).not.toHaveBeenCalled();
    expect(photos.get(4)).toBe(0);
    expect([photos.get(0), photos.get(1), photos.get(2), photos.get(3)]).toEqual([1, 2, 3, 4]);
    expect(choose.mock.calls.map(args => args[0])).toEqual([5, 4, 3, 2]);
    expect(photos.get(4)).toBe(0);
    expect(photos.get(0)).toBe(1);
    expect(choose).toHaveBeenCalledTimes(4);
  });

  it('repeats the same permutation for touches exceeding photo count', () => {
    const choose = vi.fn(n => n - 1);
    const photos = new PhotoAssignments(3, choose);
    expect(Array.from({ length: 12 }, (_, slot) => photos.get(slot))).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2]);
    expect(photos.get(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER % 3);
    expect(choose).toHaveBeenCalledTimes(2);
  });

  it('reset discards assignments and generates fresh randomness only on the next lookup', () => {
    const choose = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0)
      .mockReturnValueOnce(2).mockReturnValueOnce(1);
    const photos = new PhotoAssignments(3, choose);
    expect([photos.get(0), photos.get(1), photos.get(2)]).toEqual([1, 2, 0]);
    photos.reset();
    expect(choose).toHaveBeenCalledTimes(2);
    expect([photos.get(0), photos.get(1), photos.get(2)]).toEqual([0, 1, 2]);
    expect(choose).toHaveBeenCalledTimes(4);
  });

  it('one verified photo works without unnecessary randomness', () => {
    const choose = vi.fn();
    const photos = new PhotoAssignments(1, choose);
    expect(photos.get(0)).toBe(0);
    expect(photos.get(20)).toBe(0);
    photos.reset();
    expect(photos.get(1)).toBe(0);
    expect(choose).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, NaN, Infinity, 2 ** 32])('rejects invalid photo count %s', size => {
    expect(() => new PhotoAssignments(size)).toThrow(RangeError);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid slot %s before generating randomness', slot => {
    const choose = vi.fn((_n: number) => 0);
    expect(() => new PhotoAssignments(3, choose).get(slot)).toThrow(RangeError);
    expect(choose).not.toHaveBeenCalled();
  });

  it.each([-1, 3, 0.5, NaN])('rejects invalid injected shuffled index %s', index => {
    expect(() => new PhotoAssignments(3, () => index).get(0)).toThrow(RangeError);
  });

  it('propagates unavailable Web Crypto instead of inventing random assignments', () => {
    vi.stubGlobal('crypto', undefined);
    const photos = new PhotoAssignments(3);
    expect(() => photos.get(0)).toThrow('Web Crypto unavailable');
    expect(() => photos.get(2)).toThrow('Web Crypto unavailable');
  });

  it('does not preserve a partially shuffled order after random source failure', () => {
    const choose = vi.fn().mockReturnValueOnce(0).mockImplementationOnce(() => { throw new Error('Crypto failure'); })
      .mockReturnValueOnce(2).mockReturnValueOnce(1);
    const photos = new PhotoAssignments(3, choose);
    expect(() => photos.get(0)).toThrow('Crypto failure');
    expect([photos.get(0), photos.get(1), photos.get(2)]).toEqual([0, 1, 2]);
    expect(choose).toHaveBeenCalledTimes(4);
  });
});
