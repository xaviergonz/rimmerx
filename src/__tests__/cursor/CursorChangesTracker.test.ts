import { CursorChange, CursorChangesTracker, set, _ } from "../..";
import { $firstUser, $firstUserName } from "./testbed";

test("CursorChangesTracker", () => {
  const tracker = new CursorChangesTracker();
  let evs: CursorChange[][] = [];
  tracker.subscribe(changes => {
    evs.push(changes);
  });

  const expectChange = (changes: CursorChange[]) => {
    expect(evs.length).toBe(1);
    expect(evs[0].length).toBe(changes.length);
    changes.forEach((ch, i) => {
      const ev = evs[0][i];
      expect(ev.cursor).toBe(ch.cursor);
      expect(ev.newValue).toEqual(ch.newValue);
      expect(ev.oldValue).toEqual(ch.oldValue);
    });
  };

  tracker.track(() => {
    _($firstUser.name);
  });

  expect(evs).toEqual([]);

  set($firstUser.name, "john");
  expectChange([{ cursor: $firstUserName, newValue: "john", oldValue: "first" }]);
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
  expectChange([
    { cursor: $firstUserName, newValue: "janne", oldValue: "john" },
    { cursor: $firstUser, newValue: { name: "janne", active: false }, oldValue: { name: "john", active: false } }
  ]);
  evs = [];

  set($firstUser.active, true);
  // only the parent should generate a change
  expectChange([
    { cursor: $firstUser, newValue: { name: "janne", active: true }, oldValue: { name: "janne", active: false } }
  ]);
  evs = [];

  // no more events once disposed
  tracker.dispose();
  set($firstUser.active, false);
  set($firstUser.active, true);
});
