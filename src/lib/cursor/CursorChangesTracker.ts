import { Disposer, EventHandler } from "../utils";
import { onTransactionFinished } from "./internal/_transaction";
import { CursorAccess } from "./onCursorAccess";
import { subscribeTo } from "./subscribeTo";
import { trackCursorAccess } from "./trackCursorAccess";

/**
 * Describes a single cursor change.
 */
export interface CursorChange<T = any> {
  cursor: T;
  newValue: T;
  oldValue: T;
}

/**
 * Listener for the cursor changes tracker.
 */
export type CursorChangesListener = (changes: CursorChange[]) => void;

/**
 * Tracks cursor accesses inside a function and generates events any time
 * one of those cursors change their value.
 *
 * @export
 * @class CursorChangesTracker
 */
export class CursorChangesTracker {
  private subscriptionDisposers = new Map<any, Disposer>();
  private readonly eventHandler = new EventHandler<CursorChangesListener>();
  private changes: CursorChange[] = [];

  private readonly onTransactionFinishedDisposer = onTransactionFinished(() => {
    if (this.changes.length > 0) {
      const changes = this.changes;
      this.changes = [];
      this.eventHandler.emit(changes);
    }
  });

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
        subscribeTo(cursor, (newValue, oldValue) => {
          const change = {
            cursor,
            newValue,
            oldValue
          };
          this.changes.push(change);
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
  subscribe(listener: CursorChangesListener): Disposer {
    return this.eventHandler.subscribe(listener);
  }

  /**
   * Disposes of all subscribers to changes and stops emmitting events.
   *
   * @memberof CursorChangesTracker
   */
  dispose() {
    this.subscriptionDisposers.forEach(d => d());
    this.subscriptionDisposers.clear();
    this.eventHandler.clearListeners();
    this.onTransactionFinishedDisposer();
  }
}
