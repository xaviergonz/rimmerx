import { update, _ } from "./cursor";

export type Lens<T, LensDef> = T &
  LensDef & {
    readonly _: T; // orginal resolved value
    readonly $: T; // wrapped cursor
  };

export type LensConstructor<T, LensDef> = (cursor: T) => Lens<T, LensDef>;

export type LensDefConstructor<T, LensDef> = (data: T) => LensDef;

const lensObject = Symbol("lensObject");

interface LensObject<T, LensDef> {
  cursor$: T;
  lensDefConstructor: LensDefConstructor<T, LensDef>;
  proxy: Lens<T, LensDef>;
}

export function lens<T extends object, LensDef>(
  lensDefConstructor: LensDefConstructor<T, LensDef>
): LensConstructor<T, LensDef> {
  return cursor => {
    const lensObj: LensObject<T, LensDef> = {
      cursor$: cursor,
      lensDefConstructor,
      proxy: undefined as any
    };
    lensObj.proxy = new Proxy(lensObj, lensProxyHandler) as any;

    return lensObj.proxy;
  };
}

const lensProxyHandler: ProxyHandler<LensObject<any, any>> = {
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
      case "_":
        return _(targetLensObj.cursor$);
      case "$":
        return targetLensObj.cursor$;
      case lensObject:
        return targetLensObj;
    }

    const data = _(targetLensObj.cursor$);
    let lensDef = targetLensObj.lensDefConstructor(data);

    const pdesc = Object.getOwnPropertyDescriptor(lensDef, key);
    if (pdesc) {
      if (pdesc.get) {
        // a property
        return Reflect.get(lensDef, key);
      } else {
        // an action
        return (...args: any[]) => {
          let retVal;
          update(targetLensObj.cursor$, draftData => {
            lensDef = targetLensObj.lensDefConstructor(draftData);
            const action: (...args: any[]) => any = Reflect.get(lensDef, key);
            retVal = action.apply(targetLensObj.proxy, args);
          });
          return retVal;
        };
      }
    }

    return Reflect.get(data, key);
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
