import { Disposer } from "../utils";
import { CursorAccess } from "./onCursorAccess";
import { subscribeTo } from "./subscribeTo";
import { trackCursorAccess } from "./trackCursorAccess";

/**
 * Listener for the cursor changes tracker.
 */
export type CursorChangeListener = (cursor: any, newValue: any, oldValue: any) => void;

/**
 * Tracks cursor accesses inside a function and generates events any time
 * one of those cursors change their value.
 *
 * @export
 * @class CursorChangesTracker
 */
export class CursorChangesTracker {
  private subscriptionDisposers = new Map<any, Disposer>();
  private listeners: CursorChangeListener[] = [];

  /**
   * Tracks any accesses to cursors inside the function and subscribes
   * to them in order to generate change events.
   *
   * @param {() => void} fn
   * @returns {CursorAccess[]}
   * @memberof CursorChangesTracker
   */
  track(fn: () => void): CursorAccess[] {
    const accesses = trackCursorAccess(fn);

    const newSubscriptionDisposers = new Map<any, Disposer>();
    accesses.forEach(a => {
      const cursor = a.cursor;
      // try to reuse already made subscriptions
      const disposer =
        this.subscriptionDisposers.get(cursor) ||
        subscribeTo(cursor, (newVal, oldVal) => {
          this.emit(cursor, newVal, oldVal);
        });
      newSubscriptionDisposers.set(cursor, disposer);
    });
    this.subscriptionDisposers = newSubscriptionDisposers;

    return accesses;
  }

  /**
   * Subscribes to changes to cursors accessed inside the track function.
   *
   * @param {CursorChangeListener} listener
   * @returns {Disposer}
   * @memberof CursorChangesTracker
   */
  subscribe(listener: CursorChangeListener): Disposer {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Disposes of all subscribers to changes and stops emmitting events.
   *
   * @memberof CursorChangesTracker
   */
  dispose() {
    this.subscriptionDisposers.forEach(d => d());
    this.subscriptionDisposers.clear();
    this.listeners = [];
  }

  private emit = (cursor: any, newVal: any, oldVal: any) => {
    this.listeners.forEach(l => l(cursor, newVal, oldVal));
  };
}
