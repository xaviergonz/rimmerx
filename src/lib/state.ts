/*const selectorSymbol = Symbol('selector');
interface SelectorInstance<T> {
  [selectorSymbol]: true;
  // tslint:disable-next-line:callable-types
  (): T;
}

type Primitive = number | string | undefined | null;

interface PrimitiveSelector<T extends Primitive> extends SelectorInstance<T> {}
type ObjectSelector<T extends {}> = {[k in keyof T]: Selector<T[k]>} & SelectorInstance<T>
interface ArraySelector<T> extends Array<Selector<T>> {}

export type Selector<T> = T extends Primitive ? PrimitiveSelector<T> : T extends Array<infer A> ? ArraySelector<A> : ObjectSelector<T>;

export function $<T>(data: T): Selector<T> {
  // TODO: would return the proxies thing
  return data as any;
}

const data = {users: [{name: "hoh"}]};
const data$ = $(data);

const users$ = data$.users;
const firstUser$ = users$[0];
const firstUser = firstUser$();

const firstUserName$ = firstUser$.name;
const firstUserName = firstUserName$();*/

/*import {produce} from "immer"

const isStoreSymbol = Symbol('store');

function isStore<T>(storeOrNot: any): storeOrNot is Store<T> {
  return isStoreSymbol in storeOrNot;
}

export interface Store<T extends object> {
  [isStoreSymbol]: true;
  data: T;
  lens<TData extends object, TLensDef extends object>(lensDefinition: (data: TData) => TLensDef): Lens<TData, TLensDef>;
}

export type Lens<TData extends object, TLensDef extends object> = (data: TData | Store<TData>) => TData & TLensDef;

export function store<T extends object>(initialState: T): Store<T> {
  let currentData = freezeData(initialState);

  return {
    [isStoreSymbol]: true,

    get data(): T {
      return currentData;
    },

    lens<TData extends object, TLensDef extends object>(lensDefinition: (data: TData) => TLensDef): Lens<TData, TLensDef> {
      // TODO: check that lensDefinition is a plain object


      return (data: TData | Store<TData>): TData & TLensDef => {
        // TODO: check that data is a plain object

        const realData = isStore(data) ? data.data : data;

        return {
          ...(lensDefinition(realData) as any),
          ...(realData as any),
        }
      }
    }
  }
}

interface S {
  x: number
}

const s = store<S>({x: 5})

const sl = s.lens((s2: S) => ({
  get x2(): number { return s2.x * 2 },
  setX(v: number): void {s2.x = this.x2 * v}
}))

const sll = sl(s)
sll.
*/
