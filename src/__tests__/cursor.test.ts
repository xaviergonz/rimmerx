import { nothing } from "immer";
import { broken, createStore, cursorToString, getParent, isFunctional, subscribe, update, _, _safe } from "..";

const originalData = {
  users: [{ name: "first", active: true }, { name: "second", active: false }, { name: "third", active: true }]
};

let data = originalData;
let data$ = createStore(data);
let users$ = data$.users;
let firstUser$ = users$[0];
let firstUserName$ = firstUser$.name;
let activeUsers$ = data$.users.filter(u => u.active).map(u => u.name);
let broken$ = (data$ as any).doesntExist[0];

beforeEach(() => {
  data = originalData;
  data$ = createStore(data);
  users$ = data$.users;
  firstUser$ = users$[0];
  firstUserName$ = firstUser$.name;
  activeUsers$ = activeUsers$ = data$.users.filter(u => u.active).map(u => u.name);
  broken$ = (data$ as any).doesntExist[0];
});

test("cursorToString", () => {
  expect(cursorToString(data$)).toBe("store");
  expect(cursorToString(users$)).toBe("store/users");
  expect(cursorToString(firstUser$)).toBe("store/users/0");
  expect(cursorToString(firstUserName$)).toBe("store/users/0/name");
  expect(cursorToString(activeUsers$)).toBe("store/users/filter(...)/map(...)");
});

test("reading values", () => {
  expect(_(data$)).toBe(data);
  expect(_(users$)).toBe(data.users);
  expect(_(firstUser$)).toEqual(data.users[0]);
  expect(_(firstUserName$)).toBe(data.users[0].name);
  expect(_(activeUsers$)).toEqual(["first", "third"]);
  expect(() => _(broken$)).toThrow("Cannot read property '0' of undefined");

  const toUndefined$ = (data$ as any).notExists;
  expect(_safe(toUndefined$)).toBe(undefined);
});

test("reading values in a safe way", () => {
  expect(_safe(data$)).toBe(data);
  expect(_safe(broken$)).toBe(broken);
});

test("isFunctional", () => {
  expect(isFunctional(firstUserName$)).toBeFalsy();
  expect(isFunctional(activeUsers$)).toBeTruthy();
});

test("getParent", () => {
  const firstUserParent$ = getParent(firstUser$);
  expect(firstUserParent$).toBe(users$);
  expect(_(firstUserParent$)).toBe(data.users);
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
  expect(_(data$)).toBe(data);
  update(firstUser$, u => {
    u.name += "_updated";
  });
  expect(_(firstUserName$)).toBe("first_updated");
  expect(_(data$)).not.toBe(data);
});

test("update - return value", () => {
  expect(_(data$)).toBe(data);
  update(firstUserName$, name => {
    return name + "_updated";
  });
  expect(_(firstUserName$)).toBe("first_updated");
  expect(_(data$)).not.toBe(data);
});

test("update - return nothing", () => {
  expect(_(data$)).toBe(data);
  update(firstUserName$, () => {
    return nothing;
  });
  expect(_(firstUserName$)).toBe(undefined);
  expect(_(data$)).not.toBe(data);
});

test("update - functional throws", () => {
  expect(() =>
    update(activeUsers$, () => {
      // emtpy
    })
  ).toThrow("cannot update a functional cursor");
});

test("subscription - values", () => {
  let calls = 0;
  const disposer = subscribe(firstUserName$, (newVal, oldVal) => {
    calls++;
    expect(newVal).toBe("first_updated");
    expect(oldVal).toBe("first");
  });

  // no call if unchanged
  update(firstUserName$, name => {
    return name;
  });
  expect(calls).toBe(0);

  // call when changed
  update(firstUserName$, () => {
    return "first_updated";
  });
  expect(calls).toBe(1);

  // no call if disposed
  disposer();
  update(firstUserName$, name => {
    return name + "_updated";
  });
  expect(calls).toBe(1);
});

test("subscription - functions", () => {
  let calls = 0;
  const disposer = subscribe(activeUsers$, (newVal, oldVal) => {
    calls++;
    expect(newVal).toEqual(["third"]);
    expect(oldVal).toEqual(["first", "third"]);
  });

  // no call if unchanged
  update(firstUser$, fu => {
    fu.active = fu.active;
  });
  expect(calls).toBe(0);

  // call when changed
  update(firstUser$, fu => {
    fu.active = !fu.active;
  });
  expect(calls).toBe(1);

  // no call if disposed
  disposer();
  update(firstUser$, fu => {
    fu.active = !fu.active;
  });
  expect(calls).toBe(1);
});

test("function cursor value caching", () => {
  const activeUsers1 = _(activeUsers$);
  const activeUsers2 = _(activeUsers$);

  expect(activeUsers1).toBe(activeUsers2);

  update(firstUser$, fu => {
    fu.active = !fu.active;
  });

  // different reference and value
  expect(_(activeUsers$)).not.toEqual(activeUsers1);
  expect(_(activeUsers$)).not.toBe(activeUsers1);

  update(firstUser$, fu => {
    fu.active = !fu.active;
  });

  // same value, but different reference
  expect(_(activeUsers$)).toEqual(activeUsers1);
  expect(_(activeUsers$)).not.toBe(activeUsers1);
});
