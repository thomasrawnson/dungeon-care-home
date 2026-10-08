import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

async function currentPathfinding() {
  const html = await fs.readFile(new URL("../index.html", import.meta.url), "utf8");
  const constants = html.match(/const W=.*?(?=let tea=)/s)?.[0];
  const helpers = html.match(/function key\(x,y\).*?function inList\(list,x,y\).*?\n/s)?.[0];
  const pathfinding = html.match(/function neighbors\(x,y\).*?(?=function world\()/s)?.[0];
  assert.ok(constants, "prototype grid constants remain discoverable");
  assert.ok(helpers, "prototype coordinate helpers remain discoverable");
  assert.ok(pathfinding, "prototype pathfinding implementation remains discoverable");

  const context = vm.createContext({});
  new vm.Script(`${constants}\nlet blockers=[];\n${helpers}\n${pathfinding}\n` +
    "globalThis.pathfinding={findPath,setBlockers(value){blockers=value;}};").runInContext(context);
  return context.pathfinding;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("the unblocked corridor reaches Tuesday Bingo directly", async () => {
  const rules = await currentPathfinding();
  assert.deepEqual(plain(rules.findPath()), [
    [0, 3], [1, 3], [2, 3], [3, 3], [4, 3],
    [5, 3], [6, 3], [7, 3], [8, 3], [9, 3]
  ]);
});

test("the same scooter placement always produces the same valid reroute", async () => {
  const rules = await currentPathfinding();
  rules.setBlockers([{ x: 4, y: 3 }]);
  const expected = [
    [0, 3], [1, 3], [2, 3], [3, 3], [3, 4],
    [4, 4], [5, 4], [6, 4], [7, 4], [7, 3], [8, 3], [9, 3]
  ];
  assert.deepEqual(plain(rules.findPath()), expected);
  assert.deepEqual(plain(rules.findPath()), expected);
});

test("a complete corridor cut is rejected as unreachable", async () => {
  const rules = await currentPathfinding();
  rules.setBlockers([
    { x: 4, y: 2 },
    { x: 4, y: 3 },
    { x: 4, y: 4 }
  ]);
  assert.equal(rules.findPath(), null);
});
