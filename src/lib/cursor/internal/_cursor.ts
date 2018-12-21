import { Patch } from "immer";
import { devMode } from "../../devMode";
import { Disposer, freezeData } from "../../utils";
import { broken } from "../get";
import { CursorCallStep, CursorStep, CursorTransformStep, isCursor } from "../misc";

/**
 * Symbol used to access the cursor administration object.
 */
export const cursorObject = Symbol("cursorObject");

/**
 * A cursor administration object.
 */
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

export type SubscribeToChangesListener = (transactionId: number | undefined) => void;
export type SubscribeToPatchesListener = (
  transactionId: number | undefined,
  patches: Patch[],
  inversePatches: Patch[]
) => void;

/**
 * Root store administration object for a cursor.
 */
export interface StoreObject<T> {
  store: T;
  draftStore?: T;
  updateCancelled: boolean;
  nofChanges: number;

  subscribeToChanges(fn: SubscribeToChangesListener): Disposer;
  subscribeToPatches(fn: SubscribeToPatchesListener): Disposer;
  emitPatches(patches: Patch[], inversePatches: Patch[]): void;
}

/**
 * Ensures that a given value is a cursor.
 *
 * @param {*} cursor
 */
function ensureIsCursor(cursor: any) {
  if (devMode) {
    if (!isCursor(cursor)) {
      throw new Error("invalid cursor");
    }
  }
}

/**
 * Gets the administration object of the given cursor.
 * For internal use.
 *
 * @param {*} cursor
 * @returns {CursorObject}
 */
export function getCursorObject(cursor: any): CursorObject {
  ensureIsCursor(cursor);
  return cursor[cursorObject];
}

/**
 * Gets the store object of a given cursor.
 * For internal use.
 *
 * @param {*} cursor
 * @returns {*}
 */
export function getStoreObject<T = any>(cursor: any): StoreObject<T> {
  return getCursorObject(cursor).store;
}

/**
 * Creates a new cursor administration object based on another one and adds a step to it.
 *
 * @param {*} cursor
 * @param {CursorStep} step
 * @returns
 */
export function stepCursor(cursor: any, step: CursorStep): CursorObject {
  const cursorObj = getCursorObject(cursor);
  return newCursorObject(cursorObj.store, [...cursorObj.path, step], cursorObj);
}

/**
 * Executes a cursor to get the value it points to.
 *
 * @template T
 * @param {T} cursor
 * @param {boolean} safeMode
 * @param {boolean} draft
 * @returns {(T | typeof broken)}
 */
export function runCursor<T>(cursor: T, safeMode: boolean, draft: boolean): T | typeof broken {
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
    } else if (step instanceof CursorTransformStep) {
      value = step.transform(value);
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

/**
 * Creates a new cursor administration object.
 *
 * @param {StoreObject<any>} store
 * @param {CursorStep[]} path
 * @param {(CursorObject | undefined)} parentCursorObject
 * @returns {CursorObject}
 */
export function newCursorObject(
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

/**
 * Proxy handler used by cursors.
 */
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
    throw new Error("a cursor cannot be used to set a property");
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
