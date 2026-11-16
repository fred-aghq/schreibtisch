/** True when keyboard input is going into a text field, select or editable element. */
export function isTypingTarget(t: EventTarget | null): boolean {
  return typeof HTMLElement !== 'undefined' && t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
}
