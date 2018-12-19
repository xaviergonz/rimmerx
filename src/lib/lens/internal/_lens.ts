import { update, _ } from "../../cursor";
import { devMode } from "../../devMode";
import { isLens, Lens, LensDef } from "../lens";

const fakeT = Symbol();
const fakeV = Symbol();
const fakeA = Symbol();

/**
 * Fake interface only used for typings.
 */
export interface LensTypes<T, V, A> {
  // fake, only for typings
  [fakeT]?: T;
  [fakeV]?: V;
  [fakeA]?: A;
}

export type ExtractLensT<L> = L extends LensTypes<infer T, any, any> ? T : never;
export type ExtractLensV<L> = L extends LensTypes<any, infer T, any> ? T : never;
export type ExtractLensA<L> = L extends LensTypes<any, any, infer T> ? T : never;

/**
 * A symbol used to access the lens administration object.
 */
export const lensObject = Symbol("lensObject");

/**
 * A lens administration object.
 */
export interface LensObject<T, V, A> {
  cursor$: T;
  lensDef: LensDef<V, A>;
  proxy: Lens<T, V, A>;

  dataSource?: T;
  withDataSource<R>(data: T, fn: () => R, writeOperation: boolean): R;
}

/**
 * Ensures that a value is a lens instance. Throws otherwise.
 *
 * @param {*} lensInstance
 */
export function ensureIsLens(lensInstance: any) {
  if (devMode) {
    if (!isLens(lensInstance)) {
      throw new Error("invalid lens");
    }
  }
}

/**
 * Proxy handler used by lenses.
 */
export const lensProxyHandler: ProxyHandler<LensObject<any, any, any>> = {
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
      return targetLensObj.withDataSource(
        _(targetLensObj.cursor$),
        () => {
          const ret = Reflect.get(lensDef.views, key);

          if (typeof ret === "function") {
            // view functions
            return (...args: any[]) => {
              return targetLensObj.withDataSource(
                _(targetLensObj.cursor$),
                () => {
                  return ret.apply(targetLensObj.proxy, args);
                },
                false
              );
            };
          } else {
            // view getters
            return ret;
          }
        },
        false
      );
    } else if (lensDef.actions && key in lensDef.actions) {
      // actions
      return (...args: any[]) => {
        let retVal;
        update(targetLensObj.cursor$, draftData => {
          return targetLensObj.withDataSource(
            draftData,
            () => {
              const action: (...args: any[]) => any = Reflect.get(lensDef.actions, key);
              retVal = action.apply(targetLensObj.proxy, args);
            },
            true
          );
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
export const lensDataProxyHandler: ProxyHandler<LensObject<any, any, any>> = {
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
