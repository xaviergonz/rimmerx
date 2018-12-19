import { trackCursorAccess, _ } from "../..";
import { $firstUser, $firstUserName, data } from "./testbed";

test("trackCursorAccess", () => {
  const evs = trackCursorAccess(() => {
    _($firstUser);
    _($firstUserName);
    _($firstUser.name);
  });
  expect(evs).toEqual([
    { cursor: $firstUser, value: data.users[0] },
    { cursor: $firstUserName, value: data.users[0].name },
    { cursor: $firstUserName, value: data.users[0].name }
  ]);
});
