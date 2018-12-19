import { CursorAccess, onCursorAccess, _ } from "../..";
import { $firstUser, $firstUserName, data } from "./testbed";

test("onCursorAccess", () => {
  let evs: CursorAccess[] = [];
  const disposer = onCursorAccess(ev => {
    evs.push(ev);
  });

  _($firstUser);
  expect(evs).toEqual([{ cursor: $firstUser, value: data.users[0] }]);
  evs = [];

  _($firstUserName);
  expect(evs).toEqual([{ cursor: $firstUserName, value: data.users[0].name }]);
  evs = [];

  _($firstUser.name);
  expect(evs).toEqual([{ cursor: $firstUserName, value: data.users[0].name }]);
  evs = [];

  disposer();

  _($firstUser);
  expect(evs).toEqual([]);
});
