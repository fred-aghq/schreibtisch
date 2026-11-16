import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useStore } from '../store/store';

export interface ColourFieldProps {
  value: string;
  /** Called live while the picker moves. */
  onInput: (colour: string) => void;
  className?: string;
  'aria-label'?: string;
}

function begin(open: RefObject<boolean>): void {
  if (open.current) return;
  open.current = true;
  useStore.getState().beginTx();
}

function end(open: RefObject<boolean>): void {
  if (!open.current) return;
  open.current = false;
  useStore.getState().endTx();
}

/**
 * A colour input whose whole picker session (open, drag around, close) is one undo step: a
 * transaction opens on focus / press, colours apply live, and it closes on change or blur.
 */
export function ColourField({ value, onInput, className, 'aria-label': ariaLabel }: ColourFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  const open = useRef(false);

  // React's onChange fires on every input; the native change event fires when the picker closes.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onChange = () => end(open);
    el.addEventListener('change', onChange);
    return () => {
      el.removeEventListener('change', onChange);
      end(open);
    };
  }, []);

  return (
    <input
      ref={ref}
      type="color"
      className={className}
      aria-label={ariaLabel}
      value={value}
      onFocus={() => begin(open)}
      onPointerDown={() => begin(open)}
      onChange={(e) => {
        begin(open);
        onInput(e.currentTarget.value);
      }}
      onBlur={() => end(open)}
    />
  );
}
