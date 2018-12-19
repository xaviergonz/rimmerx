import produce, { nothing, PatchListener } from "immer";
import { getStoreObject, runCursor } from "./internal/_cursor";
import { getParent, getPath } from "./misc";
import { isRollbackUpdate } from "./rollbackUpdate";

/**
 * Updates the value/values a cursor points to.
 *
 * Similar to `immer`'s `produce` method:
 * - to modify an object either:
 *   - do mutable operations over the object
 *   - or return the new value (remember that `nothing` must be returned if the new value should be `undefined`),
 *     but in this cases it is usally easier just to use the `set` function.
 * See `immer` docs for more info.
 *
 * If any error is thrown in the middle of an update process then the update
 * will be cancelled and therefore not changes won't be commited.
 *
 * If you want to rollback without actually generating an error then use `throw rollbackUpdate`.
 *
 * Updates are transactions in themselves, but if you want to wrap multiple updates in a single transaction
 * see the `transaction` function.
 *
 * @export
 * @template T
 * @param {T} cursor
 * @param {((draft: T) => T | void)} recipe
 */
export function update<T>(cursor: T, recipe: (draft: T) => T | void): void {
  const storeObj = getStoreObject(cursor);

  const updateDraftStore = () => {
    try {
      const draftTarget = runCursor(cursor, false, true) as T;

      let newValue = recipe(draftTarget);

      // replace value in place case
      if (newValue !== undefined) {
        if (newValue === nothing) {
          newValue = undefined;
        }
        const parentCursor = getParent(cursor);
        const draftParentTarget = runCursor(parentCursor, false, true);
        const path = getPath(cursor);
        const key = path[path.length - 1];
        draftParentTarget[key as any] = newValue;
      }
    } catch (err) {
      storeObj.updateCancelled = true;
      if (!isRollbackUpdate(err)) {
        throw err;
      }
    }
  };

  if (storeObj.draftStore) {
    // already updating, reuse the draft until finished
    updateDraftStore();
  } else {
    const oldStoreRoot = storeObj.store;

    const emitPatchesIfNotCancelled: PatchListener = (patches, inversePatches) => {
      if (!storeObj.updateCancelled) {
        storeObj.emitPatches(patches, inversePatches);
      }
    };

    try {
      const newStoreRoot = produce(
        oldStoreRoot,
        draftStoreRoot => {
          storeObj.draftStore = draftStoreRoot;
          updateDraftStore();
        },
        emitPatchesIfNotCancelled
      );

      if (!storeObj.updateCancelled) {
        storeObj.store = newStoreRoot;
      }
    } finally {
      storeObj.draftStore = undefined;
      storeObj.updateCancelled = false;
    }
  }
}
