import { Disposer, EventHandler } from "../utils";
import { CursorAccess } from "./onCursorAccess";
import { CursorChange, subscribeToMany } from "./subscribeTo";
import { trackCursorAccess } from "./trackCursorAccess";

/**
 * Listener for the cursor changes tracker.
 */
export type CursorChangesListener = (changes: CursorChange<any>[]) => void;

/**
 * Tracks cursor accesses inside a function and generates events any time
 * one of those cursors change their value.
 *
 * @export
 * @class CursorChangesTracker
 */
export class CursorChangesTracker {
  private subscriptionDisposer?: Disposer;
  private readonly eventHandler = new EventHandler<CursorChangesListener>();

  /**
   * Tracks any accesses to cursors inside the function and subscribes
   * to them in order to generate change events.
   *
   * @param {() => void} fn
   * @returns {CursorAccess[]}
   * @memberof CursorChangesTracker
   */
  track(fn: () => void): CursorAccess[] {
    if (this.subscriptionDisposer) {
      this.subscriptionDisposer();
    }

    const accesses = trackCursorAccess(fn);

    this.subscriptionDisposer = subscribeToMany(accesses.map(a => a.cursor), this.emitChanges);
    return accesses;
  }

  /**
   * Subscribes to changes to cursors accessed inside the track function.
   *
   * @param {CursorChangeListener} listener
   * @returns {Disposer}
   * @memberof CursorChangesTracker
   */
  subscribe(listener: CursorChangesListener): Disposer {
    return this.eventHandler.subscribe(listener);
  }

  /**
   * Disposes of all subscribers to changes and stops emmitting events.
   *
   * @memberof CursorChangesTracker
   */
  dispose() {
    if (this.subscriptionDisposer) {
      this.subscriptionDisposer();
      this.subscriptionDisposer = undefined;
    }
    this.eventHandler.clearListeners();
  }

  private emitChanges = (changes: CursorChange<any>[]) => {
    // only emit stuff that actually changed
    const realChanges = changes.filter(c => c.changed);
    if (realChanges.length > 0) {
      this.eventHandler.emit(realChanges);
    }
  };
}
