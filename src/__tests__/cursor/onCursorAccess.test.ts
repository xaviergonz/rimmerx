import { CursorAccess, onCursorAccess, _ } from "../..";
import { $firstUser, $firstUserName, data } from "./testbed";

test("onCursorAccess", () => {
  let evs: CursorAccess[] = [];
  const disposer = onCursorAccess(ev => {
    evs.push(ev);
  });

  _($firstUser);
  expect(evs.length).toBe(1);
  expect(evs[0].cursor).toBe($firstUser);
  expect(evs[0].value).toBe(data.users[0]);
  evs = [];

  _($firstUserName);
  expect(evs.length).toBe(1);
  expect(evs).toEqual([{ cursor: $firstUserName, value: data.users[0].name }]);
  evs = [];

  _($firstUser.name);
  expect(evs.length).toBe(1);
  expect(evs).toEqual([{ cursor: $firstUserName, value: data.users[0].name }]);
  evs = [];

  disposer();

  _($firstUser);
  expect(evs).toEqual([]);
});
