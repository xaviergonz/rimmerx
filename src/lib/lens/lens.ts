import { subscribeTo, SubscriptionListener, transaction, update, _ } from "../cursor";
import { Disposer } from "../utils";
import {
  ensureIsLens,
  ExtractLensA,
  ExtractLensT,
  ExtractLensV,
  lensDataProxyHandler,
  LensObject,
  lensObject,
  lensProxyHandler,
  LensTypes
} from "./internal/_lens";

/**
 * An instantiated lens.
 */
export type Lens<T, V, A> = T & V & A & LensTypes<T, V, A>;

export type AnyLens = Lens<any, any, any>;

/**
 * A lens instance constructor.
 */
export type LensConstructor<T, V, A> = (cursor: T) => Lens<T, V, A>;

/**
 * A lens definition object.
 */
export interface LensDef<V, A> {
  views?: V;
  actions?: A;
}

/**
 * Run in action function definition.
 */
export type RunInAction = <F extends () => any>(fn: F) => ReturnType<F>;

/**
 * A constructor for lens definitions.
 */
export type LensDefConstructor<T, V, A> = (data: T, others: { runInAction: RunInAction }) => LensDef<V, A>;

/**
 * Gets the adiministration object of a lens instance.
 *
 * @template L
 * @param {L} lensInstance
 * @returns {LensObject<ExtractLensT<L>, ExtractLensV<L>, ExtractLensA<L>>}
 */
function getLensObject<L extends AnyLens>(
  lensInstance: L
): LensObject<ExtractLensT<L>, ExtractLensV<L>, ExtractLensA<L>> {
  ensureIsLens(lensInstance);
  return lensInstance[lensObject];
}

/**
 * Returns if a value is a lens.
 *
 * @export
 * @template T
 * @template V
 * @template A
 * @param {*} lensInstance
 * @returns {lensInstance is Lens<T, V, A>}
 */
export function isLens<T = any, V = any, A = any>(lensInstance: any): lensInstance is Lens<T, V, A> {
  return typeof lens === "function" && !!lensInstance[lensObject];
}

/**
 * Returns the cursor a lens instance is using internally.
 *
 * @export
 * @template L
 * @param {L} lensInstance
 * @returns {ExtractLensT<L>}
 */
export function getLensCursor<L extends AnyLens>(lensInstance: L): ExtractLensT<L> {
  return getLensObject(lensInstance).cursor$;
}

/**
 * Gets the data a lens instance is pointing to through its cursor.
 *
 * @export
 * @template L
 * @param {L} lensInstance
 * @returns {ExtractLensT<L>}
 */
export function getLensData<L extends AnyLens>(lensInstance: L): ExtractLensT<L> {
  return _(getLensCursor(lensInstance));
}

/**
 * Given a lens definition it generates a function (lens) that can be applied
 * over cursors to read/manipulate its value in an easier way.
 *
 * @export
 * @template T
 * @template V
 * @template A
 * @param {LensDefConstructor<T, V, A>} lensDefConstructor
 * @returns {LensConstructor<T, V, A>}
 */
export function lens<T extends object, V, A>(
  lensDefConstructor: LensDefConstructor<T, V, A>
): LensConstructor<T, V, A> {
  const cachedLenses = new WeakMap<any, LensObject<T, V, A>>();

  return cursor => {
    let lensObj: LensObject<T, V, A> | undefined = cachedLenses.get(cursor);
    if (lensObj) {
      return lensObj.proxy;
    }

    lensObj = {
      cursor$: cursor,
      lensDef: undefined as any,
      proxy: undefined as any,

      dataSource: undefined,
      withDataSource(data, fn, writeOperation) {
        const previous = this.dataSource;
        try {
          this.dataSource = data;
          if (writeOperation) {
            return transaction(fn);
          } else {
            return fn();
          }
        } finally {
          this.dataSource = previous;
        }
      }
    };

    lensObj.proxy = new Proxy(lensObj, lensProxyHandler) as any;

    const dataProxy = new Proxy(lensObj, lensDataProxyHandler) as any;
    const runInAction = (fn: () => any): any => {
      let retVal;
      update(lensObj!.cursor$, draftData => {
        return lensObj!.withDataSource(
          draftData,
          () => {
            retVal = fn.apply(lensObj!.proxy);
          },
          true
        );
      });
      return retVal;
    };
    lensObj.lensDef = lensDefConstructor(dataProxy, { runInAction });

    cachedLenses.set(cursor, lensObj);

    return lensObj.proxy;
  };
}

/**
 * Run a callback whenever the value the lens inner cursor points to changes.
 * If the cursor eventually becomes broken, then the `broken` symbol will be passed as new/old value.
 * Returns a disposer for disposal.
 *
 * @export
 * @template L
 * @param {L} lensInstance
 * @param {((newValue: ExtractLensT<L> | typeof broken, oldValue: ExtractLensT<L> | typeof broken) => void)} subscription
 * @returns {Disposer}
 */
export function subscribeToLens<L extends AnyLens>(
  lensInstance: L,
  subscription: SubscriptionListener<ExtractLensT<L>>
): Disposer {
  const cursor = getLensCursor(lensInstance);
  return subscribeTo(cursor, subscription);
}
