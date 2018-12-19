import { EventHandler, freezeData } from "../utils";
import {
  newCursorObject,
  StoreObject,
  SubscribeToChangesListener,
  SubscribeToPatchesListener
} from "./internal/_cursor";
import { runWhenOutsideTransaction } from "./internal/_transaction";

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
  const changeEventHandler = new EventHandler<SubscribeToChangesListener>();
  const patchEventHandler = new EventHandler<SubscribeToPatchesListener>();

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
      runWhenOutsideTransaction(transactionId => {
        changeEventHandler.emit(transactionId);
      });
    },

    draftStore: undefined,
    updateCancelled: false,

    get nofChanges() {
      return nofChanges;
    },

    subscribeToChanges(fn) {
      return changeEventHandler.subscribe(fn);
    },

    subscribeToPatches(fn) {
      return patchEventHandler.subscribe(fn);
    },

    emitPatches(patches, inversePatches) {
      runWhenOutsideTransaction(transactionId => {
        patchEventHandler.emit(transactionId, patches, inversePatches);
      });
    }
  };

  return newCursorObject(storeObject, [], undefined).proxy.store;
}
