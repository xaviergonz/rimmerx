import { update, _ } from "./cursor";
import { devMode } from "./devMode";

/**
 * An instantiated lens.
 */
export type Lens<T, V, A> = T &
  V &
  A & {
    readonly _: T; // orginal resolved value
    readonly $: T; // wrapped cursor
  };

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
 * A constructor for lens definitions.
 */
export type LensDefConstructor<T, V, A> = (data: T) => LensDef<V, A>;

/**
 * A symbol used to access the lens administration object.
 */
const lensObject = Symbol("lensObject");

/**
 * A lens administration object.
 */
interface LensObject<T, V, A> {
  cursor$: T;
  lensDefConstructor: LensDefConstructor<T, V, A>;
  proxy: Lens<T, V, A>;

  memoizedLensDef?: {
    data: T;
    lensDef: LensDef<V, A>;
  };
}

/**
 * Ensures that a value is a lens instance. Throws otherwise.
 *
 * @param {*} lensInstance
 */
function ensureIsLens(lensInstance: any) {
  if (devMode) {
    if (!isLens(lensInstance)) {
      throw new Error("invalid lens");
    }
  }
}

/**
 * Gets the adiministration object of a lens instance.
 *
 * @param {*} lensInstance
 * @returns {LensObject<any, any, any>}
 */
function getLensObject(lensInstance: any): LensObject<any, any, any> {
  ensureIsLens(lensInstance);
  return lensInstance[lensObject];
}

/**
 * Returns if a value is a lens.
 *
 * @export
 * @param {*} lensInstance
 * @returns {boolean} true if the value is a lens.
 */
export function isLens(lensInstance: any): lensInstance is Lens<any, any, any> {
  return typeof lens === "function" && !!lensInstance[lensObject];
}

/**
 * Returns the cursor a lens instance is using internally.
 *
 * @export
 * @template T
 * @param {T} lensInstance
 * @returns {T}
 */
export function getLensCursor<T>(lensInstance: Lens<T, any, any>): T {
  return getLensObject(lensInstance).cursor$;
}

/**
 * Gets the data a lens instance is pointing to through its cursor.
 *
 * @export
 * @template T
 * @param {Lens<T, any, any>} lensInstance
 * @returns {T}
 */
export function getLensData<T>(lensInstance: Lens<T, any, any>): T {
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
      lensDefConstructor,
      proxy: undefined as any
    };
    lensObj.proxy = new Proxy(lensObj, lensProxyHandler) as any;

    cachedLenses.set(cursor, lensObj);

    return lensObj.proxy;
  };
}

/**
 * Proxy handler used by lenses.
 */
const lensProxyHandler: ProxyHandler<LensObject<any, any, any>> = {
  // getPrototypeOf: let it go for instanceof checks
  setPrototypeOf() {
    throw new Error("a lens cannot be used to set a prototype");
  },
  isExtensible() {
    return false;
  },
  preventExtensions() {
    return true;
  },
  getOwnPropertyDescriptor(targetLensObj, p) {
    // we override configurable since else object keys and other methods
    // will throw an exception when the original is not configurable
    return { ...Reflect.getOwnPropertyDescriptor(_(targetLensObj.cursor$), p), configurable: true };
  },
  has(targetLensObj, p) {
    return Reflect.has(_(targetLensObj.cursor$), p);
  },
  get(targetLensObj, key) {
    switch (key) {
      case lensObject:
        return targetLensObj;
    }

    const data = _(targetLensObj.cursor$);

    // try to reused a previously generated lens definition
    let lensDef: LensDef<any, any>;
    if (targetLensObj.memoizedLensDef && targetLensObj.memoizedLensDef.data === data) {
      lensDef = targetLensObj.memoizedLensDef.lensDef;
    } else {
      lensDef = targetLensObj.lensDefConstructor(data);
      targetLensObj.memoizedLensDef = {
        data,
        lensDef
      };
    }

    if (lensDef.views && key in lensDef.views) {
      return Reflect.get(lensDef.views, key);
    } else if (lensDef.actions && key in lensDef.actions) {
      return (...args: any[]) => {
        let retVal;
        update(targetLensObj.cursor$, draftData => {
          lensDef = targetLensObj.lensDefConstructor(draftData);
          const action: (...args: any[]) => any = Reflect.get(lensDef.actions, key);
          retVal = action.apply(lensDef.actions, args);
        });
        return retVal;
      };
    } else {
      return Reflect.get(data, key);
    }
  },
  set() {
    throw new Error("a lens cannot be used to set a property");
  },
  deleteProperty() {
    throw new Error("a lens cannot be used to delete a property");
  },
  defineProperty() {
    throw new Error("a lens cannot be used to define a property");
  },
  enumerate(targetLensObj) {
    return Reflect.enumerate(_(targetLensObj.cursor$)) as any;
  },
  ownKeys(targetLensObj) {
    return Reflect.ownKeys(_(targetLensObj.cursor$));
  },
  apply() {
    throw new Error("a lens is not a callable function");
  },
  construct() {
    throw new Error("a lens cannot be used to construct an object");
  }
};
