import { createStore, lens, _ } from "..";
import { subscribeTo } from "../lib/cursor";
import { devMode } from "../lib/devMode";

interface User {
  name: string;
  active: boolean;
}

function userToString(user: User) {
  return user.active ? `${user.name} (active)` : `${user.name} (inactive)`;
}

const $User = lens((user: User) => {
  const views = {
    get stringData() {
      return userToString(user);
    },

    get writeGetter() {
      user.name = "write";
      return "write";
    },

    viewWithParams(v: string) {
      return user.name + v;
    }
  };

  const actions = {
    setNameAndActive(val: string, active: boolean): string {
      // make sure views work inside actions
      expect(views.stringData).toBeTruthy();

      user.name = val;
      // make sure actions work
      this.setActive(active);

      // make sure props and views are up to date with temp changes
      expect(user.name).toBe(val);
      expect(user.active).toBe(active);
      expect(views.stringData).toBe(userToString({ name: val, active }));

      return val;
    },

    setActive(val: boolean) {
      user.active = val;
    }

    // TODO: async?
  };

  return { views, actions };
});

// const usersLens = lens((userArr: User[]) => ({
//   get names() {
//     return userArr.map(u => u.name);
//   },

//   activateAll() {
//     userArr.forEach(u => {
//       u.active = true;
//     });
//   }
// }));

const originalData = {
  users: [{ name: "first", active: true }, { name: "second", active: false }, { name: "third", active: true }]
};

let data = originalData;
let $data = createStore(data);
let $users = $data.users;
let $firstUser = $users[0];
let $firstUserName = $firstUser.name;
// let $activeUsers = $data.users.filter(u => u.active).map(u => u.name);
// let $broken = ($data as any).doesntExist[0];
let firstUser = $User($firstUser);
// let users = usersLens(users$);

beforeEach(() => {
  data = originalData;
  $data = createStore(data);
  $users = $data.users;
  $firstUser = $users[0];
  $firstUserName = $firstUser.name;
  // $activeUsers = $activeUsers = data$.users.filter(u => u.active).map(u => u.name);
  // $broken = ($data as any).doesntExist[0];
  firstUser = $User($firstUser);
  // users = usersLens(users$);
});

test("reading property", () => {
  expect(firstUser.name).toBe(_($firstUser).name);
});

test("getting original object", () => {
  expect(firstUser._).toBe(_($firstUser));
});

test("getting original cursor", () => {
  expect(firstUser.$).toBe($firstUser);
});

test("setting/deleting a property throws", () => {
  expect(() => {
    firstUser.name = "someName";
  }).toThrow("a lens cannot be used to set a property");
  expect(() => {
    delete firstUser.name;
  }).toThrow("a lens cannot be used to delete a property");
});

test("getOwnPropertyDescriptor points to the original object", () => {
  const pdesc1 = Object.getOwnPropertyDescriptor(firstUser, "name");
  const pdesc2 = Object.getOwnPropertyDescriptor(_($firstUser), "name");
  expect(pdesc1).toEqual({ ...pdesc2, configurable: true });
});

test("'in' operator works (has)", () => {
  expect("name" in firstUser).toBeTruthy();
  expect("notPresent" in firstUser).toBeFalsy();
});

test("Object.keys/values/entries work (ownKeys))", () => {
  expect(Object.keys(firstUser)).toEqual(Object.keys(firstUser._));
  expect(Object.values(firstUser)).toEqual(Object.values(firstUser._));
  expect(Object.entries(firstUser)).toEqual(Object.entries(firstUser._));
});

test("for...in works (enumerate)", () => {
  const arr1 = [];
  // tslint:disable-next-line:forin
  for (const x in firstUser) {
    arr1.push(x);
  }

  const arr2 = [];
  // tslint:disable-next-line:forin
  for (const x in firstUser) {
    arr2.push(x);
  }

  expect(arr1).toEqual(arr2);
});

test("getters work", () => {
  expect(firstUser.stringData).toBe("first (active)");
  expect(firstUser.viewWithParams("hi")).toBe("firsthi");
});

test("actions work", () => {
  let calls = 0;
  subscribeTo($firstUser, (newVal, oldVal) => {
    calls++;
    expect(oldVal).toEqual({
      name: "first",
      active: true
    });
    expect(newVal).toEqual({
      name: "myname",
      active: false
    });
  });

  expect(firstUser.name).toBe("first");
  expect(firstUser.active).toBe(true);
  expect(_($data)).toBe(originalData);

  const ret = firstUser.setNameAndActive("myname", false);

  expect(ret).toBe("myname");
  expect(calls).toBe(1);
  expect(firstUser.name).toBe("myname");
  expect(firstUser.active).toBe(false);
  expect(_($data)).not.toBe(originalData);
});

test("getters should not be able to write (in dev mode)", () => {
  if (devMode) {
    const oldName = firstUser.name;
    expect(() => {
      // tslint:disable-next-line:no-unused-expression
      firstUser.writeGetter;
    }).toThrow("Cannot assign to read only property");
    expect(_($firstUserName)).toBe(oldName);
    expect(firstUser.name).toBe(oldName);
  }
});

test("lenses of the same kind pointing to the same cursor should be the same", () => {
  const firstUser2 = $User($users[0]);
  const secondUser = $User($users[1]);
  expect(firstUser === firstUser2).toBe(true);
  expect(firstUser === secondUser).toBe(false);
});
