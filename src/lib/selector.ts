import { devMode } from "./devMode";

const internalSelector = Symbol("internalSelector");

// strings for accessing a property, array to call the previous property with those arguments
type SelectorStep = string | number | symbol | { ctx: any; args: any };

class Selector {
  constructor(readonly target: any, readonly steps: SelectorStep[] = []) {}

  withNewStep(step: SelectorStep): Selector {
    return new Selector(this.target, [...this.steps, step]);
  }

  run(): any {
    let value = this.target;
    for (const step of this.steps) {
      if (typeof step === "object") {
        value = value.apply(step.ctx.run(), step.args);
      } else {
        value = value[step];
      }
    }
    return value;
  }
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
    return createSelectorProxy(selectorTarget.withNewStep({ ctx, args }));
  },
  construct() {
    throw new Error("a selector cannot be used to construct an object");
  }
};

function createSelectorProxy<T>(selector: Selector): T {
  return new Proxy(selector, selectorProxyHandler) as any;
}

// creates a proxied selector
export function $<T>(data: T): T {
  return createSelectorProxy(new Selector(data));
}

// reads the proxied selector value
export function _<T>(selector: T): T {
  if (devMode) {
    if (!(selector instanceof Selector)) {
      throw new Error("invalid selector");
    }
  }
  return ((selector as any)[internalSelector] as Selector).run();
}
