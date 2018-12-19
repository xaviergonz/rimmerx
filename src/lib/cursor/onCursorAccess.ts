import { Disposer } from "../utils";
import { cursorAccessListeners } from "./internal/_onCursorAccess";

/**
 * Event generated when a cursor is read (accessed).
 */
export interface CursorAccess {
  cursor: any;
  value: any;
}

/**
 * Listener for cursor access events.
 */
export type CursorAccessListener = (event: CursorAccess) => void;

/**
 * Registers a listener for global cursor accesses.
 * This is a low lever method, use `trackCursorAccess` instead.
 *
 * @export
 * @param {CursorAccessListener} listener
 * @returns {Disposer}
 */
export function onCursorAccess(listener: CursorAccessListener): Disposer {
  cursorAccessListeners.push(listener);

  return () => {
    const index = cursorAccessListeners.indexOf(listener);
    if (index >= 0) {
      cursorAccessListeners.splice(index, 1);
    }
  };
}
