import { afterEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './persistence';

describe('debounce', () => {
  afterEach(() => vi.useRealTimers());

  it('calls once with the latest args after the delay', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    d(2);
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith(2);
  });

  it('flush runs a pending call immediately, and only once', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a');
    d.flush();
    expect(fn).toHaveBeenCalledExactlyOnceWith('a');
    vi.advanceTimersByTime(500);
    d.flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
