import { nothing } from "immer";
import { update } from "./update";

/**
 * Sets the cursor target to a given value.
 * Simplified version of `update`.
 *
 * @export
 * @template T
 * @param {T} cursor
 * @param {T} value
 */
export function set<T, TVal extends T>(cursor: T, value: TVal): void {
  update(cursor, () => (value === undefined ? nothing : value));
}
