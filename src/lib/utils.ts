import { devMode } from "./devMode";

export type Disposer = () => void;

/**
 * @internal
 * @private
 */
export function freezeData<T>(data: T): T {
  return devMode ? deepFreeze(data) : data;
}

/**
 * @internal
 * @private
 */
function isPrimitive(value: any): value is string | number | boolean | null | undefined {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  return false;
}

/**
 * @internal
 * @private
 */
function freeze<T>(value: T): T {
  return isPrimitive(value) ? value : Object.freeze(value);
}

/**
 * @internal
 * @private
 */
function deepFreeze<T>(value: T): T {
  freeze(value);

  if (Array.isArray(value)) {
    value.forEach(v => {
      deepFreeze(v);
    });
  } else if (isPlainObject(value)) {
    Object.keys(value).forEach(propKey => {
      if (!isPrimitive((value as any)[propKey]) && !Object.isFrozen((value as any)[propKey])) {
        deepFreeze((value as any)[propKey]);
      }
    });
  }

  return value;
}

/**
 * @internal
 * @private
 */
function isPlainObject(value: any): value is any {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
