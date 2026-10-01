import { uniformIndex } from './random';

export const STABILIZE_MS = 400;
export const COUNTDOWN_MS = 3000;
export type Phase = 'idle' | 'stabilizing' | 'countdown' | 'result' | 'error';
export interface Touch { id: number; x: number; y: number; slot: number }
export interface GameState {
  phase: Phase;
  touches: Map<number, Touch>;
  winner: Touch | null;
  count: number | null;
}
interface GameOptions {
  onChange?: (state: GameState) => void;
  onWin?: (winner: Touch) => void;
  active?: () => boolean;
  choose?: (n: number) => number;
  setTimeout?: (callback: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
}

/** Participant identity changes invalidate a round; position changes never do. */
export class Game {
  readonly state: GameState = { phase: 'idle', touches: new Map(), winner: null, count: null };
  private round = 0;
  private timers = new Set<unknown>();
  private resumeWithNewInput = false;
  private readonly options: GameOptions;
  private readonly schedule: (callback: () => void, ms: number) => unknown;
  private readonly cancel: (handle: unknown) => void;

  constructor(options: GameOptions = {}) {
    this.options = options;
    this.schedule = options.setTimeout ?? ((fn, ms) => globalThis.setTimeout(fn, ms));
    this.cancel = options.clearTimeout ?? ((handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>));
  }

  add(id: number, x: number, y: number): void {
    if (!this.active() || this.state.touches.has(id)) return;
    if (this.resumeWithNewInput) {
      this.reset();
      this.resumeWithNewInput = false;
    }
    const locked = this.state.phase === 'result' || this.state.phase === 'error';
    const occupied = new Set([...this.state.touches.values()].map(t => t.slot));
    let slot = 0;
    while (occupied.has(slot)) slot++;
    this.state.touches.set(id, { id, x, y, slot: locked ? -1 : slot });
    if (locked) this.emit();
    else this.restart();
  }

  move(id: number, x: number, y: number): void {
    const touch = this.state.touches.get(id);
    if (!touch) return;
    touch.x = x;
    touch.y = y;
    this.emit();
  }

  remove(id: number): void {
    if (!this.state.touches.delete(id)) return;
    if (this.state.touches.size === 0) {
      this.reset();
      this.emit();
    } else if (this.state.phase === 'result' || this.state.phase === 'error') this.emit();
    else this.restart();
  }

  /** Interrupted input is discarded, while an already visible result remains stable. */
  interrupt(): void {
    this.invalidate();
    this.state.touches.clear();
    if (this.state.phase === 'result') this.resumeWithNewInput = true;
    else this.reset();
    this.emit();
  }

  private active(): boolean { return this.options.active?.() ?? true; }
  private emit(): void { this.options.onChange?.(this.state); }

  private invalidate(): void {
    this.round++;
    for (const handle of this.timers) this.cancel(handle);
    this.timers.clear();
  }

  private reset(): void {
    this.invalidate();
    this.state.touches.clear();
    this.state.phase = 'idle';
    this.state.count = null;
    this.state.winner = null;
    this.resumeWithNewInput = false;
  }

  private matches(round: number, snapshot: number[]): boolean {
    return round === this.round && this.state.touches.size === snapshot.length
      && snapshot.every(id => this.state.touches.has(id));
  }

  private later(ms: number, round: number, snapshot: number[], fn: () => void): void {
    let handle: unknown;
    handle = this.schedule(() => {
      this.timers.delete(handle);
      if (!this.matches(round, snapshot)) return;
      if (!this.active()) { this.interrupt(); return; }
      fn();
    }, ms);
    this.timers.add(handle);
  }

  private restart(): void {
    this.invalidate();
    this.state.count = null;
    if (this.state.touches.size < 2) {
      this.state.phase = 'idle';
      this.emit();
      return;
    }
    this.state.phase = 'stabilizing';
    const round = this.round;
    const snapshot = [...this.state.touches.keys()];
    this.later(STABILIZE_MS, round, snapshot, () => {
      this.state.phase = 'countdown';
      this.state.count = 3;
      this.later(1000, round, snapshot, () => { this.state.count = 2; this.emit(); });
      this.later(2000, round, snapshot, () => { this.state.count = 1; this.emit(); });
      this.later(COUNTDOWN_MS, round, snapshot, () => this.finish(round, snapshot));
      this.emit();
    });
    this.emit();
  }

  private finish(round: number, snapshot: number[]): void {
    if (this.state.phase !== 'countdown' || snapshot.length < 2 || !this.matches(round, snapshot)) return;
    let index: number;
    try {
      index = (this.options.choose ?? uniformIndex)(snapshot.length);
      if (!Number.isInteger(index) || index < 0 || index >= snapshot.length) throw new RangeError('Invalid winner');
    } catch {
      this.invalidate();
      this.state.phase = 'error';
      this.state.count = null;
      this.emit();
      return;
    }
    // Recheck after selection as well: an injected test source may interrupt the round.
    if (!this.active() || !this.matches(round, snapshot)) return;
    const winner = this.state.touches.get(snapshot[index]!)!;
    this.invalidate();
    this.state.winner = { ...winner };
    this.state.phase = 'result';
    this.state.count = null;
    this.emit();
    this.options.onWin?.(this.state.winner);
  }
}
