import { useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { evaluateExpression } from '../geometry/expr';
import styles from './NumberField.module.css';

export interface NumberFieldProps {
  label: string;
  /** Small axis hint shown after the label, e.g. "X". */
  hint?: string;
  value: number;
  unit?: 'mm' | '°' | 'in' | '';
  /** Decimal places shown when not editing (mm round to whole millimetres). */
  decimals?: number;
  min?: number;
  max?: number;
  /** Arrow-key step; Shift multiplies by 10. */
  step?: number;
  disabled?: boolean;
  title?: string;
  onCommit: (value: number) => void;
}

/**
 * Numeric input that accepts decimals and simple arithmetic ("300+45").
 * Commits on Enter / blur / arrow keys; Escape reverts.
 */
export function NumberField({
  label,
  hint,
  value,
  unit = 'mm',
  decimals = unit === 'mm' ? 0 : 1,
  min,
  max,
  step = 1,
  disabled,
  title,
  onCommit,
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  const shown = draft ?? format(value, decimals);

  const clampValue = (v: number): number => {
    let r = v;
    if (min !== undefined) r = Math.max(min, r);
    if (max !== undefined) r = Math.min(max, r);
    return r;
  };

  const commit = (text: string): boolean => {
    const v = evaluateExpression(text);
    if (v === null) {
      setInvalid(true);
      return false;
    }
    setInvalid(false);
    const next = clampValue(v);
    if (next !== value) onCommit(next);
    return true;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (commit(e.currentTarget.value)) setDraft(null);
      e.currentTarget.select();
    } else if (e.key === 'Escape') {
      setDraft(null);
      setInvalid(false);
      e.currentTarget.blur();
      e.stopPropagation();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const base = evaluateExpression(e.currentTarget.value) ?? value;
      const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
      const next = clampValue(base + delta);
      onCommit(next);
      setDraft(format(next, decimals));
    }
  };

  return (
    <label className={styles.field} htmlFor={id} title={title}>
      <span className={styles.label}>
        {label}
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
      <span className={`${styles.inputWrap} ${invalid ? styles.invalid : ''}`}>
        <input
          id={id}
          className={`${styles.input} num`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={shown}
          onFocus={(e) => {
            setDraft(format(value, decimals));
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={(e) => {
            commit(e.currentTarget.value);
            setDraft(null);
            setInvalid(false);
          }}
          onKeyDown={onKeyDown}
        />
        {unit && <span className={styles.unit}>{unit}</span>}
      </span>
    </label>
  );
}

function format(v: number, decimals: number): string {
  const f = 10 ** decimals;
  const r = Math.round(v * f) / f;
  return String(Object.is(r, -0) ? 0 : r);
}
