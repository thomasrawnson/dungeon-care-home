// Shared by the classic browser script and Node tests; no DOM or game state.
(function () {
'use strict';
const W=10,H=7;
const entrance={x:0,y:3}, goal={x:9,y:3};
const basePathCells=[[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[3,2],[4,2],[5,2],[6,2],[7,2],[3,4],[4,4],[5,4],[6,4],[7,4]];
const blockerCells=[[3,3],[4,3],[5,3],[6,3],[7,3],[4,2],[5,2],[6,2],[4,4],[5,4],[6,4]];

function key(x,y){return `${x},${y}`;}
function inList(list,x,y){return list.some(p=>p[0]===x&&p[1]===y);}

// Neighbor order is the route tie-breaker: right, left, down, then up.
function neighbors(x,y){return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].filter(([a,b])=>a>=0&&a<W&&b>=0&&b<H);}
function walkable(x,y,blockers){if(blockers.some(b=>b.x===x&&b.y===y))return false;return inList(basePathCells,x,y);}
function findPath(blockers=[]){
  let q=[[entrance.x,entrance.y]],prev=new Map(),seen=new Set([key(entrance.x,entrance.y)]);
  while(q.length){
    let [x,y]=q.shift();
    if(x===goal.x&&y===goal.y){let out=[[x,y]],k=key(x,y);while(prev.has(k)){const p=prev.get(k);out.push(p);k=key(p[0],p[1]);}return out.reverse();}
    for(const [nx,ny] of neighbors(x,y)){const k=key(nx,ny);if(!seen.has(k)&&walkable(nx,ny,blockers)){seen.add(k);prev.set(k,[x,y]);q.push([nx,ny]);}}
  }
  return null;
}

// Keep validation order aligned with the prototype's placement feedback.
// Wave restrictions, affordability and the final reachability check stay at
// their existing points in the caller; findPath returns null for a full cut.
function blockerPlacementError(blockers,x,y){
  if(!inList(blockerCells,x,y))return 'invalid-bay';
  if(blockers.length>=3)return 'limit';
  if(blockers.some(b=>b.x===x&&b.y===y))return 'occupied';
  return null;
}

const rules={basePathCells,blockerCells,inList,findPath,blockerPlacementError};
if(typeof module==='object'&&module.exports)module.exports=rules;
else globalThis.CorridorPathfinding=rules;
})();
