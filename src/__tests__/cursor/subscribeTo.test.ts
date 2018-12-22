import { set, subscribeTo, subscribeToMany, update } from "../..";
import { transaction } from "../../lib/cursor";
import { $activeUsers, $firstUser, $firstUserName, $users } from "./testbed";

test("subscription - values", () => {
  const $secondUserName = $users[1].name;

  let calls = 0;
  const disposer = subscribeToMany([$firstUserName, $secondUserName], ([firstUserNameChange, secondUserNameChange]) => {
    calls++;
    expect(firstUserNameChange.cursor).toBe($firstUserName);
    expect(firstUserNameChange.changed).toBe(true);
    expect(firstUserNameChange.newValue).toBe("first_updated");
    expect(firstUserNameChange.oldValue).toBe("first");

    expect(secondUserNameChange.cursor).toBe($secondUserName);
    expect(secondUserNameChange.changed).toBe(true);
    expect(secondUserNameChange.newValue).toBe("second_updated");
    expect(secondUserNameChange.oldValue).toBe("second");
  });

  // no call if unchanged
  update($firstUserName, name => {
    return name;
  });
  expect(calls).toBe(0);

  // call when changed
  transaction(() => {
    set($firstUserName, "first_updated");
    set($secondUserName, "second_updated");
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
  const disposer = subscribeTo($activeUsers, ({ newValue, oldValue }) => {
    calls++;
    expect(newValue).toEqual(["third"]);
    expect(oldValue).toEqual(["first", "third"]);
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
