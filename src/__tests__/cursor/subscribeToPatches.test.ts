import { PatchListener, rollbackUpdate, subscribeToPatches, update } from "../..";
import { $data, $firstUser } from "./testbed";

test("subscribeToPatches", () => {
  let calls = 0;
  const listener: PatchListener = (patches, inversePatches) => {
    calls++;
    expect({ patches, inversePatches }).toMatchSnapshot();
  };

  expect(() => subscribeToPatches($firstUser, listener)).toThrow("patch subscription can only be done on root cursors");

  const disposer = subscribeToPatches($data, listener);

  expect(calls).toBe(0);

  update($firstUser, u => {
    u.name = "james";
    throw rollbackUpdate;
  });
  expect(calls).toBe(0);

  update($firstUser, u => {
    u.name = "john";
  });
  expect(calls).toBe(1);

  disposer();
  update($firstUser, u => {
    u.name = "james";
  });
  expect(calls).toBe(1);
});
