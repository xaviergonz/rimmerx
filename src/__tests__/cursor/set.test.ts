import { set, _ } from "../..";
import { $data, $firstUser, $firstUserName, data } from "./testbed";

test("set - direct", () => {
  expect(_($data)).toBe(data);
  set($firstUserName, "some name");
  expect(_($firstUserName)).toBe("some name");
  expect(_($data)).not.toBe(data);
});

test("set - indirect to undefined", () => {
  expect(_($data)).toBe(data);
  set($firstUser.name, undefined as any);
  expect(_($firstUser.name)).toBe(undefined);
  expect(_($data)).not.toBe(data);
});
