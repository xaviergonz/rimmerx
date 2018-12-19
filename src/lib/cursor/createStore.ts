import { PatchListener } from "immer";
import { freezeData } from "../utils";
import { newCursorObject, StoreObject } from "./internal/_cursor";
import { runWhenNoTransaction as runWhenOutsideTransaction } from "./internal/_transaction";

/**
 * Creates a new store cursor.
 *
 * @export
 * @template T
 * @param (T} data
 * @returns {T}
 */
export function createStore<T>(data: T): T {
  let currentStoreRoot = freezeData(data);
  let nofChanges = 0;
  const changeListeners: Set<() => void> = new Set();
  const patchListeners: Set<PatchListener> = new Set();

  const storeObject: StoreObject<T> = {
    get store() {
      return currentStoreRoot;
    },
    set store(newStore) {
      if (newStore === currentStoreRoot) {
        return;
      }

      nofChanges++;
      currentStoreRoot = freezeData(newStore);
      runWhenOutsideTransaction(() => {
        changeListeners.forEach(s => s());
      });
    },

    draftStore: undefined,
    updateCancelled: false,

    get nofChanges() {
      return nofChanges;
    },

    subscribeToChanges(fn) {
      changeListeners.add(fn);
      return () => {
        changeListeners.delete(fn);
      };
    },

    subscribeToPatches(fn) {
      patchListeners.add(fn);
      return () => {
        patchListeners.delete(fn);
      };
    },

    emitPatches(patches, inversePatches) {
      runWhenOutsideTransaction(() => {
        patchListeners.forEach(l => {
          l(patches, inversePatches);
        });
      });
    }
  };

  return newCursorObject(storeObject, [], undefined).proxy.store;
}
