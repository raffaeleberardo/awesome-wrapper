import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LoadingScreen } from './LoadingScreen';

const value = () => Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LoadingScreen', () => {
  it('la stima sale ma resta sotto il 100% finché i dati non arrivano', () => {
    render(<LoadingScreen />);
    expect(value()).toBe(0);
    act(() => vi.advanceTimersByTime(4000));
    const early = value();
    expect(early).toBeGreaterThan(0);
    act(() => vi.advanceTimersByTime(60_000));
    expect(value()).toBeGreaterThan(early);
    expect(value()).toBeLessThan(100);
  });

  it('con i dati arriva al 100% e poi chiama onFinished', () => {
    const onFinished = vi.fn();
    const { rerender } = render(<LoadingScreen onFinished={onFinished} />);
    act(() => vi.advanceTimersByTime(1000));
    rerender(<LoadingScreen done onFinished={onFinished} />);
    expect(value()).toBe(100);
    expect(onFinished).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1000));
    expect(onFinished).toHaveBeenCalledOnce();
  });
});
