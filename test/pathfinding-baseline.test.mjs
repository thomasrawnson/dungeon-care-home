import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

// Load the standalone CommonJS export without depending on a parent package's
// module type. The same .js file is also served as a classic browser script.
const source = await fs.readFile(new URL("../corridor-pathfinding.js", import.meta.url), "utf8");
const module = { exports: {} };
vm.runInThisContext(`(function(module) {${source}\n})`)(module);
const { findPath, blockerPlacementError } = module.exports;

test("the unblocked corridor reaches Tuesday Bingo directly", () => {
  assert.deepEqual(findPath(), [
    [0, 3], [1, 3], [2, 3], [3, 3], [4, 3],
    [5, 3], [6, 3], [7, 3], [8, 3], [9, 3]
  ]);
});

test("the same scooter placement always produces the same valid reroute", () => {
  const blockers = [{ x: 4, y: 3 }];
  const expected = [
    [0, 3], [1, 3], [2, 3], [3, 3], [3, 4],
    [4, 4], [5, 4], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3]
  ];
  assert.deepEqual(findPath(blockers), expected);
  assert.deepEqual(findPath(blockers), expected);
});

test("adjacent scooters rejoin at the first available main-corridor cell", () => {
  assert.deepEqual(findPath([{ x: 4, y: 3 }, { x: 5, y: 3 }]), [
    [0, 3], [1, 3], [2, 3], [3, 3], [3, 4], [4, 4],
    [5, 4], [6, 4], [6, 3], [7, 3], [8, 3], [9, 3]
  ]);
});

test("a blocked lower detour uses the equivalent local upper detour", () => {
  assert.deepEqual(findPath([{ x: 4, y: 3 }, { x: 4, y: 4 }]), [
    [0, 3], [1, 3], [2, 3], [3, 3], [3, 2], [4, 2],
    [5, 2], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3]
  ]);
});

test("a complete corridor cut is rejected as unreachable", () => {
  const direct = findPath();
  const blockers = [
    { x: 4, y: 2 },
    { x: 4, y: 3 },
    { x: 4, y: 4 }
  ];
  assert.equal(findPath(blockers), null);
  blockers.length = 0;
  assert.deepEqual(findPath(blockers), direct);
});

// Independent fixed-map oracle: enumerate simple routes rather than reuse the
// production distance/suffix algorithm. Positive edge costs exclude cycles
// from an optimal route. Walk cells in coordinate order, not movement order.
const cells = [
  ...Array.from({ length: 10 }, (_, x) => [x, 3]),
  ...[2, 4].flatMap(y => [3, 4, 5, 6, 7].map(x => [x, y]))
];
const bays = [[3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
  [4, 2], [5, 2], [6, 2], [4, 4], [5, 4], [6, 4]];
const adjacent = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
const offMain = path => path.filter(([, y]) => y !== 3).length;

function exhaustiveBest(blockers) {
  const open = cells.filter(([x, y]) => !blockers.some(b => b.x === x && b.y === y));
  let best = null;
  let bestOrder;
  function visit(path, order) {
    const last = path.at(-1);
    if (last[0] === 9 && last[1] === 3) {
      if (!best || path.length < best.length ||
          (path.length === best.length && (offMain(path) < offMain(best) ||
            (offMain(path) === offMain(best) && order < bestOrder)))) {
        best = [...path];
        bestOrder = order;
      }
      return;
    }
    if (best && path.length >= best.length) return;
    for (const next of open) {
      if (path.includes(next) || !adjacent(last, next)) continue;
      const direction = next[0] > last[0] ? "0" : next[0] < last[0] ? "1" : next[1] > last[1] ? "2" : "3";
      visit([...path, next], order + direction);
    }
  }
  visit([open.find(([x, y]) => x === 0 && y === 3)], "");
  return best;
}

test("every subset of up to three scooter bays satisfies all route rankings", () => {
  let checked = 0;
  for (let mask = 0; mask < 2 ** bays.length; mask++) {
    const blockers = bays.filter((_, i) => mask & (1 << i)).map(([x, y]) => ({ x, y }));
    if (blockers.length > 3) continue;
    const snapshot = structuredClone(blockers);
    blockers.forEach(Object.freeze);
    Object.freeze(blockers);
    const expected = exhaustiveBest(blockers);
    const actual = findPath(blockers);
    const label = JSON.stringify(blockers);
    assert.deepEqual(blockers, snapshot, `input unchanged: ${label}`);
    if (expected === null) {
      assert.equal(actual, null, label);
    } else {
      assert.ok(actual, label);
      assert.deepEqual(actual[0], [0, 3], label);
      assert.deepEqual(actual.at(-1), [9, 3], label);
      for (const [i, cell] of actual.entries()) {
        assert.ok(cells.some(([x, y]) => x === cell[0] && y === cell[1]), `walkable: ${label}`);
        assert.ok(!blockers.some(b => b.x === cell[0] && b.y === cell[1]), `unblocked: ${label}`);
        if (i) assert.ok(adjacent(actual[i - 1], cell), `adjacent: ${label}`);
      }
      assert.equal(actual.length - 1, expected.length - 1, `shortest distance: ${label}`);
      assert.equal(offMain(actual), offMain(expected), `minimum off-main cells: ${label}`);
      assert.deepEqual(actual, expected, `movement tie-break: ${label}`);
    }
    findPath([{ x: 4, y: 2 }, { x: 4, y: 3 }, { x: 4, y: 4 }]);
    findPath();
    assert.deepEqual(findPath([...blockers].reverse()), expected, `fresh search: ${label}`);
    checked++;
  }
  assert.equal(checked, 232);
});

test("scooters require a parking bay, with the existing limit and rejection order", () => {
  const blockers = [{ x: 4, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 }];
  assert.equal(blockerPlacementError([], 4, 3), null);
  for (const [x, y] of [[0, 3], [9, 3], [1, 2], [3, 2], [-1, 3]]) {
    assert.equal(blockerPlacementError([], x, y), "invalid-bay");
  }
  assert.equal(blockerPlacementError(blockers.slice(0, 1), 4, 3), "occupied");
  assert.equal(blockerPlacementError(blockers, 7, 3), "limit");
  assert.equal(blockerPlacementError(blockers, 4, 3), "limit");
  assert.equal(blockerPlacementError(blockers, 0, 3), "invalid-bay");
});

test("searches do not mutate blockers or retain state between calls", () => {
  const blockers = Object.freeze([Object.freeze({ x: 4, y: 3 })]);
  const direct = findPath();
  const reroute = findPath(blockers);
  reroute[0][0] = 99;
  assert.deepEqual(findPath([]), direct);
  assert.deepEqual(findPath(blockers)[0], [0, 3]);
});

test("the browser loads the shared rules before its classic game script", async () => {
  const html = await fs.readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /<script src="corridor-pathfinding\.js"><\/script>\s*<script>/);
  assert.doesNotMatch(html, /function (findPath|neighbors|walkable|blockerPlacementError)\(/);
  const context = vm.createContext({});
  const source = await fs.readFile(new URL("../corridor-pathfinding.js", import.meta.url), "utf8");
  new vm.Script(source).runInContext(context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.CorridorPathfinding.findPath())), findPath());
  assert.equal(context.CorridorPathfinding.blockerPlacementError([], 0, 3), "invalid-bay");
  const gameScript = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  new vm.Script(gameScript); // Parse the game script with its existing inline handlers intact.
});
