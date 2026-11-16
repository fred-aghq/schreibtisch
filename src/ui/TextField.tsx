import { useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'onKeyDown'> {
  value: string;
  /** Called once per edit with the trimmed text, only if it changed and isn't empty. */
  onCommit: (value: string) => void;
  /** Called when editing finishes (blur, Enter or Escape), committed or not. */
  onDone?: () => void;
}

/**
 * A text input that edits a local draft and commits it on blur or Enter, so typing a name is a
 * single undo step. Escape reverts.
 */
export function TextField({ value, onCommit, onDone, ...rest }: TextFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const reverting = useRef(false);

  return (
    <input
      type="text"
      {...rest}
      value={draft ?? value}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={(e) => {
        const text = e.currentTarget.value.trim();
        if (!reverting.current && text && text !== value) onCommit(text);
        reverting.current = false;
        setDraft(null);
        onDone?.();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        } else if (e.key === 'Escape') {
          e.stopPropagation();
          reverting.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}
