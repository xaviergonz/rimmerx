import { nothing } from "immer";
import { $, $safe, createStore, cursorToString, getParent, isReadonly, update } from "..";

const originalData = { users: [{ name: "first" }, { name: "second" }, { name: "third" }] };

let data = originalData;
let data$ = createStore(data);
let users$ = data$.users;
let firstUser$ = users$[0];
let firstUserName$ = firstUser$.name;
let namesWithI$ = data$.users.filter(u => u.name.includes("i")).map(u => u.name);
let broken$ = (data$ as any).doesntExist[0];
beforeEach(() => {
  data = originalData;
  data$ = createStore(data);
  users$ = data$.users;
  firstUser$ = users$[0];
  firstUserName$ = firstUser$.name;
  namesWithI$ = data$.users.filter(u => u.name.includes("i")).map(u => u.name);
  broken$ = (data$ as any).doesntExist[0];
});

test("cursorToString", () => {
  expect(cursorToString(data$)).toBe("store");
  expect(cursorToString(users$)).toBe("store/users");
  expect(cursorToString(firstUser$)).toBe("store/users/0");
  expect(cursorToString(firstUserName$)).toBe("store/users/0/name");
  expect(cursorToString(namesWithI$)).toBe("store/users/filter(...)/map(...)");
});

test("reading values", () => {
  expect($(data$)).toBe(data);
  expect($(users$)).toBe(data.users);
  expect($(firstUser$)).toEqual(data.users[0]);
  expect($(firstUserName$)).toBe(data.users[0].name);
  expect($(namesWithI$)).toEqual(["first", "third"]);
  expect(() => $(broken$)).toThrow("Cannot read property '0' of undefined");
});

test("reading values in a safe way", () => {
  expect($safe(data$)).toBe(data);
  expect($safe(broken$)).toBe(undefined);
});

test("isReadonly", () => {
  expect(isReadonly(firstUserName$)).toBeFalsy();
  expect(isReadonly(namesWithI$)).toBeTruthy();
});

test("getParent", () => {
  const firstUserParent$ = getParent(firstUser$);
  expect(firstUserParent$).toBe(users$);
  expect($(firstUserParent$)).toBe(data.users);
});

test("cursor caching", () => {
  // identical cursors are equal
  expect(data$.users === data$.users).toBeTruthy();
  expect(data$.users[0] === data$.users[0]).toBeTruthy();
  expect(data$.users[0].name === data$.users[0].name).toBeTruthy();

  // except when they have functions (we don't know if the arguments are the same)
  expect(data$.users.filter(u => u) === data$.users.filter(u => u)).toBeFalsy();
});

test("update - no return value", () => {
  expect($(data$)).toBe(data);
  update(firstUser$, u => {
    u.name += "_updated";
  });
  expect($(firstUserName$)).toBe("first_updated");
  expect($(data$)).not.toBe(data);
});

test("update - return value", () => {
  expect($(data$)).toBe(data);
  update(firstUserName$, name => {
    return name + "_updated";
  });
  expect($(firstUserName$)).toBe("first_updated");
  expect($(data$)).not.toBe(data);
});

test("update - return nothing", () => {
  expect($(data$)).toBe(data);
  update(firstUserName$, () => {
    return nothing;
  });
  expect($(firstUserName$)).toBe(undefined);
  expect($(data$)).not.toBe(data);
});

test("update - readonly throws", () => {
  expect(() =>
    update(namesWithI$, () => {
      // emtpy
    })
  ).toThrow("cannot update a readonly cursor");
});
