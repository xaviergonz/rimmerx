import { CursorAccess, onCursorAccess } from "./onCursorAccess";

export type TrackCursorAccessListener = (event: { cursor: any; value: any }) => void;

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
