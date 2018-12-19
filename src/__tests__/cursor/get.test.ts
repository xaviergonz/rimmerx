import { broken, get, safeGet, update, _, _safe } from "../..";
import { $activeUsers, $broken, $data, $firstUser, $firstUserName, $users, data } from "./testbed";

test("reading values", () => {
  expect(_($data)).toBe(data);
  expect(_($users)).toBe(data.users);
  expect(get($firstUser)).toEqual(data.users[0]);
  expect(_($firstUserName)).toBe(data.users[0].name);
  expect(_($activeUsers)).toEqual(["first", "third"]);
  expect(() => _($broken)).toThrow("Cannot read property '0' of undefined");

  const $toUndefined = ($data as any).notExists;
  expect(_safe($toUndefined)).toBe(undefined);
});

test("reading values in a safe way", () => {
  expect(safeGet($data)).toBe(data);
  expect(_safe($broken)).toBe(broken);
});

test("cursor caching", () => {
  // identical cursors are equal
  expect($data.users === $data.users).toBeTruthy();
  expect($data.users[0] === $data.users[0]).toBeTruthy();
  expect($data.users[0].name === $data.users[0].name).toBeTruthy();

  // except when they have functions (we don't know if the arguments are the same)
  expect($data.users.filter(u => u) === $data.users.filter(u => u)).toBeFalsy();
});

test("function cursor value caching", () => {
  const activeUsers1 = _($activeUsers);
  const activeUsers2 = _($activeUsers);

  expect(activeUsers1).toBe(activeUsers2);

  update($firstUser, fu => {
    fu.active = !fu.active;
  });

  // different reference and value
  expect(_($activeUsers)).not.toEqual(activeUsers1);
  expect(_($activeUsers)).not.toBe(activeUsers1);

  update($firstUser, fu => {
    fu.active = !fu.active;
  });

  // same value, but different reference
  expect(_($activeUsers)).toEqual(activeUsers1);
  expect(_($activeUsers)).not.toBe(activeUsers1);
});
