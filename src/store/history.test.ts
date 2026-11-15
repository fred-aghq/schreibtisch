import { describe, expect, it } from 'vitest';
import { beginTx, cancelTx, commit, createHistory, endTx, HISTORY_LIMIT, redo, undo } from './history';

describe('history', () => {
  it('undoes and redoes single steps', () => {
    let h = createHistory(1);
    h = commit(h, 2);
    h = commit(h, 3);
    h = undo(h);
    expect(h.present).toBe(2);
    h = undo(h);
    expect(h.present).toBe(1);
    h = undo(h);
    expect(h.present).toBe(1);
    h = redo(h);
    expect(h.present).toBe(2);
  });

  it('a new change clears the redo stack', () => {
    let h = commit(commit(createHistory('a'), 'b'), 'c');
    h = undo(h);
    h = commit(h, 'd');
    expect(redo(h).present).toBe('d');
    expect(h.future).toHaveLength(0);
  });

  it('ignores no-op commits', () => {
    const h = createHistory(1);
    expect(commit(h, 1)).toBe(h);
  });

  it('a transaction is one undo step', () => {
    let h = createHistory(0);
    h = beginTx(h);
    for (let i = 1; i <= 10; i++) h = commit(h, i);
    h = endTx(h);
    expect(h.present).toBe(10);
    expect(h.past).toEqual([0]);
    expect(undo(h).present).toBe(0);
  });

  it('an empty transaction adds no step', () => {
    let h = commit(createHistory(0), 1);
    h = endTx(beginTx(h));
    expect(h.past).toEqual([0]);
  });

  it('cancelling a transaction restores its start', () => {
    let h = beginTx(createHistory(0));
    h = commit(h, 5);
    h = cancelTx(h);
    expect(h.present).toBe(0);
    expect(h.past).toHaveLength(0);
  });

  it('undo during an open transaction closes it first', () => {
    let h = beginTx(commit(createHistory(0), 1));
    h = commit(h, 2);
    h = undo(h);
    expect(h.present).toBe(1);
    expect(h.txBase).toBeNull();
  });

  it('caps history length', () => {
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 50; i++) h = commit(h, i);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});
