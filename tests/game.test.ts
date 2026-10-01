import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game, STABILIZE_MS, COUNTDOWN_MS } from '../src/game';

function participants(game: Game, n = 2) {
  for (let id = 1; id <= n; id++) game.add(id, id * 30, id * 40);
}
function result() { vi.advanceTimersByTime(STABILIZE_MS + COUNTDOWN_MS); }

describe('touch round state machine', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('never draws with zero or one touch', () => {
    const choose = vi.fn(() => 0);
    const game = new Game({ choose });
    result();
    game.add(1, 20, 20);
    result();
    expect(game.state.phase).toBe('idle');
    expect(game.state.winner).toBeNull();
    expect(choose).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([2, 3, 5])('stabilizes %i touches then shows 3,2,1 and exactly one winner', n => {
    const choose = vi.fn(() => n - 1);
    const onWin = vi.fn();
    const game = new Game({ choose, onWin });
    participants(game, n);
    expect(game.state.phase).toBe('stabilizing');
    vi.advanceTimersByTime(399);
    expect(game.state.count).toBeNull();
    vi.advanceTimersByTime(1);
    expect(game.state.phase).toBe('countdown');
    expect(game.state.count).toBe(3);
    vi.advanceTimersByTime(1000);
    expect(game.state.count).toBe(2);
    vi.advanceTimersByTime(1000);
    expect(game.state.count).toBe(1);
    vi.advanceTimersByTime(999);
    expect(game.state.winner).toBeNull();
    vi.advanceTimersByTime(1);
    expect(game.state.winner).toEqual({ id: n, x: n * 30, y: n * 40, slot: n - 1 });
    expect(game.state.phase).toBe('result');
    expect(game.state.count).toBeNull();
    vi.advanceTimersByTime(20000);
    expect(choose).toHaveBeenCalledExactlyOnceWith(n);
    expect(onWin).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['add', 'remove', 'cancel'] as const)('restarts on countdown %s', action => {
    const game = new Game({ choose: () => 0 });
    participants(game, 3);
    vi.advanceTimersByTime(1400);
    if (action === 'add') game.add(4, 30, 20);
    else game.remove(3); // pointerup and pointercancel both terminate the id.
    expect(game.state.phase).toBe('stabilizing');
    expect(game.state.count).toBeNull();
    vi.advanceTimersByTime(399);
    expect(game.state.count).toBeNull();
    vi.advanceTimersByTime(1);
    expect(game.state.count).toBe(3);
    vi.advanceTimersByTime(3000);
    expect(game.state.phase).toBe('result');
    expect(game.state.touches.size).toBe(action === 'add' ? 4 : 2);
  });

  it('changes during stabilization restart the 400ms interval', () => {
    const game = new Game();
    participants(game);
    vi.advanceTimersByTime(300);
    game.add(3, 0, 0);
    vi.advanceTimersByTime(399);
    expect(game.state.phase).toBe('stabilizing');
    vi.advanceTimersByTime(1);
    expect(game.state.count).toBe(3);
  });

  it('movement and repeated down never reset countdown or change slot', () => {
    const game = new Game({ choose: () => 0 });
    participants(game);
    vi.advanceTimersByTime(1400);
    game.move(1, -50, 900);
    game.add(1, 1, 1);
    expect(game.state.count).toBe(2);
    vi.advanceTimersByTime(2000);
    expect(game.state.winner).toEqual({ id: 1, x: -50, y: 900, slot: 0 });
  });

  it('cancellation immediately before draw prevents selection', () => {
    const choose = vi.fn(() => 0);
    const game = new Game({ choose });
    participants(game);
    vi.advanceTimersByTime(3399);
    game.remove(1);
    vi.advanceTimersByTime(10000);
    expect(game.state.phase).toBe('idle');
    expect(choose).not.toHaveBeenCalled();
  });

  it('winner stays fixed after winner removal and new down until everyone releases', () => {
    const onWin = vi.fn();
    const game = new Game({ choose: () => 0, onWin });
    participants(game);
    result();
    const winner = game.state.winner;
    game.remove(1);
    game.add(3, 10, 10);
    expect(game.state.touches.get(3)?.slot).toBe(-1);
    game.move(3, 50, 50);
    game.remove(2);
    vi.advanceTimersByTime(10000);
    expect(game.state.winner).toBe(winner);
    expect(game.state.phase).toBe('result');
    expect(onWin).toHaveBeenCalledTimes(1);
    game.remove(3);
    expect(game.state.phase).toBe('idle');
    expect(game.state.winner).toBeNull();
    participants(game);
    result();
    expect(onWin).toHaveBeenCalledTimes(2);
  });

  it('repeated release / lost capture and unknown move do not revive touches', () => {
    const game = new Game();
    participants(game);
    game.remove(1);
    game.remove(1);
    game.move(1, 30, 30);
    expect(game.state.touches.has(1)).toBe(false);
    expect(game.state.touches.size).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    game.remove(2);
    expect(game.state.touches.size).toBe(0);
  });

  it.each([200, 1400, 3399])('interruption at %ims discards pointers and timers; resume needs new down', ms => {
    const onWin = vi.fn();
    const game = new Game({ choose: () => 0, onWin });
    participants(game);
    vi.advanceTimersByTime(ms);
    game.interrupt();
    game.move(1, 0, 0);
    vi.advanceTimersByTime(20000);
    expect(game.state.phase).toBe('idle');
    expect(game.state.touches.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(onWin).not.toHaveBeenCalled();
    participants(game);
    result();
    expect(onWin).toHaveBeenCalledTimes(1);
  });

  it('hidden document cancels callbacks and ignores new touch until active', () => {
    let active = true;
    const onWin = vi.fn();
    const game = new Game({ active: () => active, choose: () => 0, onWin });
    participants(game);
    vi.advanceTimersByTime(1400);
    active = false;
    game.add(3, 0, 0);
    expect(game.state.touches.size).toBe(2);
    vi.advanceTimersByTime(1000);
    expect(game.state.phase).toBe('idle');
    active = true;
    vi.advanceTimersByTime(10000);
    expect(onWin).not.toHaveBeenCalled();
    expect(game.state.touches.size).toBe(0);
  });

  it('interrupt preserves a completed result, then fresh down starts a new round', () => {
    const game = new Game({ choose: () => 0 });
    participants(game);
    result();
    const winner = game.state.winner;
    game.interrupt();
    expect(game.state.phase).toBe('result');
    expect(game.state.winner).toBe(winner);
    expect(game.state.touches.size).toBe(0);
    game.move(1, 0, 0);
    game.add(4, 40, 40);
    expect(game.state.phase).toBe('idle');
    expect(game.state.winner).toBeNull();
    expect(game.state.touches.get(4)?.slot).toBe(0);
    game.add(5, 50, 50);
    result();
    expect(game.state.winner?.id).toBe(4);
  });

  it('random failure becomes recoverable error and never emits winner', () => {
    const onWin = vi.fn();
    const game = new Game({ choose: () => { throw new Error('No crypto'); }, onWin });
    participants(game);
    result();
    expect(game.state.phase).toBe('error');
    expect(game.state.count).toBeNull();
    expect(onWin).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    game.add(3, 0, 0);
    expect(game.state.touches.get(3)?.slot).toBe(-1);
    game.remove(1); game.remove(2); game.remove(3);
    expect(game.state.phase).toBe('idle');
  });

  it.each([-1, 2, NaN, 0.5])('rejects invalid test-selected index %s', index => {
    const game = new Game({ choose: () => index });
    participants(game); result();
    expect(game.state.phase).toBe('error');
    expect(game.state.winner).toBeNull();
  });

  it('stale callbacks cannot draw even when canceled timers are maliciously replayed', () => {
    const queue: (() => void)[] = [];
    const choose = vi.fn(() => 0);
    const game = new Game({ choose, setTimeout: fn => { queue.push(fn); return queue.length; }, clearTimeout: () => {} });
    participants(game);
    queue[0]!(); // enter countdown
    const oldCallbacks = queue.slice(1);
    game.remove(2);
    game.add(3, 0, 0); // same count but different identity and round
    oldCallbacks.forEach(fn => fn());
    expect(game.state.phase).toBe('stabilizing');
    expect(choose).not.toHaveBeenCalled();
    queue.at(-1)!();
    const currentDraw = queue.at(-1)!;
    currentDraw(); currentDraw();
    expect(game.state.phase).toBe('result');
    expect(choose).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('rechecks round identity after random source and does not draw interrupted round', () => {
    let game: Game;
    const onWin = vi.fn();
    game = new Game({ choose: () => { game.interrupt(); return 0; }, onWin });
    participants(game); result();
    expect(game.state.phase).toBe('idle');
    expect(onWin).not.toHaveBeenCalled();
  });
});
