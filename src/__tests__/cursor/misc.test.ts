import { cursorToString, getParent, isFunctional, _ } from "../..";
import { $activeUsers, $data, $firstUser, $firstUserName, $users, data } from "./testbed";

test("cursorToString", () => {
  expect(cursorToString($data)).toBe("/");
  expect(cursorToString($users)).toBe("/users");
  expect(cursorToString($firstUser)).toBe("/users/0");
  expect(cursorToString($firstUserName)).toBe("/users/0/name");
  expect(cursorToString($activeUsers)).toBe("/users/filter(...)/map(...)");
});

test("isFunctional", () => {
  expect(isFunctional($firstUserName)).toBeFalsy();
  expect(isFunctional($activeUsers)).toBeTruthy();
});

test("getParent", () => {
  const firstUserParent$ = getParent($firstUser);
  expect(firstUserParent$).toBe($users);
  expect(_(firstUserParent$)).toBe(data.users);
});
