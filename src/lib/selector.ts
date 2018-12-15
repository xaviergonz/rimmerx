import { devMode } from "./devMode";
import { freezeData } from "./utils";

const internalSelector = Symbol("internalSelector");

/**
 * Returns if a value is a selector.
 *
 * @export
 * @param {*} selector
 * @returns {selector is Selector} true if the value is a selector
 */
export function isSelector(selector: any): selector is Selector {
  return typeof selector === "function" && !!selector[internalSelector];
}

/**
 * Gets the string representation of a selector.
 *
 * ```js
 * selectorToString($(data).users[0].find(u => u === "John").name)) // -> [root]/users/0/find(...)/name
 * ```
 *
 * @export
 * @param {*} selector
 * @returns {string}
 */
export function selectorToString(selector: any): string {
  const info = getSelectorInfo(selector);
  const str: string[] = ["[root]"];
  for (const step of info.path) {
    if (step instanceof SelectorCallStep) {
      str[str.length - 1] += "(...)";
    } else {
      str.push(String(step));
    }
  }
  return str.join("/");
}

/**
 * Returns info (target, path) about a given selector.
 *
 * @export
 * @param {*} selector
 * @returns {SelectorInfo}
 */
export function getSelectorInfo(selector: any): SelectorInfo {
  ensureIsSelector(selector);
  return selector[internalSelector].getInfo();
}

export class SelectorCallStep {
  constructor(readonly ctx: any, readonly args: any) {}
}

export type SelectorStep = string | number | symbol | SelectorCallStep;

export interface SelectorInfo {
  target: any;
  path: SelectorStep[];
}

interface Selector {
  // tslint:disable-next-line:callable-types
  (): void;

  withNewStep(step: SelectorStep): Selector;
  run(stopAtUndefinedNull: boolean): any;
  getInfo(): SelectorInfo;
}

function newSelector(target: any, path: SelectorStep[] = []): Selector {
  function selectorFunction() {
    // do nothing, this is just to keep the proxy happy when invoking functions
  }

  selectorFunction.withNewStep = (step: SelectorStep) => {
    return newSelector(target, [...path, step]);
  };

  selectorFunction.run = (stopAtUndefinedNull: boolean) => {
    let value = target;

    for (const step of path) {
      if (stopAtUndefinedNull && (value === undefined || value === null)) {
        return undefined;
      }
      if (step instanceof SelectorCallStep) {
        const targetThis = _(step.ctx);
        value = value.apply(targetThis, step.args);
      } else {
        value = value[step];
      }
    }
    return value;
  };

  const info = freezeData({
    target,
    path
  });
  selectorFunction.getInfo = () => info;

  return selectorFunction;
}

const selectorProxyHandler: ProxyHandler<Selector> = {
  // getPrototypeOf: let it go for instanceof checks
  setPrototypeOf() {
    throw new Error("a selector cannot be used to set a prototype");
  },
  isExtensible() {
    return false;
  },
  preventExtensions() {
    return false;
  },
  getOwnPropertyDescriptor() {
    throw new Error("a selector cannot be used to get a property descriptor");
  },
  has() {
    throw new Error("a selector cannot be used to check if a property is present");
  },
  get(selectorTarget, key) {
    if (key === internalSelector) {
      return selectorTarget;
    }
    return createSelectorProxy(selectorTarget.withNewStep(key));
  },
  set() {
    throw new Error("a selector cannot be used to set a value");
  },
  deleteProperty() {
    throw new Error("a selector cannot be used to delete a property");
  },
  defineProperty() {
    throw new Error("a selector cannot be used to define a property");
  },
  enumerate() {
    throw new Error("a selector cannot be used to enumerate properties");
  },
  ownKeys() {
    throw new Error("a selector cannot be used to enumerate keys");
  },
  apply(selectorTarget, ctx, args) {
    return createSelectorProxy(selectorTarget.withNewStep(new SelectorCallStep(ctx, args)));
  },
  construct() {
    throw new Error("a selector cannot be used to construct an object");
  }
};

function createSelectorProxy<T>(selector: Selector): T {
  return new Proxy(selector, selectorProxyHandler) as any;
}

/**
 * Creates the beginning of a new selector, with the root pinned to a certain value.
 *
 * @export
 * @template T
 * @param {T} data
 * @returns {T}
 */
export function $<T>(data: T): T {
  return createSelectorProxy(newSelector(data));
}

/**
 * Executes a selector query, returning its result.
 *
 * @export
 * @template T
 * @param {T} selector
 * @returns {T}
 */
export function _<T>(selector: T): T {
  ensureIsSelector(selector);
  return ((selector as any)[internalSelector] as Selector).run(false);
}

function ensureIsSelector(selector: any) {
  if (devMode) {
    if (!isSelector(selector)) {
      throw new Error("invalid selector");
    }
  }
}

/**
 * Executes a selector query, returning its result, or undefined if at some part of the evalution the value in the middle is undefined/null.
 *
 * @export
 * @template T
 * @param {T} selector
 * @returns {(T | undefined)}
 */
export function _safe<T>(selector: T): T | undefined {
  ensureIsSelector(selector);
  return ((selector as any)[internalSelector] as Selector).run(true);
}
