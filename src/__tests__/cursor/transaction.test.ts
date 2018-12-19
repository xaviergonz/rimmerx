import { set, subscribeTo } from "../..";
import { subscribeToPatches, transaction } from "../../lib/cursor";
import { $data, $firstUser, data } from "./testbed";

test("transaction", () => {
  let subscribeCalls = 0;
  subscribeTo($firstUser, (newVal, oldVal) => {
    subscribeCalls++;
    expect(oldVal).toEqual(data.users[0]);
    expect(newVal).toEqual({
      name: "john",
      active: false
    });
  });

  let patchesCalls = 0;
  subscribeToPatches($data, () => {
    patchesCalls++;
  });

  transaction(() => {
    set($firstUser.name, "john");
    expect(subscribeCalls).toBe(0);
    expect(patchesCalls).toBe(0);
    transaction(() => {
      set($firstUser.active, false);
    });
    expect(subscribeCalls).toBe(0);
    expect(patchesCalls).toBe(0);
  });
  // only one since even though the object changed twice the "change" detection was run once
  expect(subscribeCalls).toBe(1);
  expect(patchesCalls).toBe(2);
});
