import {
  broken,
  createStore,
  CursorAccess,
  cursorToString,
  get,
  getParent,
  isFunctional,
  nothing,
  onCursorAccess,
  PatchListener,
  rollbackUpdate,
  safeGet,
  set,
  subscribeTo,
  subscribeToPatches,
  trackCursorAccess,
  update,
  _,
  _safe
} from "..";

const originalData = {
  users: [{ name: "first", active: true }, { name: "second", active: false }, { name: "third", active: true }]
};

let data = originalData;
let $data = createStore(data);
let $users = $data.users;
let $firstUser = $users[0];
let $firstUserName = $firstUser.name;
let $activeUsers = $data.users.filter(u => u.active).map(u => u.name);
let $broken = ($data as any).doesntExist[0];

beforeEach(() => {
  data = originalData;
  $data = createStore(data);
  $users = $data.users;
  $firstUser = $users[0];
  $firstUserName = $firstUser.name;
  $activeUsers = $activeUsers = $data.users.filter(u => u.active).map(u => u.name);
  $broken = ($data as any).doesntExist[0];
});

test("cursorToString", () => {
  expect(cursorToString($data)).toBe("/");
  expect(cursorToString($users)).toBe("/users");
  expect(cursorToString($firstUser)).toBe("/users/0");
  expect(cursorToString($firstUserName)).toBe("/users/0/name");
  expect(cursorToString($activeUsers)).toBe("/users/filter(...)/map(...)");
});

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

test("isFunctional", () => {
  expect(isFunctional($firstUserName)).toBeFalsy();
  expect(isFunctional($activeUsers)).toBeTruthy();
});

test("getParent", () => {
  const firstUserParent$ = getParent($firstUser);
  expect(firstUserParent$).toBe($users);
  expect(_(firstUserParent$)).toBe(data.users);
});

test("cursor caching", () => {
  // identical cursors are equal
  expect($data.users === $data.users).toBeTruthy();
  expect($data.users[0] === $data.users[0]).toBeTruthy();
  expect($data.users[0].name === $data.users[0].name).toBeTruthy();

  // except when they have functions (we don't know if the arguments are the same)
  expect($data.users.filter(u => u) === $data.users.filter(u => u)).toBeFalsy();
});

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

test("nested updates", () => {
  let calls = 0;
  subscribeTo($firstUser, (newVal, oldVal) => {
    calls++;
    expect(newVal).toEqual({
      name: "first_u1_u2",
      active: false
    });
    expect(oldVal).toEqual({
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

test("onCursorAccess", () => {
  let evs: CursorAccess[] = [];
  const disposer = onCursorAccess(ev => {
    evs.push(ev);
  });

  _($firstUser);
  expect(evs).toEqual([{ cursor: $firstUser, value: data.users[0] }]);
  evs = [];

  _($firstUserName);
  expect(evs).toEqual([{ cursor: $firstUserName, value: data.users[0].name }]);
  evs = [];

  _($firstUser.name);
  expect(evs).toEqual([{ cursor: $firstUserName, value: data.users[0].name }]);
  evs = [];

  disposer();

  _($firstUser);
  expect(evs).toEqual([]);
});

test("trackCursorAccess", () => {
  const evs = trackCursorAccess(() => {
    _($firstUser);
    _($firstUserName);
    _($firstUser.name);
  });
  expect(evs).toEqual([
    { cursor: $firstUser, value: data.users[0] },
    { cursor: $firstUserName, value: data.users[0].name },
    { cursor: $firstUserName, value: data.users[0].name }
  ]);
});
