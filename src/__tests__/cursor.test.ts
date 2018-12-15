import { $, $safe, createStore, cursorToString, getCursorParent, isCursorReadonly, updateCursor } from "..";

test("cursors work", () => {
  let data = { users: [{ name: "first" }, { name: "second" }, { name: "third" }] };
  const data$ = createStore(data);
  expect(cursorToString(data$)).toBe("store");
  expect($(data$)).toBe(data);
  expect($safe(data$)).toBe(data);

  const users$ = data$.users;
  expect(cursorToString(users$)).toBe("store/users");
  expect($(users$)).toBe(data.users);

  const firstUser$ = users$[0];
  expect(cursorToString(firstUser$)).toBe("store/users/0");
  expect($(firstUser$)).toEqual(data.users[0]);

  const firstUserName$ = firstUser$.name;
  expect(isCursorReadonly(firstUserName$)).toBeFalsy();
  expect(cursorToString(firstUserName$)).toBe("store/users/0/name");
  expect($(firstUserName$)).toBe(data.users[0].name);

  // check function calls
  const namesWithI$ = data$.users.filter(u => u.name.includes("i")).map(u => u.name);
  expect(isCursorReadonly(namesWithI$)).toBeTruthy();
  expect(cursorToString(namesWithI$)).toBe("store/users/filter(...)/map(...)");
  expect($(namesWithI$)).toEqual(["first", "third"]);

  // a broken cursor should fail, unless wrapped in _safe
  const broken$ = (data$ as any).doesntExist[0];
  expect(() => $(broken$)).toThrow("Cannot read property '0' of undefined");
  expect($safe(broken$)).toBe(undefined);

  // getParent works
  const firstUserParent$ = getCursorParent(firstUser$);
  expect(firstUserParent$).toBe(users$);
  expect($(firstUserParent$)).toBe(data.users);

  // identical cursors are equal
  expect(data$.users === data$.users).toBeTruthy();
  expect(data$.users[0] === data$.users[0]).toBeTruthy();
  expect(data$.users[0].name === data$.users[0].name).toBeTruthy();

  // except when they have functions (we don't know if the arguments are the same)
  expect(data$.users.filter(u => u) === data$.users.filter(u => u)).toBeFalsy();

  // update - without returning new value
  expect($(data$)).toBe(data);
  updateCursor(firstUser$, u => {
    u.name += "_updated";
  });
  expect($(firstUserName$)).toBe("first_updated");
  expect($(data$)).not.toBe(data);
  data = $(data$);

  // update - returning new value
  expect($(data$)).toBe(data);
  updateCursor(firstUserName$, name => {
    return name + "_updated";
  });
  expect($(firstUserName$)).toBe("first_updated_updated");
  expect($(data$)).not.toBe(data);
  data = $(data$);
});
