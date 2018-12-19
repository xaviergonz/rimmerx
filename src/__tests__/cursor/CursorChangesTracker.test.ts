import { CursorChangesTracker, set, _ } from "../..";
import { $firstUser, $firstUserName } from "./testbed";

test("CursorChangesTracker", () => {
  const tracker = new CursorChangesTracker();
  let evs: any = [];
  tracker.subscribe((cursor, newVal, oldVal) => {
    evs.push({
      cursor,
      newVal,
      oldVal
    });
  });

  tracker.track(() => {
    _($firstUser.name);
  });

  expect(evs).toEqual([]);

  set($firstUser.name, "john");
  expect(evs).toEqual([{ cursor: $firstUserName, newVal: "john", oldVal: "first" }]);
  evs = [];

  set($firstUser.active, false);
  // should not generate an event since only name is being listened to
  expect(evs).toEqual([]);

  tracker.track(() => {
    _($firstUser.name);
    _($firstUser);
  });
  expect(evs).toEqual([]);

  set($firstUser.name, "janne");
  // two changes since one is the parent of the other
  expect(evs).toEqual([
    { cursor: $firstUserName, newVal: "janne", oldVal: "john" },
    { cursor: $firstUser, newVal: { name: "janne", active: false }, oldVal: { name: "john", active: false } }
  ]);
  evs = [];

  set($firstUser.active, true);
  // only the parent should generate a change
  expect(evs).toEqual([
    { cursor: $firstUser, newVal: { name: "janne", active: true }, oldVal: { name: "janne", active: false } }
  ]);
  evs = [];

  // no more events once disposed
  tracker.dispose();
  set($firstUser.active, false);
  set($firstUser.active, true);
});
