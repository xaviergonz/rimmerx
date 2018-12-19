import { Patch } from "immer";
import { Disposer } from "../utils";
import { getCursorObject, getStoreObject } from "./internal/_cursor";

export type PatchesSubscriptionListener = (patches: Patch[], invsersePatches: Patch[], transactionId?: number) => void;

/**
 * Run a callback whenever a store generates a set of patches / inverse patches as result of a change.
 * Note that subscriptions can only be made over root cursors (the cursor returned as result of `createStore`).
 * See `immer`'s `produce` method for details.
 *
 * @export
 * @param {*} rootCursor
 * @param {PatchesSubscriptionListener} patchListener
 * @returns {Disposer}
 */
export function subscribeToPatches(rootCursor: any, patchListener: PatchesSubscriptionListener): Disposer {
  const cursorObj = getCursorObject(rootCursor);
  if (cursorObj.path.length !== 1) {
    throw new Error("patch subscription can only be done on root cursors");
  }

  const store = getStoreObject(rootCursor);
  return store.subscribeToPatches((transactionId, patches, invsersePatches) =>
    patchListener(patches, invsersePatches, transactionId)
  );
}
