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
 * Run in action function definition.
 */
export type RunInAction = (fn: (...args: any) => any) => any;

/**
 * A constructor for lens definitions.
 */
export type LensDefConstructor<T, V, A> = (data: T, others: { runInAction: RunInAction }) => LensDef<V, A>;

/**
 * A symbol used to access the lens administration object.
 */
const lensObject = Symbol("lensObject");

/**
 * A lens administration object.
 */
interface LensObject<T, V, A> {
  cursor$: T;
  lensDef: LensDef<V, A>;
  proxy: Lens<T, V, A>;

  dataSource?: T;
  withDataSource<R>(data: T, fn: () => R): R;
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
      lensDef: undefined as any,
      proxy: undefined as any,

      dataSource: undefined,
      withDataSource(data, fn) {
        const previous = this.dataSource;
        try {
          this.dataSource = data;
          return fn();
        } finally {
          this.dataSource = previous;
        }
      }
    };

    lensObj.proxy = new Proxy(lensObj, lensProxyHandler) as any;

    const dataProxy = new Proxy(lensObj, lensDataProxyHandler) as any;
    const runInAction: RunInAction = fn => {
      let retVal;
      update(lensObj!.cursor$, draftData => {
        return lensObj!.withDataSource(draftData, () => {
          retVal = fn.apply(lensObj!.proxy);
        });
      });
      return retVal;
    };
    lensObj.lensDef = lensDefConstructor(dataProxy, { runInAction });

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

    // try to reused a previously generated lens definition
    const lensDef = targetLensObj.lensDef;

    if (lensDef.views && key in lensDef.views) {
      return targetLensObj.withDataSource(_(targetLensObj.cursor$), () => {
        const ret = Reflect.get(lensDef.views, key);

        if (typeof ret === "function") {
          // view functions
          return (...args: any[]) => {
            return targetLensObj.withDataSource(_(targetLensObj.cursor$), () => {
              return ret.apply(targetLensObj.proxy, args);
            });
          };
        } else {
          // view getters
          return ret;
        }
      });
    } else if (lensDef.actions && key in lensDef.actions) {
      // actions
      return (...args: any[]) => {
        let retVal;
        update(targetLensObj.cursor$, draftData => {
          return targetLensObj.withDataSource(draftData, () => {
            const action: (...args: any[]) => any = Reflect.get(lensDef.actions, key);
            retVal = action.apply(targetLensObj.proxy, args);
          });
        });
        return retVal;
      };
    } else {
      // get from the original object
      const data = _(targetLensObj.cursor$);
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

/**
 * Proxy handler used by lenses to get/set data.
 */
const lensDataProxyHandler: ProxyHandler<LensObject<any, any, any>> = {
  getPrototypeOf(targetLensObj) {
    return Reflect.getPrototypeOf(targetLensObj.dataSource);
  },
  setPrototypeOf(targetLensObj, proto) {
    return Reflect.setPrototypeOf(targetLensObj.dataSource, proto);
  },
  isExtensible(targetLensObj) {
    return Reflect.isExtensible(targetLensObj.dataSource);
  },
  preventExtensions(targetLensObj) {
    return Reflect.preventExtensions(targetLensObj.dataSource);
  },
  getOwnPropertyDescriptor(targetLensObj, p) {
    return Reflect.getOwnPropertyDescriptor(targetLensObj.dataSource, p);
  },
  has(targetLensObj, p) {
    return Reflect.has(targetLensObj.dataSource, p);
  },
  get(targetLensObj, key) {
    return Reflect.get(targetLensObj.dataSource, key);
  },
  set(targetLensObj, p, val, receiver) {
    return Reflect.set(targetLensObj.dataSource, p, val, receiver);
  },
  deleteProperty(targetLensObj, p) {
    return Reflect.deleteProperty(targetLensObj.dataSource, p);
  },
  defineProperty(targetLensObj, p, attr) {
    return Reflect.defineProperty(targetLensObj.dataSource, p, attr);
  },
  enumerate(targetLensObj) {
    return Reflect.enumerate(targetLensObj.dataSource) as any;
  },
  ownKeys(targetLensObj) {
    return Reflect.ownKeys(targetLensObj.dataSource);
  },
  apply(targetLensObj, thisArg, args) {
    return Reflect.apply(targetLensObj.dataSource, thisArg, args);
  },
  construct(targetLensObj, args, newTarget) {
    return Reflect.construct(targetLensObj.dataSource, args, newTarget);
  }
};
