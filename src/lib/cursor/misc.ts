import { cursorObject, getCursorObject } from "./internal/_cursor";

/**
 * A cursor step (key access, function call or transform).
 */
export type CursorStep = string | number | symbol | CursorCallStep | CursorTransformStep;

/**
 * A cursor function call step.
 */
export class CursorCallStep {
  constructor(readonly ctx: any, readonly args: any) {}
}

/**
 * A cursor transform step.
 */
export class CursorTransformStep {
  constructor(readonly transform: (value: any) => any) {}
}

/**
 * Returns if a value is a cursor.
 *
 * @export
 * @param {*} cursor
 * @returns {boolean} true if the value is a cursor
 */
export function isCursor(cursor: any): boolean {
  return typeof cursor === "function" && !!cursor[cursorObject];
}

/**
 * Returns if a cursor is functional.
 * A cursor is considered functional if it includes a function call.
 *
 * @export
 * @param {*} cursor
 * @returns {boolean}
 */
export function isFunctional(cursor: any): boolean {
  return getCursorObject(cursor).functional;
}

/**
 * Gets the path of a given cursor.
 *
 * @export
 * @param {*} cursor
 * @returns {CursorStep[]}
 */
export function getPath(cursor: any): CursorStep[] {
  return getCursorObject(cursor).path;
}

/**
 * Gets the string representation of a cursor.
 *
 * ```js
 * cursorToString($(data).users[0].find(u => u === "John").name)) // -> /users/0/find(...)/name
 * ```
 *
 * @export
 * @param {*} cursor
 * @returns {string}
 */
export function cursorToString(cursor: any): string {
  const info = getCursorObject(cursor);
  const str: string[] = [];
  for (const step of info.path.slice(1)) {
    if (step instanceof CursorCallStep) {
      str[str.length - 1] += "(...)";
    } else {
      str.push(String(step));
    }
  }
  return "/" + str.join("/");
}

/**
 * Returns if a cursor has a parent.
 *
 * @export
 * @param {*} cursor
 * @returns {boolean}
 */
export function hasParent(cursor: any): boolean {
  return !!getCursorObject(cursor).parent;
}

/**
 * Gets the parent of a cursor, or throws if none is available.
 *
 * @export
 * @template T
 * @param {T} cursor
 * @returns {T}
 */
export function getParent<T = any>(cursor: any): T {
  const parent = getCursorObject(cursor).parent;
  if (!parent) {
    throw new Error("cursor does not have a parent");
  }
  return parent.proxy;
}
