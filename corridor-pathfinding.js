// Shared by the classic browser script and Node tests; no DOM or game state.
(function () {
'use strict';
const W=10,H=7;
const entrance={x:0,y:3}, goal={x:9,y:3};
const basePathCells=[[0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[7,3],[8,3],[9,3],[3,2],[4,2],[5,2],[6,2],[7,2],[3,4],[4,4],[5,4],[6,4],[7,4]];
const blockerCells=[[3,3],[4,3],[5,3],[6,3],[7,3],[4,2],[5,2],[6,2],[4,4],[5,4],[6,4]];

function key(x,y){return `${x},${y}`;}
function inList(list,x,y){return list.some(p=>p[0]===x&&p[1]===y);}

// Final tie-breaker after distance and off-corridor cells: right, left, down, up.
function neighbors(x,y){return [[x+1,y],[x-1,y],[x,y+1],[x,y-1]].filter(([a,b])=>a>=0&&a<W&&b>=0&&b<H);}
function walkable(x,y,blockers){if(blockers.some(b=>b.x===x&&b.y===y))return false;return inList(basePathCells,x,y);}
function findPath(blockers=[]){
  if(!walkable(entrance.x,entrance.y,blockers)||!walkable(goal.x,goal.y,blockers))return null;
  // Distances from Bingo identify every shortest route for the current blockers.
  const q=[[goal.x,goal.y]],distance=new Map([[key(goal.x,goal.y),0]]);
  for(let i=0;i<q.length;i++){
    const [x,y]=q[i],d=distance.get(key(x,y));
    for(const [nx,ny] of neighbors(x,y)){
      const k=key(nx,ny);
      if(!distance.has(k)&&walkable(nx,ny,blockers)){distance.set(k,d+1);q.push([nx,ny]);}
    }
  }
  if(!distance.has(key(entrance.x,entrance.y)))return null;
  // BFS order lets each cell reuse the minimum off-corridor cost of its
  // shortest suffixes, all of which are one step closer to Bingo.
  const offCorridor=new Map([[key(goal.x,goal.y),0]]);
  for(const [x,y] of q){
    const k=key(x,y),d=distance.get(k);
    if(d===0)continue;
    const suffixes=neighbors(x,y).filter(([nx,ny])=>distance.get(key(nx,ny))===d-1);
    offCorridor.set(k,(y===3?0:1)+Math.min(...suffixes.map(([nx,ny])=>offCorridor.get(key(nx,ny)))));
  }
  const out=[[entrance.x,entrance.y]];
  while(true){
    const [x,y]=out[out.length-1],k=key(x,y),d=distance.get(k);
    if(d===0)return out;
    // The first optimal next step gives lexicographic movement order.
    out.push(neighbors(x,y).find(([nx,ny])=>distance.get(key(nx,ny))===d-1&&
      offCorridor.get(key(nx,ny))+(y===3?0:1)===offCorridor.get(k)));
  }
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
