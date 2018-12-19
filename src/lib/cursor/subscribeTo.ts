import { Disposer } from "../utils";
import { broken, _ } from "./get";
import { getStoreObject } from "./internal/_cursor";

/**
 * Subscription listener callback.
 */
export type SubscriptionListener<T> = (newValue: T | typeof broken, oldValue: T | typeof broken) => void;

/**
 * Run a callback whenever the value the cursor points to changes.
 * If the cursor eventually becomes broken, then the `broken` symbol will be passed as new/old value.
 * Returns a disposer for disposal.
 *
 * @export
 * @template T
 * @param {T} cursor
 * @param {((newValue: T | typeof broken, oldValue: T | typeof broken) => void)} subscription
 * @returns {Disposer}
 */
export function subscribeTo<T>(cursor: T, subscription: SubscriptionListener<T>): Disposer {
  let currentValue = _(cursor);

  const store = getStoreObject(cursor);
  return store.subscribeToChanges(() => {
    const oldValue = currentValue;
    const newValue = _(cursor);
    currentValue = newValue;

    if (oldValue !== newValue) {
      subscription(newValue, oldValue);
    }
  });
}
