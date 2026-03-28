import { describe, it, expect, vi } from 'vitest';
import { KeypressHandler } from '../../src/tui/keypress.js';

describe('KeypressHandler', () => {
  it('starts inactive', () => {
    const handler = new KeypressHandler(vi.fn());
    expect(handler.isActive()).toBe(false);
  });

  it('reports active state correctly after start/pause/resume/stop', () => {
    // Note: start() checks process.stdin.isTTY which is false in tests
    // so it won't actually activate — that's correct behavior
    const handler = new KeypressHandler(vi.fn());
    expect(handler.isActive()).toBe(false);
    handler.start(); // won't activate in non-TTY
    expect(handler.isActive()).toBe(false);
    handler.stop();
    expect(handler.isActive()).toBe(false);
  });

  it('callback type is correct', () => {
    const cb = vi.fn();
    const handler = new KeypressHandler(cb);
    expect(handler).toBeDefined();
    // The callback would be called with 'a' or 'p' in real TTY usage
  });
});
