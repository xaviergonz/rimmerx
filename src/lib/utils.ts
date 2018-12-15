import { devMode } from "./devMode";

export function freezeData<T>(data: T): T {
  if (devMode) {
    Object.freeze(data);
  }
  return data;
}
