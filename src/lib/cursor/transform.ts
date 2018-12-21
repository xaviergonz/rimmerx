import { getCursorObject, stepCursor } from "./internal/_cursor";
import { CursorTransformStep } from "./misc";

/**
 * Creates a new cursor which applies a transformation over another cursor.
 *
 * @export
 * @template T
 * @template TRet
 * @param {T} cursor
 * @param {(value: T) => TRet} transformFn
 * @returns {TRet}
 */
export function transform<T, TRet>(cursor: T, transformFn: (value: T) => TRet): TRet {
  const targetCursorObj = getCursorObject(cursor);
  return stepCursor(targetCursorObj.proxy, new CursorTransformStep(transformFn)).proxy;
}
