import { update, _ } from "./cursor";

export type Lens<T, V, A> = T &
  V &
  A & {
    readonly _: T; // orginal resolved value
    readonly $: T; // wrapped cursor
  };

export type LensConstructor<T, V, A> = (cursor: T) => Lens<T, V, A>;

export interface LensDef<V, A> {
  views?: V;
  actions?: A;
}

export type LensDefConstructor<T, V, A> = (data: T) => LensDef<V, A>;

const lensObject = Symbol("lensObject");

interface LensObject<T, V, A> {
  cursor$: T;
  lensDefConstructor: LensDefConstructor<T, V, A>;
  proxy: Lens<T, V, A>;

  memoizedLensDef?: {
    data: T;
    lensDef: LensDef<V, A>;
  };
}

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
      case "_":
        return _(targetLensObj.cursor$);
      case "$":
        return targetLensObj.cursor$;
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
