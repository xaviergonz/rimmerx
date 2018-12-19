import { CursorAccess, onCursorAccess } from "./onCursorAccess";

/**
 * Listener for a trackCursorAccess event.
 */
export type TrackCursorAccessListener = (event: { cursor: any; value: any }) => void;

/**
 * Tracks cursor accesses inside a function and returns the accesses (reads) made inside.
 *
 * @export
 * @param {() => void} fn
 * @returns {CursorAccess[]}
 */
export function trackCursorAccess(fn: () => void): CursorAccess[] {
  const accesses: CursorAccess[] = [];
  const disposer = onCursorAccess(cursorAccess => {
    accesses.push(cursorAccess);
  });

  try {
    fn();
  } finally {
    disposer();
  }
  return accesses;
}
