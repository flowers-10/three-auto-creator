import test from 'node:test';
import assert from 'node:assert/strict';
import { historyShortcut } from '../src/components/layout/historyShortcuts';

const key = (extra: Record<string, unknown> = {}) => ({ key: 'z', ctrlKey: true, metaKey: false,
  shiftKey: false, altKey: false, isComposing: false, target: null, ...extra } as KeyboardEvent);

test('undo and redo work without a selection with Ctrl and Mac Command', () => {
  assert.equal(historyShortcut(key()), 'undo');
  assert.equal(historyShortcut(key({ key: 'y' })), 'redo');
  assert.equal(historyShortcut(key({ key: 'Z', shiftKey: true })), 'redo');
  assert.equal(historyShortcut(key({ ctrlKey: false, metaKey: true })), 'undo');
});

test('history shortcuts preserve native input undo and ignore composition and unrelated keys', () => {
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
    assert.equal(historyShortcut(key({ target: { tagName } })), null);
  }
  assert.equal(historyShortcut(key({ target: { isContentEditable: true } })), null);
  assert.equal(historyShortcut(key({ isComposing: true })), null);
  assert.equal(historyShortcut(key({ altKey: true })), null);
  assert.equal(historyShortcut(key({ ctrlKey: false })), null);
  assert.equal(historyShortcut(key({ key: 'g' })), null);
});
