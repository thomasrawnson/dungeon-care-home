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
    [4, 4], [5, 4], [6, 4], [7, 4], [7, 3], [8, 3], [9, 3]
  ];
  assert.deepEqual(findPath(blockers), expected);
  assert.deepEqual(findPath(blockers), expected);
});

test("a complete corridor cut is rejected as unreachable", () => {
  const blockers = [
    { x: 4, y: 2 },
    { x: 4, y: 3 },
    { x: 4, y: 4 }
  ];
  assert.equal(findPath(blockers), null);
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
