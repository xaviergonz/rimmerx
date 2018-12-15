import { $, _ } from "..";
import { selectorToString, _safe } from "../lib/selector";

test("selectors work", () => {
  const data = { users: [{ name: "first" }, { name: "second" }, { name: "third" }] };
  const data$ = $(data);
  expect(selectorToString(data$)).toBe("[root]");
  expect(_(data$)).toBe(data);
  expect(_safe(data$)).toBe(data);

  const users$ = data$.users;
  expect(selectorToString(users$)).toBe("[root]/users");
  expect(_(users$)).toBe(data.users);

  const firstUser$ = users$[0];
  expect(selectorToString(firstUser$)).toBe("[root]/users/0");
  expect(_(firstUser$)).toEqual(data.users[0]);

  const firstUserName$ = firstUser$.name;
  expect(selectorToString(firstUserName$)).toBe("[root]/users/0/name");
  expect(_(firstUserName$)).toBe(data.users[0].name);

  // check function calls
  const namesWithI$ = data$.users.filter(u => u.name.includes("i")).map(u => u.name);
  expect(selectorToString(namesWithI$)).toBe("[root]/users/filter(...)/map(...)");
  expect(_(namesWithI$)).toEqual(["first", "third"]);

  // a broken selector should fail, unless wrapped in _safe
  const broken$ = (data$ as any).doesntExist[0];
  expect(() => _(broken$)).toThrow("Cannot read property '0' of undefined");
  expect(_safe(broken$)).toBe(undefined);
});
