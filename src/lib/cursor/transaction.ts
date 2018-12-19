import { lockTransaction, unlockTransaction } from "./internal/_transaction";

/**
 * Any updates done inside a transaction function won't trigger any subscriptions until it is finished.
 * Nested transactions are allowed. In this case subscriptions will trigger after the outermost transaction
 * is finished.
 *
 * @export
 * @param {() => void} fn
 */
export function transaction<F extends () => any>(fn: F): ReturnType<F> {
  lockTransaction();
  try {
    return fn();
  } finally {
    unlockTransaction();
  }
}
