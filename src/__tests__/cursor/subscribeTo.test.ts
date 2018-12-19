import { subscribeTo, update } from "../..";
import { $activeUsers, $firstUser, $firstUserName } from "./testbed";

test("subscription - values", () => {
  let calls = 0;
  const disposer = subscribeTo($firstUserName, (newVal, oldVal) => {
    calls++;
    expect(newVal).toBe("first_updated");
    expect(oldVal).toBe("first");
  });

  // no call if unchanged
  update($firstUserName, name => {
    return name;
  });
  expect(calls).toBe(0);

  // call when changed
  update($firstUserName, () => {
    return "first_updated";
  });
  expect(calls).toBe(1);

  // no call if disposed
  disposer();
  update($firstUserName, name => {
    return name + "_updated";
  });
  expect(calls).toBe(1);
});

test("subscription - functions", () => {
  let calls = 0;
  const disposer = subscribeTo($activeUsers, (newVal, oldVal) => {
    calls++;
    expect(newVal).toEqual(["third"]);
    expect(oldVal).toEqual(["first", "third"]);
  });

  // no call if unchanged
  update($firstUser, fu => {
    fu.active = fu.active;
  });
  expect(calls).toBe(0);

  // call when changed
  update($firstUser, fu => {
    fu.active = !fu.active;
  });
  expect(calls).toBe(1);

  // no call if disposed
  disposer();
  update($firstUser, fu => {
    fu.active = !fu.active;
  });
  expect(calls).toBe(1);
});
