import { describe, expect, it } from 'vitest';
import { behaviourBalance } from '@/lib/behaviour';
import { type BoardEvent, hitTest, sanitiseEvent, shortName, strokesToEvents, visibleEvents } from '@/lib/board';

const ev = (id: number, kind: BoardEvent['kind'], data: Record<string, unknown>, page_id = 'p1'): BoardEvent => ({ id, page_id, kind, data });
const pen = (id: number, pts: [number, number][], page = 'p1') => ev(id, 'pen', { points: pts, color: '#0f1b3d', width: 0.006 }, page);

describe('board events', () => {
  it('applies erase and clear in order, per page', () => {
    const events = [
      pen(1, [[0.1, 0.1], [0.2, 0.2]]),
      pen(2, [[0.5, 0.5]]),
      pen(3, [[0.9, 0.9]], 'p2'),
      ev(4, 'erase', { ids: [1] }),
      pen(5, [[0.3, 0.3]]),
    ];
    expect(visibleEvents(events, 'p1').map((e) => e.id)).toEqual([2, 5]);
    expect(visibleEvents([...events, ev(6, 'clear', {}), pen(7, [[0, 0]])], 'p1').map((e) => e.id)).toEqual([7]);
    expect(visibleEvents(events, 'p2').map((e) => e.id)).toEqual([3]);
    // Arrival order does not matter: ids decide.
    expect(visibleEvents([...events].reverse(), 'p1').map((e) => e.id)).toEqual([2, 5]);
  });

  it('sanitises data: clamps coordinates, caps sizes, rejects junk', () => {
    expect(sanitiseEvent('pen', { points: [[-1, 2], [0.5, 'x'], [0.25, 0.75]], color: 'red', width: 9 })).toEqual({ points: [[0, 1], [0.25, 0.75]], color: '#0f1b3d', width: 0.05 });
    expect(sanitiseEvent('pen', { points: [] })).toBeNull();
    expect(sanitiseEvent('text', { at: [0.1, 0.1], text: '   ' })).toBeNull();
    expect((sanitiseEvent('text', { at: [0.1, 0.1], text: 'x'.repeat(400) }) as { text: string }).text).toHaveLength(300);
    expect(sanitiseEvent('fraction', { at: [0, 0], parts: 4, shaded: 5 })).toBeNull();
    expect(sanitiseEvent('fraction', { at: [0, 0], parts: 4, shaded: 3 })).toMatchObject({ parts: 4, shaded: 3 });
    expect(sanitiseEvent('erase', { ids: ['1', 2.5] })).toBeNull();
    expect(sanitiseEvent('erase', { ids: [3, 4] })).toEqual({ ids: [3, 4] });
    expect(sanitiseEvent('rect', { from: [0.1, 0.1] })).toBeNull();
  });

  it('finds the mark under the eraser, topmost first', () => {
    const events = [pen(1, [[0.1, 0.5], [0.9, 0.5]]), ev(2, 'rect', { from: [0.4, 0.4], to: [0.6, 0.6] })];
    expect(hitTest(events, [0.5, 0.5])?.id).toBe(2);
    expect(hitTest(events, [0.15, 0.505])?.id).toBe(1);
    expect(hitTest(events, [0.05, 0.05])).toBeNull();
  });

  it('turns answer-board strokes into drawable events and drops bad ones', () => {
    expect(strokesToEvents([{ points: [[0.1, 0.1]] }, null, { points: 'no' }])).toHaveLength(1);
    expect(strokesToEvents('not an array')).toEqual([]);
  });

  it('shows first name and initial only', () => {
    expect(shortName('Ada Lovelace Byron')).toBe('Ada L.');
    expect(shortName('Tobi')).toBe('Tobi');
  });
});

describe('behaviour balance', () => {
  it('adds merit points and concern points separately', () => {
    expect(behaviourBalance([{ kind: 'merit', points: 2 }, { kind: 'merit', points: 1 }, { kind: 'concern', points: 1 }])).toEqual({ merits: 3, concerns: 1, balance: 2 });
    expect(behaviourBalance([])).toEqual({ merits: 0, concerns: 0, balance: 0 });
  });
});
