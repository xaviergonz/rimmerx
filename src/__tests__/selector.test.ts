import { $, _ } from "..";

test("selectors work", () => {
  const data = { users: [{ name: "first" }, { name: "second" }, { name: "third" }] };
  const data$ = $(data);

  const users$ = data$.users;
  const firstUser$ = users$[0];
  const firstUser = _(firstUser$);
  expect(firstUser).toEqual(data.users[0]);

  const firstUserName$ = firstUser$.name;
  const firstUserName = _(firstUserName$);
  expect(firstUserName).toBe(data.users[0].name);

  // check function calls
  const namesWithI$ = data$.users.filter(u => u.name.includes("i")).map(u => u.name);
  const namesWithI = _(namesWithI$);
  expect(namesWithI).toEqual(["first", "third"]);
});
