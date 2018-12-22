import { nothing, rollbackUpdate, subscribeTo, update, _ } from "../..";
import { $activeUsers, $data, $firstUser, $firstUserName, $users, data } from "./testbed";

test("update - no return value", () => {
  expect(_($data)).toBe(data);
  update($firstUser, u => {
    u.name += "_updated";
  });
  expect(_($firstUserName)).toBe("first_updated");
  expect(_($data)).not.toBe(data);
});

test("update - return value", () => {
  expect(_($data)).toBe(data);
  update($firstUserName, name => {
    return name + "_updated";
  });
  expect(_($firstUserName)).toBe("first_updated");
  expect(_($data)).not.toBe(data);
});

test("update - return nothing", () => {
  expect(_($data)).toBe(data);
  update($firstUserName, () => {
    return nothing;
  });
  expect(_($firstUserName)).toBe(undefined);
  expect(_($data)).not.toBe(data);
});

test("update - functional works", () => {
  const firstActiveUser$ = $users.find(u => u.active);
  expect(_($data)).toBe(data);
  update(firstActiveUser$, u => {
    u!.active = false;
  });
  expect(_($firstUser).active).toBe(false);
  expect(_($data)).not.toBe(data);
});

test("nested updates", () => {
  let calls = 0;
  subscribeTo($firstUser, ({ newValue, oldValue }) => {
    calls++;
    expect(newValue).toEqual({
      name: "first_u1_u2",
      active: false
    });
    expect(oldValue).toEqual({
      name: "first",
      active: true
    });
  });

  expect(_($data)).toBe(data);

  update($firstUser, u => {
    u.active = !u.active;
    update($firstUserName, name => name + "_u1");
    update($firstUserName, name => name + "_u2");

    // cursors still work as if the object was not mutated, since the commit is done after the update is finished
    expect(_($activeUsers).length).toBe(2);
    expect(_($firstUser).active).toBe(true);
    expect(_($firstUserName)).toBe("first");
  });

  expect(_($firstUser)).toEqual({
    name: "first_u1_u2",
    active: false
  });
  expect(_($data)).not.toBe(data);
  expect(calls).toBe(1);
});

test("cancelled update", () => {
  let calls = 0;
  subscribeTo($firstUser, () => {
    calls++;
  });

  expect(_($data)).toBe(data);

  update($firstUser, u => {
    u.active = !u.active;
    u.name = "another name";
    throw rollbackUpdate;
  });
  expect(_($data)).toBe(data);
  expect(calls).toBe(0);

  // rollback upon exception being thrown
  expect(() => {
    update($firstUser, u => {
      u.active = !u.active;
      u.name = "another name";
      throw new Error("some error");
    });
  }).toThrow("some error");
  expect(_($data)).toBe(data);
  expect(calls).toBe(0);
});
