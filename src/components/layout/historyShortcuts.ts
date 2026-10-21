export function historyShortcut(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey' | 'isComposing' | 'target'>): 'undo' | 'redo' | null {
  const target = event.target as HTMLElement | null;
  if (event.isComposing || event.altKey || (!event.ctrlKey && !event.metaKey)
    || target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return null;
  const key = event.key.toLowerCase();
  if (key === 'z') return event.shiftKey ? 'redo' : 'undo';
  if (key === 'y') return 'redo';
  return null;
}
