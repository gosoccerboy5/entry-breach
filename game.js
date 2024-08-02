let canvas = document.querySelector("#canvas");
let ctx = canvas.getContext("2d");
canvas.style.width = window.innerWidth + "px";
canvas.style.height = window.innerHeight + "px";
let canvasDivision = 4;

if (ctx.roundRect === undefined) ctx.roundRect = ctx.rect;

function mapWhilePreserve(list, fn) {
  for (let i = 0; i < list.length; i++) {
    list[i] = fn(list[i]);
  }
  return list;
}
function interpolateDepth(d1, d2, distAlong, fullDist) {
  return (d2-d1)*(distAlong/fullDist)+d1;
}

var canvasData = ctx.createImageData(canvas.width, canvas.height);
function drawPixel (canvasData, depthBuffer, x, y, r, g, b, depth) {
  if (x < 0 || x >= canvas.width || y < 0 || y > canvas.height) return;
  var index = (x + y * canvas.width) * 4;  
  if (depth < 0 || depthBuffer[index] !== undefined && depthBuffer[index] < depth) return;
  depthBuffer[index] = depth;
  canvasData.data[index + 0] = Math.min(r + 1/5*depth, 255);
  canvasData.data[index + 1] = Math.min(g + 1/5*depth, 255);
  canvasData.data[index + 2] = Math.min(b + 1/5*depth, 255);
  canvasData.data[index + 3] = 255;
}
function drawTopTri(p1, p2, p3, canvasData, depthBuffer, mtl) {
  let slope1 = (p2[0]-p1[0])/(p2[1]-p1[1]);
  let slope2 = (p3[0]-p1[0])/(p3[1]-p1[1]);
  let switched = slope1 > slope2;
  if (switched) [slope1, slope2] = [slope2, slope1];
  let curXs = [p1[0], p1[0]];
  let depths = [p1.depth, p1.depth];
  for (let y = (p1[1]); y <= p2[1]; y++) {
    if (y >= 0 && y <= canvas.height) {
      for (let x = Math.max(Math.floor(curXs[0]), 0); x <= Math.min(curXs[1], canvas.width); x++) {
        drawPixel(canvasData, depthBuffer, Math.round(x), Math.round(y), mtl[0], mtl[1], mtl[2], 
          1/(curXs[1] === curXs[0] ? depths[0] : interpolateDepth(depths[0], depths[1], x-curXs[0], curXs[1]-curXs[0]))
        );
      }
    }
    curXs[0] += slope1;
    curXs[1] += slope2;
    depths = [interpolateDepth(p1.depth, p2.depth, y - (p1[1]), p2[1]-(p1[1])), 
    interpolateDepth(p1.depth, p3.depth, y - (p1[1]), p3[1]-(p1[1]))];
    if (switched) depths = [depths[1], depths[0]];
  }
}

function drawBottomTri(p1, p2, p3, canvasData, depthBuffer, mtl) {
  let slope1 = (p2[0]-p1[0])/(p2[1]-p1[1]);
  let slope2 = (p3[0]-p1[0])/(p3[1]-p1[1]);
  let switched = slope1 < slope2;
  if (switched) [slope1, slope2] = [slope2, slope1];
  let curXs = [p1[0], p1[0]];
  let depths = [p1.depth, p1.depth];
  for (let y = (p1[1]); y >= p2[1]; y--) {
    if (y >= 0 && y <= canvas.height) {
      for (let x = Math.max((curXs[0]), 0); x <= Math.min(curXs[1], canvas.width); x++) {
        drawPixel(canvasData, depthBuffer, Math.round(x), Math.round(y), mtl[0], mtl[1], mtl[2], 
          1/(curXs[1] === curXs[0] ? depths[0] : interpolateDepth(depths[0], depths[1], x-curXs[0], curXs[1]-curXs[0]))
        );
      }
    }
    curXs[0] -= slope1;
    curXs[1] -= slope2;
    depths = [interpolateDepth(p1.depth, p2.depth, y - (p1[1]), p2[1]-(p1[1])), 
    interpolateDepth(p1.depth, p3.depth, y - (p1[1]), p3[1]-(p1[1]))];
    if (switched) depths = [depths[1], depths[0]];
  }
}
function drawTri(p1, p2, p3, canvasData, depthBuffer, mtl) {
  let pts = [p1, p2, p3].map(pt => mapWhilePreserve(pt, Math.round));
  if (pts.some(pt => pt.some(n => Number.isNaN(n)||!Number.isFinite(n)))) return;
  let ptOutsideList = [];
  for (let pt of pts) {
    let outside = [];
    if (pt[0] < 0) outside.push(1);
    if (pt[0] > canvas.width) outside.push(2);
    if (pt[1] < 0) outside.push(3);
    if (pt[1] > canvas.height) outside.push(4);
    ptOutsideList.push(outside)
  }
  if (ptOutsideList.every(outside => outside.length > 0) && ptOutsideList.every(outside => outside.every(location => ptOutsideList.every(list => list.includes(location))))) return;
  //if (pts.every(pt => pt[0] < 0-100 || pt[0] > canvas.width+100 || pt[1] < 0-100 || pt[1] > canvas.height+100)) return;
  pts.sort((a, b) => a[1]-b[1]);
  if (pts[1][1] === pts[2][1]) {drawTopTri(pts[0], pts[1], pts[2], canvasData, depthBuffer, mtl);return;}
  if (pts[0][1] === pts[1][1]) {drawBottomTri(pts[2], pts[1], pts[0], canvasData, depthBuffer, mtl);return;}
  let p4 = [pts[0][0] + ((pts[1][1] - pts[0][1]) / (pts[2][1] - pts[0][1])) * (pts[2][0] - pts[0][0]), pts[1][1]];
  p4.depth = interpolateDepth(pts[0].depth, pts[2].depth, p4[1]-pts[0][1], pts[2][1]-pts[0][1]);
  drawTopTri(pts[0], pts[1], p4, canvasData, depthBuffer, mtl);
  drawBottomTri(pts[2], p4, pts[1], canvasData, depthBuffer, mtl);
}
function drawPoly(pts, canvasData, depthBuffer, mtl) {
  for (let i = 0; i < pts.length-2; i++) {
    drawTri(pts[0], pts[i+1], pts[i+2], canvasData, depthBuffer, mtl);
  }
}

let p1 = [0, 100], p2 = [100, 110], p3 = [60, 0], p4 = [40, 200];
p1.depth = 50; p2.depth = 50; p3.depth = 100; p4.depth = 100;
//drawTri(p3, p2, p1, canvasData, depthBuffer, [0,0,0])
//drawPoly([p3, p2, p4, p1], canvasData, depthBuffer, [0,0,0])
//ctx.putImageData(canvasData, 0, 0);

let [cos, sin] = [Math.cos.bind(Math), Math.sin.bind(Math)];

let gameState = "menu";

let enemyVel = null, planeVel = null, rollSpeed = null, pitchSpeed = null, enemyRollSpeed = null, enemyPitchSpeed = null, aimAssistRange = null, planeRadius = null, hp = null, enemyHP = null, pain = null;
let bulletVel = null;
let planeBaseVel = null;
let enemyLeadsAim = null;
let mapBoundaries = null;
let gameActive = false;

let plane = null, enemy = null, map = null, fire = null;

function resetValues() {
  enemyVel = 1.5; planeVel = 1.5; rollSpeed = 0.1; pitchSpeed = 0.04; enemyRollSpeed = 0.07; enemyPitchSpeed = 0.035; aimAssistRange = Math.PI/24; bulletVel = 5; planeRadius = 1.8; hp = 100; enemyHP = 100; pain = 0;
  planeBaseVel = 1.5;
  enemyLeadsAim = true;
  shapes = []; bullets = [];
  plane = copyShape(planeTemplate); shapes.push(plane); plane.move([0, 10, 0]);
  map = copyShape(mapTemplate); shapes.push(map);
  enemy = copyShape(enemyTemplate); 
  enemy.moveInDirection(150);
  enemy.update(Math.PI, "yaw");
  shapes.push(enemy);
  shapes.push(enemy);
  mapBoundaries = [Math.max(...map.polys.map(poly => Math.max(...poly.map(pt => pt[0])))), 
  Math.min(...map.polys.map(poly => Math.min(...poly.map(pt => pt[0])))),
  Math.max(...map.polys.map(poly => Math.max(...poly.map(pt => pt[2])))),
  Math.min(...map.polys.map(poly => Math.min(...poly.map(pt => pt[2])))),
  Math.max(...map.polys.map(poly => Math.max(...poly.map(pt => pt[1]))))];
  gameActive = true;
  camAngle = [0, 0];
}

class matrix {
  constructor(list) {
    this.list = list;
    this.dim = [this.list.length, this.list[0].length];
  }
  multiply(other) {
    if (other.dim[0] !== this.dim[1]) return false;
    let newMatrix = matrix.dimensions(this.dim[0], other.dim[1]);
    for (let i = 0; i < this.dim[0]; i++) {
      for (let j = 0; j < other.dim[1]; j++) {
      	newMatrix.list[i][j] = this.list[i].map((el, idx) => el*other.list[idx][j]).reduce((a, b)=>a+b);
      }
    }
    return newMatrix;
  }
  static from(list) {return new matrix(list);}
  static dimensions(r, c) {
    let list = [];
    for (let i = 0; i < r; i++) {
      list.push((new Array(c)).fill(0));
    }
    return new matrix(list);
  }
  static identity(n) {
    let list = [];
    for (let i = 0; i < n; i++) {
      list.push([]);
      for (let j = 0; j < n; j++) {
        if (i === j) list.at(-1).push(1);
        else list.at(-1).push(0);
      }
    }
    return new matrix(list);
  }
}
class Shape {
  constructor(polys) {
    this.polys = polys;
    this.offset = [0, 0, 0];
    this.rotate = [0, 0, 0];
    this.speed = 0;
    this.localFrame = {
      "roll": [1, 0, 0],
      "pitch": [0, 1, 0],
      "yaw": [0, 0, 1]
    }
  }
  move(offset) {
    this.offset = this.offset.map((el, idx) => el+offset[idx]);
    this.polys = this.polys.map(poly => {
      let newPoly = poly.map(pt => pt.map((el, idx) => el+offset[idx]));
      newPoly.mtl = poly.mtl;
      newPoly.cross = poly.cross;
      return newPoly;
    });
  }
  moveInDirection(dist) {
    //this.move([dist*Math.sin(this.rotate[0])*Math.cos(this.rotate[1]), dist*Math.sin(this.rotate[1]), dist*Math.cos(this.rotate[0])*Math.cos(this.rotate[1])]);
    this.move([dist*this.localFrame.roll[1], dist*this.localFrame.roll[2], dist*this.localFrame.roll[0]])
  }
  turn(direction) {
    this.rotate = this.rotate.map((n, idx) => n + direction[idx]);
  }
  updateCrossProducts() {
    for (let poly of this.polys) {
      poly.cross = crossPoly(poly);
    }
  }
  update(a, name) {
    const rotationAxis = this.localFrame[name];
    const pv = rotationAxis;
    const [x, y, z] = pv;

    const mc = (1 - cos(a));
    const Q = [
      x * x * mc + cos(a), x * y * mc - z * sin(a), x * z * mc + y * sin(a),
      x * y * mc + z * sin(a), y * y * mc + cos(a), y * z * mc - x * sin(a),
      x * z * mc - y * sin(a), y * z * mc + x * sin(a), z * z * mc + cos(a),
    ];
    this.localFrame.roll = mul(Q, this.localFrame.roll);
    this.localFrame.pitch = mul(Q, this.localFrame.pitch);
    this.localFrame.yaw = mul(Q, this.localFrame.yaw);
    let offset = this.offset;
    this.polys = this.polys.map(poly => {
      let newPoly = poly.map(pt => mul(Q, [pt[2]-offset[2], pt[0]-offset[0], pt[1]-offset[1]]));
      newPoly = newPoly.map(pt => [pt[1]+offset[0], pt[2]+offset[1], pt[0]+offset[2]]);
      newPoly.mtl = poly.mtl;
      newPoly.cross = poly.cross;
      return newPoly;
    });
    this.updateCrossProducts();
    if (name === "roll") {
      this.rotate[2] += a;

    }
    this.rotate[1] = Math.atan2(this.localFrame.roll[2], Math.sqrt(this.localFrame.roll[0]**2+this.localFrame.roll[1]**2))
    this.rotate[0] = (Math.atan2(this.localFrame.roll[1], (this.localFrame.roll[0])))
  };
}

function mul(M, v) {
   let x, y, z;
   if (v.length === 3) {
     x = v[0];
     y = v[1];
     z = v[2];
   } else {
     x = v.x;
     y = v.y;
     z = v.z;
   }
   return [
     M[0] * x + M[1] * y + M[2] * z,
     M[3] * x + M[4] * y + M[5] * z,
     M[6] * x + M[7] * y + M[8] * z,
   ];
 }
function crossProduct(vec1, vec2) {
  return (matrix.from([[0, -vec1[2], vec1[1]], [vec1[2], 0, -vec1[0]], [-vec1[1], vec1[0], 0]])).multiply(matrix.from([[vec2[0]], [vec2[1]], [vec2[2]]]));
}
function crossPoly(pts) {
  return unit(crossProduct([pts[1][0]-pts[0][0], pts[1][1]-pts[0][1], pts[1][2]-pts[0][2]], [pts[2][0]-pts[1][0], pts[2][1]-pts[1][1], pts[2][2]-pts[1][2]]).list.flat());
}
function dotProduct(vec1, vec2) {
  return vec1.reduce((a, b, idx) => a+b*vec2[idx], 0);
}
function minus(pt1, pt2) {
  return pt1.map((n, idx) => n-pt2[idx]);
}
function angleBetween(pt1, center, pt2) {
  return Math.acos(dotProduct(unit(minus(pt1, center)), unit(minus(pt2, center))))
}
function center(list) {
  return list.reduce((a, b) => a.map((el, idx) => el+b[idx]/list.length), [0,0,0]);
}
function unit(list) {
  let dist = list.reduce((a, b) => a+b**2, 0)**0.5;
  return list.map(n => n/dist);
}
function distance(pt1, pt2) {
  return Math.sqrt(pt1.map((n, idx) => (n-pt2[idx])**2).reduce((a, b) => a+b));
}
function leadAim(initPos, targetPos, speed, targetVel) {
  let collisionPos = targetPos, time = null;
  for (let i = 0; i < 5; i++) {
    time = Math.sqrt(collisionPos.map((n, idx) => (n-initPos[idx])**2).reduce((a, b) => a+b))/speed;
    collisionPos = targetPos.map((n, idx) => n+targetVel[idx]*time);
  }
  return [unit(collisionPos.map((n, idx) => n-initPos[idx])), collisionPos];
}
function distInDir(dirVec, init, pt) {
  if (init === null) init = [0, 0, 0];
  return dotProduct(unit(dirVec), pt.map((n, idx) => n-init[idx]));
}
function ptHitsTri(pt, radius, tri) {
  let centroid = center(tri);
  let firstpoint = tri.reduce((a, b) => angleBetween(a, centroid, pt) < angleBetween(b, centroid, pt) ? a : b);
  let previous = tri.at(tri.indexOf(firstpoint)-1);
  if (Math.abs(angleBetween(previous, centroid, firstpoint) - (angleBetween(previous, centroid, pt)+angleBetween(pt, centroid, firstpoint))) < 0.001) {
    secondpoint = previous;
  } else {
    secondpoint = tri.at(tri.indexOf(firstpoint)+1-tri.length);
  }
  let expectedDistance = Math.sin(angleBetween(centroid, firstpoint, secondpoint))*distance(centroid, firstpoint) / Math.sin(Math.PI-angleBetween(firstpoint, centroid, pt)-angleBetween(centroid, firstpoint, secondpoint));
  if (distance(centroid, pt) <= expectedDistance) {
    return 1;
  }
  if (radius === 0) return 0;
  let distAlongSide = dotProduct(unit(minus(secondpoint, firstpoint)), minus(pt, firstpoint));
  if (distAlongSide < 0) {
    if (distance(firstpoint, pt) <= radius) return 2;
  }
  let expectedOuterDistance = distance(firstpoint, pt) * Math.sin(angleBetween(pt, firstpoint, secondpoint))
  if (expectedOuterDistance <= radius) return 2;
  return 0;
}
function sphereHitsPoly(sphereCenter, radius, poly) {
  let trueCentroid = center(poly);
  let verticalDist = distInDir(poly.cross, trueCentroid, sphereCenter);
  if (Math.abs(verticalDist) < radius) {
    let crossSection = radius*Math.cos(Math.asin(Math.abs(verticalDist/radius)));
    if (poly.some(pt => distance(trueCentroid, pt) >= distance(trueCentroid, sphereCenter)-crossSection)) {
      if (ptHitsTri(minus(sphereCenter, poly.cross.map(n => n*verticalDist)), crossSection, poly) !== 0) {
        return true;
      }
    }
  }
  return false;
}

let camFollow = null;

let points = [];

let shapes = [];

function circle(x, y, radius) {
  ctx.arc(x, y, radius, 0, Math.PI*2);
  ctx.fill();
  ctx.closePath();
}

let camAngle = [0, 0], camPos = [0, 0, 0];

function project(point) {
  return [-point[0]/(point[2])*canvas.width/2.5+canvas.width/2, -point[1]/Math.abs(point[2])*canvas.height/1.8+canvas.height/2];
}
function clear(canvas) {
	let ctx = canvas.getContext("2d");
	ctx.beginPath();
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.closePath();
}

let lastTime = performance.now();


setInterval(function() {
  if (gameState === "playing" && !isLoading) {
    if (keys["p"] || document.pointerLockElement === null || !document.hasFocus()) gameState = "justPaused";
  }
  if (gameState === "playing" && !isLoading) {
    clear(canvas);
    canvas.width = window.innerWidth/canvasDivision;
    canvas.height = window.innerHeight/canvasDivision;
    ctx.fillStyle = "skyblue";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "grey";
    let cameraSpeed = 1, cameraDistance = 10;
    camFollow = plane;
    if (camFollow === null) {
      if (keys["w"]) {
        camPos[2] += Math.cos(camAngle[0]) * cameraSpeed * Math.cos(camAngle[1]);
        camPos[0] += Math.sin(-camAngle[0]) * cameraSpeed * Math.cos(camAngle[1]);
        camPos[1] += Math.sin(camAngle[1]) * cameraSpeed;
      }
      if (keys["s"]) {
        camPos[2] -= Math.cos(camAngle[0]) * cameraSpeed * Math.cos(camAngle[1])
        camPos[0] -= Math.sin(-camAngle[0]) * cameraSpeed * Math.cos(camAngle[1]);
        camPos[1] -= Math.sin(camAngle[1]) * cameraSpeed;
      }
      if (keys["a"]) {
        camPos[2] -= Math.sin(camAngle[0]) * cameraSpeed;
        camPos[0] -= Math.cos(-camAngle[0]) * cameraSpeed;
      }
      if (keys["d"]) {
        camPos[2] += Math.sin(camAngle[0]) * cameraSpeed;
        camPos[0] += Math.cos(-camAngle[0]) * cameraSpeed;
      }
    } else {
      camPos[0] = camFollow.offset[0] + Math.sin(camAngle[0]) * cameraDistance * Math.cos(camAngle[1]);
      camPos[1] = camFollow.offset[1] - Math.sin(camAngle[1]) * cameraDistance + cameraDistance/5;
      camPos[2] = camFollow.offset[2] - Math.cos(camAngle[0]) * cameraDistance * Math.cos(camAngle[1]);
    }

    let yaw = matrix.from([[Math.cos(camAngle[0]), -Math.sin(camAngle[0]), 0], [Math.sin(camAngle[0]), Math.cos(camAngle[0]), 0], [0, 0, 1]]);
    let roll = matrix.from([[1, 0, 0], [0, Math.cos(camAngle[1]), -Math.sin(camAngle[1])], [0, Math.sin(camAngle[1]), Math.cos(camAngle[1])]]);
    let pitch = matrix.from([[Math.cos(camAngle[0]), 0, Math.sin(camAngle[0])], [0, 1, 0], [-Math.sin(camAngle[0]), 0, Math.cos(camAngle[0])]]);
    let transformCamera = roll.multiply(pitch);
    points = []

    let renderList = [];
    for (let shape of shapes) {
      let rotationX = matrix.from([[Math.cos(shape.rotate[2]), -Math.sin(shape.rotate[2]), 0], [Math.sin(shape.rotate[2]), Math.cos(shape.rotate[2]), 0], [0, 0, 1]]);
      let rotationY = matrix.from([[Math.cos(shape.rotate[0]), 0, Math.sin(shape.rotate[0])], [0, 1, 0], [-Math.sin(shape.rotate[0]), 0, Math.cos(shape.rotate[0])]]);
      let rotationZ = matrix.from([[1, 0, 0], [0, Math.cos(-shape.rotate[1]), -Math.sin(-shape.rotate[1])], [0, Math.sin(-shape.rotate[1]), Math.cos(-shape.rotate[1])]]);
      let transformCache = new Map();
      for (let poly of shape.polys) {
        let pts = poly.map(pt => [[pt[0]-shape.offset[0]], [pt[1]-shape.offset[1]], [pt[2]-shape.offset[2]]]);
        /*let minDist = pts.reduce((a, b) => Math.min(a, Math.sqrt((b[0]-camPos[0])**2+(b[2]-camPos[2])**2)), Infinity);
        if (minDist > 200) continue;*/

        let cross = poly.cross;
        let dist = distance(center(pts), camPos);
        /*if (shape.rotate.some(n => n !== 0)) {
          pts = pts.map(pt => (rotationY.multiply(rotationZ).multiply(rotationX).multiply(matrix.from(pt)).list));
          cross = crossPoly(pts);
        }*/
        let dot = dotProduct(cross, unit([.5, -1, 0]));

        let cameraDot = dotProduct(cross, unit([pts[1][0]-camPos[0]+shape.offset[0], pts[1][1]-camPos[1]+shape.offset[1], pts[1][2]-camPos[2]+shape.offset[2]]));
        pts = pts.map(pt => {
          let str = JSON.stringify(pt);
          if (transformCache.has(str)) {
            return transformCache.get(str)
          } else {
            let transformed = transformCamera.multiply(matrix.from([[pt[0]-camPos[0]+shape.offset[0]], [pt[1]-camPos[1]+shape.offset[1]], [pt[2]-camPos[2]+shape.offset[2]]])).list;
            transformCache.set(str, transformed);
            return transformed;
          }
        });
        if (pts.some(pt => pt[2] < 0)) {
          pts = pts.map(pt => pt.map(arr=>arr[0]))
          let usable = pts.filter(pt => pt[2] > 0);
          if (usable.length >= 1) {
            let threshold = 1;
            let idx = pts.indexOf(usable[0]);
            let newPts = [];
            
            while (pts[idx%pts.length][2] > 0) {
              newPts.push(pts[idx%pts.length]);
              idx++;
            }
            let [last, curr] = [pts[(idx-1)%pts.length].map(Number), pts[idx%pts.length].map(Number)]
            let ratio = (threshold-curr[2])/(last[2]-curr[2]);
            let newPt = [curr[0]+ratio*(last[0]-curr[0]),curr[1]+ratio*(last[1]-curr[1]),threshold];

            while (pts[idx%pts.length][2] <= 0) idx++;
            if (!newPts.includes(pts[idx%pts.length])) lastPt = pts[idx%pts.length];
            [last, curr] = [pts[(idx-1)%pts.length].map(Number), pts[idx%pts.length].map(Number)];
            ratio = (threshold-curr[2])/(last[2]-curr[2]);
            newPts.push(newPt);
            newPts.push([curr[0]+ratio*(last[0]-curr[0]),curr[1]+ratio*(last[1]-curr[1]),threshold]);
            while (pts[idx%(pts.length)] != newPts[0]) {
              newPts.push(pts[idx%(pts.length)])
              idx++;
            }
            pts = newPts.map(pt => pt.map(n => [n]));
          } else continue;
        }
        let centroid = center(pts);
        
        if (cameraDot > 0) dot = -dot;
        let rgb = null;
        if (poly.mtl in materials) rgb = materials[poly.mtl];
        else rgb = [128, 128, 128];
        rgb = rgb.map(n => n*(1-dot/3));
        pts.mtl = rgb;
        pts.meanZ = Math.sqrt((centroid[0])**2+(centroid[1])**2+(centroid[2])**2);
        renderList.push(pts);
      }
    }
    renderList.sort((a, b) => b.meanZ-a.meanZ);
    var canvasData = ctx.createImageData(canvas.width, canvas.height);
    let depthBuffer = Object.create(null);
    for (let pts of renderList) {      
      /*ctx.fillStyle = pts.mtl;
      ctx.strokeStyle = pts.mtl;
      ctx.lineWidth = 0;
      pts = pts.map(project)
      console.log(pts)
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.closePath();

      ctx.stroke();
      ctx.fill();//*/
      drawPoly(pts.map(pt => {let newPt = project(pt); newPt.depth = 1/pt[2][0];  return newPt;}), canvasData, depthBuffer, pts.mtl)
    }
    for (let i = 0; i < canvasData.height; i++) {
      for (let j = 0; j < canvasData.width; j++) {
        let index = (j + i * canvas.width) * 4;
        if (depthBuffer[index] === undefined) {
          canvasData.data[index] = 135;
          canvasData.data[index+1] = 206;
          canvasData.data[index+2] = 235;
          canvasData.data[index+3] = 255;
        }  
      }
    }
    ctx.putImageData(canvasData, 0, 0);
    if (gameActive) {
      if (keys["arrowleft"] || keys["a"]) {
        plane.update(-rollSpeed, "roll")
      }
      if (keys["arrowright"] || keys["d"]) {
        plane.update(rollSpeed, "roll")
      }
      if (keys["arrowup"] || keys["w"]) {
        plane.update(pitchSpeed*.7*(planeVel/planeBaseVel), "pitch")
      }
      if (keys["arrowdown"] || keys["s"]) {
        plane.update(-pitchSpeed*(planeVel/planeBaseVel), "pitch")
      }
      if (keys[" "]) {
        spawnShot(plane, true);
      }
      
      plane.moveInDirection(planeVel);
      enemy.moveInDirection(enemyVel);
      let enemyAboutToCrash = false;
      if (enemy.offset[0] > mapBoundaries[0] || enemy.offset[0] < mapBoundaries[1] || enemy.offset[2] > mapBoundaries[2] || 
      enemy.offset[2] < mapBoundaries[3]) {
        if (enemy.offset[1] < mapBoundaries[4]) enemyAboutToCrash = true;
      }
      for (let poly of map.polys) {
        if (sphereHitsPoly(plane.offset, planeRadius, poly)) {
          hp = 0;
          pain += 1;
        }
        if (sphereHitsPoly(enemy.offset, 1.8, poly)) {
          enemyHP = 0;
        }
        if (!enemyAboutToCrash && sphereHitsPoly(enemy.offset.map((n, idx) => [enemy.localFrame.roll[1], enemy.localFrame.roll[2], enemy.localFrame.roll[0]][idx]*50+n), 30, poly)) {
          enemyAboutToCrash = true;
        }
      }

      planeVel += Math.sin(plane.localFrame.roll[2] * -0.015);
      planeVel += (planeBaseVel-planeVel)/50;
      if (plane.offset[0] > mapBoundaries[0] || plane.offset[0] < mapBoundaries[1] || plane.offset[2] > mapBoundaries[2] || 
      plane.offset[2] < mapBoundaries[3]) {
        hp -= 0.03;
        pain += .052;
        drawText(ctx, "Return to battlefield", canvas.width/2, 30, 30, "red", "center", "georgia");
      }
      
      for (let bullet of bullets) {
        bullet.moveInDirection(bulletVel);
        bullet.distance += bulletVel;
        if (distance(bullet.offset, plane.offset) < planeRadius) {
          hp -= 5;
          pain += 0.2;
        }
        if (distance(bullet.offset, enemy.offset) < planeRadius*1.5) {
          enemyHP -= 5;
          ctx.drawImage(hitMarker, canvas.width/2+100, canvas.height/2-25, 50, 50);
        }
        if (bullet.distance > 200 || distance(bullet.offset, enemy.offset) < planeRadius * 1.5 || distance(bullet.offset, plane.offset) < planeRadius) {
          bullets.splice(bullets.indexOf(bullet), 1);
          shapes.splice(shapes.indexOf(bullet), 1);
        }
      }

      function perp(vec) {
          if (vec[1] === 0) return [0, Math.abs(vec[0])/vec[0]]
          return unit([1,-vec[0]/vec[1]])
      }
      if (enemyAboutToCrash) {
        enemy.update(enemyPitchSpeed * 1.25 * (enemy.localFrame.yaw[2] > 0 ? -1 : 1), "pitch")
        let perpendicular = perp([enemy.localFrame.roll[1], enemy.localFrame.roll[0]]);
        let distSideways = distInDir([perpendicular[0], 0, perpendicular[1]], null, [enemy.localFrame.yaw[1], enemy.localFrame.yaw[2], enemy.localFrame.yaw[0]]);
        if (distSideways !== 0) {
          if (distSideways > 0 === enemy.localFrame.roll[0] > 0) 
          enemy.update(enemyRollSpeed, "roll"); else enemy.update(-enemyRollSpeed, "roll");
        }
      } else {
      let target = enemyLeadsAim ? leadAim(enemy.offset, plane.offset, bulletVel*1.5, [plane.localFrame.roll[1], plane.localFrame.roll[2], plane.localFrame.roll[0]].map(n=>n*planeVel))[1] : plane.offset;
      let overallAngle = dotProduct(unit([enemy.localFrame.roll[1], enemy.localFrame.roll[2], enemy.localFrame.roll[0]]), unit(target.map((n, idx) => n-enemy.offset[idx])));
      let totalDist = Math.sqrt(plane.offset.map((n, idx) => (n-enemy.offset[idx])**2).reduce((a, b) => a+b));
      if (overallAngle < .9999) {
        let distSide = distInDir([enemy.localFrame.pitch[1], enemy.localFrame.pitch[2], enemy.localFrame.pitch[0]], enemy.offset, target);
        let distVert = distInDir([enemy.localFrame.yaw[1], enemy.localFrame.yaw[2], enemy.localFrame.yaw[0]], enemy.offset, target);
        let distFront = distInDir([enemy.localFrame.roll[1], enemy.localFrame.roll[2], enemy.localFrame.roll[0]], enemy.offset, target);
        let angle = Math.atan2(distVert, distSide);
        let vertAngle = Math.atan2(distVert, distFront);
        if (Math.abs(angle-Math.PI/2) < enemyRollSpeed) {
          enemy.update(angle-Math.PI/2, "roll");
          enemy.update(Math.max(-enemyPitchSpeed,-vertAngle), "pitch")
        } else if (distSide > 0) enemy.update(-enemyRollSpeed, "roll");
        else if (distSide < 0) enemy.update(enemyRollSpeed, "roll");
      }
      if (totalDist < 50 && Math.acos(overallAngle) < aimAssistRange) spawnShot(enemy);}
    }
    let difference = performance.now()-lastTime;
    lastTime = performance.now();
    drawText(ctx, "FPS: " + Math.round(1000/difference), canvas.width-57, canvas.height-12, 15, "black", "left");

    let hpColor = `rgb(${Math.min((100-hp)*255/50, 255)}, ${Math.min(hp*255/50, 255)}, 0)`;
    ctx.beginPath();
    ctx.fillStyle = "black";
    ctx.strokeWidth = 5;
    ctx.roundRect(canvas.width-103, 17, 86, 16, 8);
    ctx.fill();
    ctx.closePath();
    ctx.beginPath();
    ctx.fillStyle = hpColor;
    ctx.roundRect(canvas.width-100, 20, Math.max(80*hp/100, 2), 10, 5);
    ctx.fill();
    pain = gameActive ? Math.min(pain, .4) : pain;
    ctx.fillStyle = pain >= 0 ? `rgba(255, 0, 0, ${pain})` : `rgba(0, 255, 0, ${-pain})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pain = gameActive ? Math.max(pain-0.05, 0) : pain;

    if (gameActive) {
      if (hp <= 0) {
        fire = copyShape(fireTemplate);
        fire.move(minus(plane.offset, fire.offset))
        shapes.push(fire); gameActive = false; resume.visible = false;
        pain = .4;
      }
      if (enemyHP <= 0) {
        fire = copyShape(fireTemplate);
        fire.move(minus(enemy.offset, fire.offset));
        shapes.push(fire); gameActive = false; resume.visible = false;
        pain = 0;
      }
    } else {
      if (hp <= 0) {
        pain += 0.01;
        ctx.globalAlpha = Math.min(pain, .8);
        drawText(ctx, "You Died!", canvas.width/2, 50, 50, "black", "center", "Georgia");
        ctx.globalAlpha = 1;
        if (pain >= 1) {gameState = "menu"; document.exitPointerLock();}
      }
      if (enemyHP <= 0) {
        pain -= 0.02;
        ctx.globalAlpha = -Math.max(pain, -.8);
        drawText(ctx, "You Win!", canvas.width/2, 50, 50, "black", "center", "Georgia");
        ctx.globalAlpha = 1;
        if (pain <= -1) {gameState = "menu"; document.exitPointerLock();}
      }
    }    
  }
  canvas.style.cursor = "auto";
  if (gameState === "paused") {
    if (mouseDown) {
      (async function() {
        await canvas.requestPointerLock();
        if (document.pointerLockElement === canvas) gameState = "playing";
      })();
    }
  }
  if (gameState === "justPaused") {
    document.exitPointerLock();
    gameState = "paused";
    ctx.fillStyle = "rgba(175, 175, 175, 0.8)";
    ctx.beginPath();
    ctx.roundRect(canvas.width/2-300/canvasDivision, canvas.height/2-200/canvasDivision, 600/canvasDivision, 215/canvasDivision, 5);
    ctx.fill();
    drawText(ctx, "Paused!", canvas.width/2, canvas.height/2-140/canvasDivision, 60/canvasDivision, "black", "center", "Helvetica");
    drawText(ctx, "Click anywhere to resume", canvas.width/2, canvas.height/2-80/canvasDivision, 40/canvasDivision, "black", "center", "Helvetica");
    drawText(ctx, "Press 'm' to return to the menu", canvas.width/2, canvas.height/2-30/canvasDivision, 40/canvasDivision, "black", "center", "Helvetica");
  }
  if ((gameState === "playing" || gameState === "paused") && keys["m"]) {
    gameState = "menu";
    document.exitPointerLock();
  }
  if (gameState === "menu" || gameState === "credits" || gameState === "instructions") {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    clear(canvas);
    ctx.fillStyle = "lightblue";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (gameState === "menu") {
      let [width, height] = [getComputedStyle(canvas).width.replace("px", ""), getComputedStyle(canvas).height.replace("px", "")].map(Number);
      ctx.drawImage(thumbnail, width/2-(width+50)/2-(mouseX-50)/2, height/2 - (height+50)/2-(mouseY-50)/2, width+50, height+50);
      ctx.drawImage(logo, canvas.width/2-logo.width/2, 30, logo.width, logo.height);
    }
    for (let button of Button.buttons) {
      if (button.visible && button.props.targetScreen === gameState) {
        button.draw();
        if (mouseDown && button.isHovering(mouseX, mouseY)) button.props.event();
      }
    }
  }
  
  if (gameState === "credits") {
    drawText(ctx, "Credits", canvas.width/2, 30, 40, "black", "center", "Helvetica");
    drawText(ctx, "Valley Terrain by Zsky [CC-BY] (https://creativecommons.org/licenses/by/3.0/)", canvas.width/2, 70, 20, "black", "center", "Verdana");
    drawText(ctx, "via Poly Pizza (https://poly.pizza/m/u78ByZHYB2); modified", canvas.width/2, 92, 20, "black", "center", "Verdana");
    drawText(ctx, "Fire by Jakob Hippe [CC-BY] (https://poly.pizza/m/1QpMTUO7P-G)", canvas.width/2, 120, 20, "black", "center", "verdana");
    drawText(ctx, "Rotations code by Mike 'Pomax' Kamermans (https://stackoverflow.com/a/78518869/15938577)", canvas.width/2, 148, 20, "black", "center", "Verdana");
  }
  if (gameState === "instructions") {
    drawText(ctx, "Instructions", canvas.width/2, 30, 40, "black", "center", "Helvetica");
    drawText(ctx, "Use WASD to turn and aim your plane and space to shoot", canvas.width/2, 70, 20, "black", "center", "Trebuchet MS");
    drawText(ctx, "Use mouse to turn camera", canvas.width/2, 98, 20, "black", "center", "Trebuchet MS");
    drawText(ctx, "Shoot the enemy and avoid their shots", canvas.width/2, 126, 20, "black", "center", "Trebuchet MS");
    drawText(ctx, "And don't crash!", canvas.width/2, 154, 20, "black", "center", "Trebuchet MS");
  }
}, 20);

let bullets = [];
function spawnShot(from, target=false) {
  let shot = copyShape(bullet);
  shot.update(from.rotate[0], "yaw");
  shot.update(-from.rotate[1], "pitch");
  shot.move(from.offset.map((n, idx) => n-shot.offset[idx]));
  shot.moveInDirection(2+Math.random()-.5);
  shot.distance = 0;
  shapes.push(shot);
  bullets.push(shot);
  if (target && enemy !== null) {
    let lead = leadAim(plane.offset, enemy.offset, bulletVel, [enemy.localFrame.roll[1], enemy.localFrame.roll[2], enemy.localFrame.roll[0]].map(n=>n*enemyVel));
    let currentAim = [plane.localFrame.roll[1], plane.localFrame.roll[2], plane.localFrame.roll[0]];
    if (Math.acos(dotProduct(unit(lead[1].map((n, idx) => n-plane.offset[idx])), currentAim)) < aimAssistRange) {
      shot.localFrame.roll = [lead[0][2], lead[0][0], lead[0][1]];
    }
  }
  shot.localFrame.roll = unit(shot.localFrame.roll.map(n => n+(Math.random()-0.5)*0.05));
}

canvas.addEventListener("mousemove", function(e) {
  if (gameState === "playing") {
    camAngle[0] += e.movementX/200;
    camAngle[1] = Math.max(Math.min(camAngle[1]-e.movementY/200, Math.PI/2), -Math.PI/2);
  } else {
    let bd = canvas.getBoundingClientRect();
    let mousePos = [(e.clientX - bd.left)*canvas.width/Number(getComputedStyle(canvas).width.replace("px", "")), (e.clientY - bd.top)*canvas.height/Number(getComputedStyle(canvas).height.replace("px", ""))];
    mouseX = mousePos[0]/canvas.width*100; mouseY = mousePos[1]/canvas.height*100;
  }
});
canvas.addEventListener("mousedown", function(e) {
  if (e.buttons !== 1) {e.preventDefault(); e.stopPropagation();return;}
  mouseDown = true;
});
canvas.addEventListener("contextmenu", e => e.preventDefault());
document.addEventListener("mouseup", function() {
  mouseDown = false;
});

class Button {
	static buttons = [];
	constructor(left, top, width, height, fill, text, targetScreen, event=function(){}) {
		this.props = {left, top, width, height, fill, text, targetScreen, event};
		Button.buttons.push(this);
		this.visible = true;
	}
	isHovering(x, y) {
		return this.visible && x >= this.props.left && x <= this.props.left + this.props.width && y >= this.props.top && y <= this.props.top + this.props.height;
	}
	draw() {
		ctx.beginPath();
		ctx.fillStyle = this.isHovering(mouseX, mouseY) ? "grey" : this.props.fill;
		ctx.roundRect(this.props.left*canvas.width/100, this.props.top*canvas.height/100, this.props.width*canvas.width/100, this.props.height*canvas.height/100, 3);
		ctx.fill();
		ctx.textAlign = "center";
		ctx.textBaseline = 'middle';
		drawText(ctx, this.props.text.value, (this.props.left+this.props.width/2)*canvas.width/100, 
      (this.props.top+this.props.height/2)*canvas.height/100, this.props.text.size, "black", "center", this.props.text.font);
		ctx.textBaseline = 'alphabetic';
		if (this.isHovering(mouseX, mouseY)) canvas.style.cursor = ("pointer");
	}
}
let play = new Button(40, 72.5, 15, 10, "rgb(150, 150, 150)", {value:"Begin Mission", font:"Courier, monospace", size:20}, "menu", async function() {
  await canvas.requestPointerLock();
  if (document.pointerLockElement === canvas) {
    resetValues();
    gameState = "playing";
    resume.visible = true;
  }
});
let resume = new Button(40, 60, 15, 10, "rgb(150, 150, 150)", {value:"Resume Mission", font:"Courier, monospace", size:20}, "menu", async function() {
  await canvas.requestPointerLock();
  if (document.pointerLockElement === canvas) {
    gameState = "playing";
  }
});
resume.visible = false;
let credits = new Button(51.5, 85, 15, 10, "rgb(150, 150, 150)", {value:"Credits", font:"Courier, monospace", size:20}, "menu", function() {
  gameState = "credits";
  mouseDown = false;
});
let instructions = new Button(29.5, 85, 15, 10, "rgb(150, 150, 150)", {value:"Instructions", font:"Courier, monospace", size:20}, "menu", function() {
  gameState = "instructions";
  mouseDown = false;
});
let github = new Button(87, 88, 12, 10, "rgb(150, 150, 150)", {value:"Github", font:"Courier, monospace", size:20}, "menu", function() {
  let link = document.createElement("a");
  link.href = "https://github.com/gosoccerboy5/plane-battle";
  link.target = "_blank";
  link.click();
  mouseDown = false;
});
let backhome = new Button(42.5, 70, 15, 10, "rgb(150, 150, 150)", {value:"Home", font:"Courier, monospace", size:20}, "credits", function() {
  gameState = "menu";
  mouseDown = false;
});
let backhome2 = new Button(42.5, 70, 15, 10, "rgb(150, 150, 150)", {value:"Home", font:"Courier, monospace", size:20}, "instructions", function() {
  gameState = "menu";
  mouseDown = false;
});

let thumbnail = new Image();
thumbnail.src = "https://gosoccerboy5.github.io/plane-battle/assets/thumb_blurred.png";
let logo = new Image();
logo.src = "https://gosoccerboy5.github.io/plane-battle/assets/logo.png";
let hitMarker = new Image();
hitMarker.src = "https://gosoccerboy5.github.io/plane-battle/assets/crosshair.svg";

function drawText(ctx, text, x, y, size=10, color="black", align="center", font="Arial") {
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.textAlign = align;
  ctx.font = size + "px " + font;
  ctx.fillText(text, x, y);
}

let fileInput = document.querySelector("input[type=file]");
if (fileInput !== null) {
  fileInput.addEventListener("input", async function(e) {
    let fileType = this.files[0].name.match(/\.(\w+)$/)[1];
    let reader = new FileReader();
    reader.readAsText(this.files[0])
    reader.onload = () => {
      if (fileType === "obj") shapes.push(processObj(reader.result));
      else if (fileType === "mtl") processMtl(reader.result);
    }
  });
}
function copyShape(shape) {
  let newShape = new Shape([]);
  for (let poly of shape.polys) {
    let newPoly = poly.map(pt => pt.map(n=>n));
    newPoly.mtl = poly.mtl;
    newShape.polys.push(newPoly);
  }
  newShape.updateCrossProducts();
  return newShape;
}

function processObj(text) {
  let vertices = text.match(/\nv (.+?) (.+?) (.+)/g);
  vertices = vertices.map(vertex => vertex.match(/ ([-\.\d]+)/g).map(Number));
  let shape = new Shape([]);
  let materialSections = text.match(/(usemtl .+)(\n|\r)+((?!usemtl).+?(\n|\r)?)+/g) || [text];
  for (let materialSection of materialSections) {
    let mtl = materialSection.match(/usemtl (.+)(\n|\r)/)?.[1];
    let polys = materialSection.match(/(\n|\r)f (\d+\/\d+\/\d+ ?)+/g);

    for (let poly of polys) {
      let pts = poly.match(/ \d+/g).map(pt => vertices[Number(pt)-1].map(n=>n));
      pts.mtl = mtl;
      shape.polys.push(pts);
    }
  }
  shape.offset = center(shape.polys.map(center))
  shape.updateCrossProducts();
  return shape;
}
let materials = {};
function processMtl(text) {
  let mtls = text.match(/[\n^]*newmtl ((.+)\n)+/g);
  for (let material of mtls) {
    let name = material.match(/[\n^] *newmtl (.+)\n/)[1];
    let color = material.match(/\n *Kd ((\d\.?\d*[ \n]){3})/)[1].split(" ").map(n=>256*Number(n));
    materials[name] = color;
  }
}


let keys = {};
let mouseDown = false;
let mouseX = 0, mouseY = 0;
document.addEventListener("keydown", function(e) {
	keys[e.key.toLowerCase()] = true;
});
document.addEventListener("keyup", function(e) {
	delete keys[e.key.toLowerCase()];
});

["bullet", "plane", "map", "enemy", "fire"].forEach(name => {
  fetch("https://gosoccerboy5.github.io/plane-battle/assets/" + name + ".mtl").then(res => res.text()).then(mtl => {
    processMtl(mtl);
  });
});

let planeTemplate = null, mapTemplate = null, bullet = null, enemyTemplate = null, fireTemplate = null;
Object.defineProperty(window, "isLoading", {
  get() {return [planeTemplate, mapTemplate, bullet, enemyTemplate, fireTemplate].some(template => template === null);},
});

fetch("https://gosoccerboy5.github.io/plane-battle/assets/plane.obj").then(res => res.text()).then(obj => {
  planeTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("https://gosoccerboy5.github.io/plane-battle/assets/bullet.obj").then(res => res.text()).then(obj => {
  bullet = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("https://gosoccerboy5.github.io/plane-battle/assets/map.obj").then(res => res.text()).then(obj => {
  mapTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("https://gosoccerboy5.github.io/plane-battle/assets/enemy.obj").then(res => res.text()).then(obj => {
  enemyTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
fetch("https://gosoccerboy5.github.io/plane-battle/assets/fire.obj").then(res => res.text()).then(obj => {
  fireTemplate = processObj(obj);
  if (!isLoading) resetValues();
});
