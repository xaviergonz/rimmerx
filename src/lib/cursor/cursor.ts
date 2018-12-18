import { nothing, PatchListener, produce } from "immer";
import { Disposer, freezeData } from "../utils";
import { broken, CursorCallStep, CursorStep } from "./cursorShared";
import { emitCursorAccess } from "./onCursorAccess";
import { isRollbackUpdate } from "./rollbackUpdate";
import { getCursorObject, getStoreObject, newCursorObject, runCursor, StoreObject } from "./_cursor";

export { nothing, Patch, PatchListener } from "immer";

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
 * Creates a new store cursor.
 *
 * @export
 * @template T
 * @param (T} data
 * @returns {T}
 */
export function createStore<T>(data: T): T {
  let currentStoreRoot = freezeData(data);
  let nofChanges = 0;
  const changeListeners: Set<() => void> = new Set();
  const patchListeners: Set<PatchListener> = new Set();

  const storeObject: StoreObject<T> = {
    get store() {
      return currentStoreRoot;
    },
    set store(newStore) {
      if (newStore === currentStoreRoot) {
        return;
      }

      nofChanges++;
      currentStoreRoot = freezeData(newStore);
      changeListeners.forEach(s => s());
    },

    draftStore: undefined,
    updateCancelled: false,

    get nofChanges() {
      return nofChanges;
    },

    subscribeToChanges(fn) {
      changeListeners.add(fn);
      return () => {
        changeListeners.delete(fn);
      };
    },

    subscribeToPatches(fn) {
      patchListeners.add(fn);
      return () => {
        patchListeners.delete(fn);
      };
    },

    emitPatches(patches, inversePatches) {
      patchListeners.forEach(l => {
        l(patches, inversePatches);
      });
    }
  };

  return newCursorObject(storeObject, [], undefined).proxy.store;
}

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
  emitCursorAccess({ cursor, value });
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
  emitCursorAccess({ cursor, value });
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

/**
 * Updates the value/values a cursor points to.
 *
 * Similar to `immer`'s `produce` method:
 * - to modify an object either:
 *   - do mutable operations over the object
 *   - or return the new value (remember that `nothing` must be returned if the new value should be `undefined`),
 *     but in this cases it is usally easier just to use the `set` function.
 * See `immer` docs for more info.
 *
 * If any error is thrown in the middle of an update process then the update
 * will be cancelled and therefore not changes won't be commited.
 *
 * If you want to rollback without actually generating an error then use `throw rollbackUpdate`.
 *
 * @export
 * @template T
 * @param {T} cursor
 * @param {((draft: T) => T | void)} recipe
 */
export function update<T>(cursor: T, recipe: (draft: T) => T | void): void {
  const storeObj = getStoreObject(cursor);

  const updateDraftStore = () => {
    try {
      const draftTarget = runCursor(cursor, false, true) as T;

      let newValue = recipe(draftTarget);

      // replace value in place case
      if (newValue !== undefined) {
        if (newValue === nothing) {
          newValue = undefined;
        }
        const parentCursor = getParent(cursor);
        const draftParentTarget = runCursor(parentCursor, false, true);
        const path = getPath(cursor);
        const key = path[path.length - 1];
        draftParentTarget[key as any] = newValue;
      }
    } catch (err) {
      storeObj.updateCancelled = true;
      if (!isRollbackUpdate(err)) {
        throw err;
      }
    }
  };

  if (storeObj.draftStore) {
    // already updating, reuse the draft until finished
    updateDraftStore();
  } else {
    const oldStoreRoot = storeObj.store;

    const emitPatchesIfNotCancelled: PatchListener = (patches, inversePatches) => {
      if (!storeObj.updateCancelled) {
        storeObj.emitPatches(patches, inversePatches);
      }
    };

    try {
      const newStoreRoot = produce(
        oldStoreRoot,
        draftStoreRoot => {
          storeObj.draftStore = draftStoreRoot;
          updateDraftStore();
        },
        emitPatchesIfNotCancelled
      );

      if (!storeObj.updateCancelled) {
        storeObj.store = newStoreRoot;
      }
    } finally {
      storeObj.draftStore = undefined;
      storeObj.updateCancelled = false;
    }
  }
}

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

/**
 * Run a callback whenever a store generates a set of patches / inverse patches as result of a change.
 * Note that subscriptions can only be made over root cursors (the cursor returned as result of `createStore`).
 * See `immer`'s `produce` method for details.
 *
 * @export
 * @param {*} rootCursor
 * @param {PatchListener} patchListener
 * @returns {Disposer}
 */
export function subscribeToPatches(rootCursor: any, patchListener: PatchListener): Disposer {
  const cursorObj = getCursorObject(rootCursor);
  if (cursorObj.path.length !== 1) {
    throw new Error("patch subscription can only be done on root cursors");
  }

  const store = getStoreObject(rootCursor);
  return store.subscribeToPatches(patchListener);
}
