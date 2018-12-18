/**
 * Symbol used to access the cursor administration object.
 */
export const cursorObject = Symbol("cursorObject");

/**
 * A cursor step (key access or function call).
 */
export type CursorStep = string | number | symbol | CursorCallStep;

/**
 * A cursor function call step.
 */
export class CursorCallStep {
  constructor(readonly ctx: any, readonly args: any) {}
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
 * Indicates that a cursor value could not be calculated since the selector is broken.
 */
export const broken = Symbol("broken");
