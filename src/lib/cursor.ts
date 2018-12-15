import { nothing, produce } from "immer";
import { devMode } from "./devMode";
import { freezeData } from "./utils";

export interface CursorObject {
  store: any;
  path: CursorStep[];
  parent?: CursorObject;
  proxy: any;
  readonly: boolean;

  cache: Map<CursorStep, CursorObject>;
}

export type CursorStep = string | number | symbol | CursorCallStep;

export class CursorCallStep {
  constructor(readonly ctx: any, readonly args: any) {}
}

interface Store<T> {
  store: T;

  subscribe(fn: () => void): Disposer;
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
 * Gets the root store of a given cursor.
 *
 * @export
 * @param {*} cursor
 * @returns {*}
 */
export function getStore<T = any>(cursor: any): Store<T> {
  return getCursorObject(cursor).store;
}

/**
 * Returns if a cursor is readonly.
 * A cursor is considered readonly if it includes a function call.
 *
 * @export
 * @param {*} cursor
 * @returns {boolean}
 */
export function isReadonly(cursor: any): boolean {
  return getCursorObject(cursor).readonly;
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
 * cursorToString($(data).users[0].find(u => u === "John").name)) // -> root/users/0/find(...)/name
 * ```
 *
 * @export
 * @param {*} cursor
 * @returns {string}
 */
export function cursorToString(cursor: any): string {
  const info = getCursorObject(cursor);
  const str: string[] = [];
  for (const step of info.path) {
    if (step instanceof CursorCallStep) {
      str[str.length - 1] += "(...)";
    } else {
      str.push(String(step));
    }
  }
  return str.join("/");
}

function stepCursor(cursor: any, step: CursorStep) {
  const cursorObj = getCursorObject(cursor);
  return newCursorObject(cursorObj.store, [...cursorObj.path, step], cursorObj);
}

function runCursor(cursor: any, stopAtUndefinedOrNull: boolean, store?: any) {
  const cursorObj = getCursorObject(cursor);
  let value = store || cursorObj.store;

  for (const step of cursorObj.path) {
    if (stopAtUndefinedOrNull && (value === undefined || value === null)) {
      return broken;
    }
    if (step instanceof CursorCallStep) {
      const targetThis = isCursor(step.ctx) ? _(step.ctx) : step.ctx;
      value = value.apply(targetThis, step.args);
    } else {
      value = value[step];
    }
  }
  return value;
}

function newCursorObject(store: any, path: CursorStep[], parentCursorObject: CursorObject | undefined): CursorObject {
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

  let readonly: boolean = false;
  if (parentCursorObject) {
    readonly = parentCursorObject.readonly || lastStep instanceof CursorCallStep;
  }

  cursor.store = store;
  cursor.path = freezeData(path);
  cursor.parent = parentCursorObject;
  cursor.proxy = new Proxy(cursor as any, cursorProxyHandler);
  cursor.readonly = readonly;
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
    return false;
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
  let currentData = freezeData(data);
  const subscriptions: Set<() => void> = new Set();

  const storeObject: Store<T> = {
    get store() {
      return currentData;
    },
    set store(newStore: T) {
      if (newStore === currentData) {
        return;
      }
      currentData = freezeData(newStore);
      subscriptions.forEach(s => s());
    },
    subscribe(fn: () => void): Disposer {
      subscriptions.add(fn);
      return () => {
        subscriptions.delete(fn);
      };
    }
  };

  return newCursorObject(storeObject, [], undefined).proxy.store;
}

/**
 * Executes a cursor query, returning its result.
 *
 * @export
 * @template T
 * @param {T} cursor
 * @returns {T}
 */
export function _<T>(cursor: T): T {
  return runCursor(cursor, false);
}

export const broken = Symbol("broken");

/**
 * Executes a cursor query, returning its result, or broken if at some part of the evalution the value in the middle is undefined/null.
 *
 * @export
 * @template T
 * @param {T} cursor
 * @returns {(T | typeof broken)}
 */
export function _safe<T>(cursor: T): T | typeof broken {
  return runCursor(cursor, true);
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
 * See `immer`'s `produce` method.
 *
 * @export
 * @template T
 * @param {T} cursor
 * @param {((draft: T) => T | void)} recipe
 */
export function update<T>(cursor: T, recipe: (draft: T) => T | void): void {
  if (isReadonly(cursor)) {
    throw new Error("cannot update a readonly cursor - does the cursor include a function call?");
  }

  const storeObj = getStore(cursor);
  storeObj.store = produce(storeObj.store, draftStoreRoot => {
    const draftStore = {
      store: draftStoreRoot
    };

    const draftTarget = runCursor(cursor, false, draftStore);

    let newValue: any = recipe(draftTarget);

    // replace value in place case
    if (newValue !== undefined) {
      if (newValue === nothing) {
        newValue = undefined;
      }
      const parentCursor = getParent(cursor);
      const draftParentTarget = runCursor(parentCursor, false, draftStore);
      const path = getPath(cursor);
      const key = path[path.length - 1];
      draftParentTarget[key as any] = newValue;
    }
  });
}

export type Disposer = () => void;

export function subscribe<T>(
  cursor: T,
  subscription: (newValue: T | typeof broken, oldValue: T | typeof broken) => void
): Disposer {
  let currentValue = _(cursor);

  const store = getStore(cursor);
  return store.subscribe(() => {
    const oldValue = currentValue;
    const newValue = _(cursor);
    currentValue = newValue;

    if (oldValue !== newValue) {
      subscription(newValue, oldValue);
    }
  });
}
