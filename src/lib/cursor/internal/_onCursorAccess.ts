import { CursorAccess, CursorAccessListener } from "../onCursorAccess";

/**
 * List of listeners for cursor access events.
 */
export const cursorAccessListeners: CursorAccessListener[] = [];

/**
 * Emits an event for a cursor access.
 *
 * @export
 * @param {CursorAccess} event
 */
export function emitCursorAccess(event: CursorAccess): void {
  cursorAccessListeners.forEach(l => l(event));
}
