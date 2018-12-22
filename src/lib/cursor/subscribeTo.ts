import { Disposer } from "../utils";
import { broken, _safe } from "./get";
import { getStoreObject } from "./internal/_cursor";
import { onTransactionFinished } from "./internal/_transaction";

/**
 * Subscription change event.
 */
export interface CursorChange<T = any> {
  readonly cursor: any;
  readonly changed: boolean;
  readonly newValue: T | typeof broken;
  readonly oldValue: T | typeof broken;
  readonly transactionId: number | undefined;
}

export type CursorsToCursorChanges<Ts extends any[]> = { [k in keyof Ts]: CursorChange<Ts[k]> };

/**
 * Subscription listener callback.
 */
export type SubscribeToManyListener<Ts extends any[]> = (changes: CursorsToCursorChanges<Ts>) => void;

/**
 * Subscription listener callback.
 */
export type SubscribeToListener<T> = (change: CursorChange<T>) => void;

/**
 * Run a callback whenever the value the cursor points to changes.
 * If the cursor eventually becomes broken, then the `broken` symbol will be passed as new/old value.
 * Returns a disposer for disposal.
 * If you need to subscribe to multiple cursors at once consider using `subscribeToMany`.
 *
 * @export
 * @template T
 * @param {T} cursor
 * @param {SubscribeToListener<T>} subscription
 * @returns {Disposer}
 */
export function subscribeTo<T>(cursor: T, subscription: SubscribeToListener<T>): Disposer {
  return subscribeToMany([cursor], ([change]) => subscription(change));
}

/**
 * Run a callback whenever the value the cursors point to change.
 * If the cursor eventually becomes broken, then the `broken` symbol will be passed as new/old value.
 * In the case of passing multiple cursors one or more change events might have its `changed` property set to false
 * to indicate that particular cursor value did not change.
 * Returns a disposer for disposal.
 * If you need to subscribe to a single cursor consider using `subscribeTo`.
 *
 * @export
 * @template Ts
 * @param {Ts} cursors
 * @param {SubscribeToManyListener<Ts>} subscription
 * @returns {Disposer}
 */
export function subscribeToMany<Ts extends any[]>(cursors: Ts, subscription: SubscribeToManyListener<Ts>): Disposer {
  const nofCursors = cursors.length;
  if (nofCursors <= 0) {
    return () => {
      // empty
    };
  }

  const disposers: Disposer[] = [];
  const currentChanges: { [k: number]: CursorChange<any> } = {};
  let someChanged = false;

  cursors.forEach((cursor, i) => {
    // initialization
    {
      const currentValue = _safe(cursor);
      currentChanges[i] = {
        cursor,
        changed: false,
        oldValue: currentValue,
        newValue: currentValue,
        transactionId: undefined
      };
    }

    // subscription
    const store = getStoreObject(cursor);
    disposers.push(
      store.subscribeToChanges(transactionId => {
        const oldValue = currentChanges[i].oldValue;
        const newValue = _safe(cursor);

        if (oldValue !== newValue) {
          someChanged = true;
          currentChanges[i] = {
            cursor,
            changed: true,
            oldValue,
            newValue,
            transactionId
          };
        }
      })
    );
  });

  const emitChanges = () => {
    if (!someChanged) {
      return;
    }

    // at least one changed
    const currentChangesArray: CursorChange<any>[] = [];
    for (let i = 0; i < nofCursors; i++) {
      const currentChange = currentChanges[i];
      currentChangesArray[i] = currentChange;
      currentChanges[i] = {
        cursor: currentChange.cursor,
        oldValue: currentChange.newValue, // new value becomes the old one
        newValue: currentChange.newValue,
        changed: false,
        transactionId: undefined
      };
    }
    someChanged = false;

    subscription(currentChangesArray as any);
  };

  const transactionFinishedDisposer = onTransactionFinished(() => {
    emitChanges();
  });

  return () => {
    disposers.forEach(d => d());
    transactionFinishedDisposer();
  };
}
