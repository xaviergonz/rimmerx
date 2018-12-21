import { createStore, transform } from "../..";

const originalData = {
  users: [{ name: "first", active: true }, { name: "second", active: false }, { name: "third", active: true }]
};

let data = originalData;
let $data = createStore(data);
let $users = $data.users;
let $firstUser = $users[0];
let $firstUserName = $firstUser.name;
let $activeUsers = $data.users.filter(u => u.active).map(u => u.name);
let $firstUserNameInObject = transform($firstUserName, fun => ({ name: fun.toUpperCase() }));
let $broken = ($data as any).doesntExist[0];

beforeEach(() => {
  data = originalData;
  $data = createStore(data);
  $users = $data.users;
  $firstUser = $users[0];
  $firstUserName = $firstUser.name;
  $activeUsers = $activeUsers = $data.users.filter(u => u.active).map(u => u.name);
  $firstUserNameInObject = transform($firstUserName, fun => ({ name: fun.toUpperCase() }));
  $broken = ($data as any).doesntExist[0];
});

export { data, $data, $users, $firstUser, $firstUserName, $firstUserNameInObject, $activeUsers, $broken };

test("testbed", () => {
  // nothing
});
