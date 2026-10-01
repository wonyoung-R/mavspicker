import { uniformIndex } from './random';

/** One random photo permutation per round, independent of winner selection. */
export class PhotoAssignments {
  private permutation: number[] | null = null;

  constructor(private readonly size: number, private readonly choose: (n: number) => number = uniformIndex) {
    if (!Number.isSafeInteger(size) || size < 1 || size > 0xffffffff) {
      throw new RangeError('Invalid photo count');
    }
  }

  get(slot: number): number {
    if (!Number.isSafeInteger(slot) || slot < 0) throw new RangeError('Invalid photo slot');
    if (!this.permutation) {
      const next = Array.from({ length: this.size }, (_, index) => index);
      for (let index = next.length - 1; index > 0; index--) {
        const selected = this.choose(index + 1);
        if (!Number.isInteger(selected) || selected < 0 || selected > index) {
          throw new RangeError('Invalid shuffled index');
        }
        [next[index], next[selected]] = [next[selected]!, next[index]!];
      }
      // Publish only a complete shuffle: failed Crypto requests never cache a partial order.
      this.permutation = next;
    }
    return this.permutation[slot % this.size]!;
  }

  reset(): void { this.permutation = null; }
}
