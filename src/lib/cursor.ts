import { nothing, Patch, PatchListener, produce } from "immer";
import { devMode } from "./devMode";
import { freezeData } from "./utils";
export { nothing, Patch, PatchListener } from "immer";

export interface CursorObject {
  store: StoreObject<any>;
  path: CursorStep[];
  parent?: CursorObject;
  proxy: any;
  functional: boolean;

  memoizedValue?: {
    lastChange: number;
    result: any;
  };

  safeMemoizedValue?: {
    lastChange: number;
    result: any;
  };

  cache: Map<CursorStep, CursorObject>;
}

export type CursorStep = string | number | symbol | CursorCallStep;

export class CursorCallStep {
  constructor(readonly ctx: any, readonly args: any) {}
}

export type Disposer = () => void;

interface StoreObject<T> {
  store: T;
  draftStore?: T;
  updateCancelled: boolean;
  nofChanges: number;

  subscribeToChanges(fn: () => void): Disposer;
  subscribeToPatches(fn: PatchListener): Disposer;
  emitPatches(patches: Patch[], inversePatches: Patch[]): void;
}

const cursorObject = Symbol("cursorObject");

function ensureIsCursor(cursor: any) {
  if (devMode) {
    if (!isCursor(cursor)) {
      throw new Error("invalid cursor");
    }
  }
}

/**
 * Gets info about the given cursor.
 *
 * @export
 * @param {*} cursor
 * @returns {CursorObject}
 */
function getCursorObject(cursor: any): CursorObject {
  ensureIsCursor(cursor);
  return cursor[cursorObject];
}

/**
 * Gets the store object of a given cursor.
 *
 * @export
 * @param {*} cursor
 * @returns {*}
 */
function getStoreObject<T = any>(cursor: any): StoreObject<T> {
  return getCursorObject(cursor).store;
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
 * Returns if a value is a cursor.
 *
 * @export
 * @param {*} cursor
 * @returns {cursor is CursorObject} true if the value is a cursor
 */
export function isCursor(cursor: any): boolean {
  return typeof cursor === "function" && !!cursor[cursorObject];
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

function stepCursor(cursor: any, step: CursorStep) {
  const cursorObj = getCursorObject(cursor);
  return newCursorObject(cursorObj.store, [...cursorObj.path, step], cursorObj);
}

function runCursor<T>(cursor: T, safeMode: boolean, draft: boolean): T | typeof broken {
  const cursorObj = getCursorObject(cursor);
  const store = cursorObj.store;

  if (!draft) {
    // value caching is not available while we are in the middle of an update
    // since values become mutable
    const oldMemoizedValue = safeMode ? cursorObj.safeMemoizedValue : cursorObj.memoizedValue;
    if (oldMemoizedValue && oldMemoizedValue.lastChange === store.nofChanges) {
      return oldMemoizedValue.result;
    }
  }

  let value: any = store;

  let index = 0;
  for (let step of cursorObj.path) {
    if (draft && index === 0) {
      step = "draftStore";
    }

    if (safeMode && (value === undefined || value === null)) {
      return broken;
    }
    if (step instanceof CursorCallStep) {
      const targetThis = isCursor(step.ctx) ? runCursor(step.ctx, safeMode, draft) : step.ctx;
      value = value.apply(targetThis, step.args);
    } else {
      value = value[step];
    }
    index++;
  }

  if (!draft) {
    const newMemoizedValue = {
      lastChange: store.nofChanges,
      result: value
    };
    if (!safeMode) {
      cursorObj.memoizedValue = newMemoizedValue;
    } else {
      cursorObj.safeMemoizedValue = newMemoizedValue;
    }
  }

  return value;
}

function newCursorObject(
  store: StoreObject<any>,
  path: CursorStep[],
  parentCursorObject: CursorObject | undefined
): CursorObject {
  const lastStep = !parentCursorObject ? undefined : path[path.length - 1];

  // try the cache first
  // this will automatically work properly for call steps,
  // since they will be different instances and never share the same cache bucket
  const cachedCursor = parentCursorObject && parentCursorObject.cache.get(lastStep!);
  if (cachedCursor) {
    return cachedCursor;
  }

  function cursor() {
    // do nothing, this is just to keep the proxy happy when invoking functions
  }

  let functional: boolean = false;
  if (parentCursorObject) {
    functional = parentCursorObject.functional || lastStep instanceof CursorCallStep;
  }

  cursor.store = store;
  cursor.path = freezeData(path);
  cursor.parent = parentCursorObject;
  cursor.proxy = new Proxy(cursor as any, cursorProxyHandler);
  cursor.functional = functional;
  cursor.cache = new Map();

  if (parentCursorObject) {
    parentCursorObject.cache.set(lastStep!, cursor);
  }

  return cursor;
}

const cursorProxyHandler: ProxyHandler<CursorObject> = {
  // getPrototypeOf: let it go for instanceof checks
  setPrototypeOf() {
    throw new Error("a cursor cannot be used to set a prototype");
  },
  isExtensible() {
    return false;
  },
  preventExtensions() {
    return true;
  },
  getOwnPropertyDescriptor() {
    throw new Error("a cursor cannot be used to get a property descriptor");
  },
  has() {
    throw new Error("a cursor cannot be used to check if a property is present");
  },
  get(targetCursorObj, key) {
    if (key === cursorObject) {
      return targetCursorObj;
    }
    return stepCursor(targetCursorObj.proxy, key).proxy;
  },
  set() {
    throw new Error("a cursor cannot be used to set a value");
  },
  deleteProperty() {
    throw new Error("a cursor cannot be used to delete a property");
  },
  defineProperty() {
    throw new Error("a cursor cannot be used to define a property");
  },
  enumerate() {
    throw new Error("a cursor cannot be used to enumerate properties");
  },
  ownKeys() {
    throw new Error("a cursor cannot be used to enumerate keys");
  },
  apply(targetCursorObj, ctx, args) {
    return stepCursor(targetCursorObj.proxy, new CursorCallStep(ctx, args)).proxy;
  },
  construct() {
    throw new Error("a cursor cannot be used to construct an object");
  }
};

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
  return runCursor(cursor, false, false) as T;
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
 * Indicates that a cursor value could not be calculated since the selector is broken.
 */
export const broken = Symbol("broken");

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
  return runCursor(cursor, true, false);
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

export interface UpdateOperations {
  cancel(): void;
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
 * @export
 * @template T
 * @param {T} cursor
 * @param {((draft: T, operations: UpdateOperations) => T | void)} recipe
 */
export function update<T>(cursor: T, recipe: (draft: T, operations: UpdateOperations) => T | void): void {
  const storeObj = getStoreObject(cursor);

  const operations: UpdateOperations = {
    cancel() {
      storeObj.updateCancelled = true;
    }
  };

  const updateDraftStore = () => {
    const draftTarget = runCursor(cursor, false, true) as T;

    let newValue = recipe(draftTarget, operations);

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
  };

  if (storeObj.draftStore) {
    // TODO: choose which is the right approach
    // already updating, reuse the draft until finished
    // updateDraftStore();
    throw new Error("nested updates are not allowed");
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
 * Run a callback whenver the value the cursor points to changes.
 * If the cursor eventually becomes broken, then the `broken` symbol will be passed as new/old value.
 * Returns a disposer for disposal.
 *
 * @export
 * @template T
 * @param {T} cursor
 * @param {((newValue: T | typeof broken, oldValue: T | typeof broken) => void)} subscription
 * @returns {Disposer}
 */
export function subscribeTo<T>(
  cursor: T,
  subscription: (newValue: T | typeof broken, oldValue: T | typeof broken) => void
): Disposer {
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
