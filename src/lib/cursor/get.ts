import { runCursor } from "./internal/_cursor";
import { getCursorAccessEventHandler } from "./internal/_onCursorAccess";

/**
 * Indicates that a cursor value could not be calculated since the selector is broken.
 */
export const broken = Symbol("broken");

/**
 * Executes a cursor query, returning its result.
 *
 * @alias get
 * @export
 * @template T
 * @param {T} cursor
 * @returns {T}
 */
export function _<T>(cursor: T): T {
  const value = runCursor(cursor, false, false) as T;
  getCursorAccessEventHandler().emit({ cursor, value });
  return value;
}

/**
 * Executes a cursor query, returning its result.
 *
 * @alias _
 * @export
 * @template T
 * @param {T} cursor
 * @returns {T}
 */
export function get<T>(cursor: T): T {
  return _(cursor);
}

/**
 * Executes a cursor query, returning its result, or `broken` if at some part of the evalution the value in the middle is `undefined` or `null`.
 *
 * @alias safeGet
 * @export
 * @template T
 * @param {T} cursor
 * @returns {(T | typeof broken)}
 */
export function _safe<T>(cursor: T): T | typeof broken {
  const value = runCursor(cursor, true, false);
  getCursorAccessEventHandler().emit({ cursor, value });
  return value;
}

/**
 * Executes a cursor query, returning its result, or `broken` if at some part of the evalution the value in the middle is `undefined` or `null`.
 *
 * @alias _safe
 * @export
 * @template T
 * @param {T} cursor
 * @returns {(T | typeof broken)}
 */
export function safeGet<T>(cursor: T): T | typeof broken {
  return _safe(cursor);
}
