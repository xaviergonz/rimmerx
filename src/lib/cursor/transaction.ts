import { lockTransaction, unlockTransaction } from "./internal/_transaction";

/**
 * Any updates done inside a transaction function won't trigger any subscriptions until it is finished.
 * Nested transactions are allowed. In this case subscriptions will trigger after the outermost transaction
 * is finished.
 *
 * @export
 * @param {() => void} fn
 */
export function transaction(fn: () => void): void {
  lockTransaction();
  try {
    fn();
  } finally {
    unlockTransaction();
  }
}
