/**
 * Усечённый икосаэдр: 12 пятиугольников + 20 шестиугольников (выкройка под скрутку).
 * Грани плоские и правильные, соседние грани делят ребро точно (общие вершины).
 *
 * Развёртка: остовное дерево граней, каждая грань висит на «шарнире» — общем ребре
 * с родителем. Складывание = поворот грани вокруг шарнира на угол между нормалями,
 * поэтому в любой момент анимации рёбра шарниров совпадают, а при s = 0 мяч замкнут.
 */

const PHI = (1 + Math.sqrt(5)) / 2;
const SIZE = 1.5;

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => scale(a, 1 / (len(a) || 1));

const ICO = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1]
].map(norm);

const TRI = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
  [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
  [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]
];

/* ---------- жёсткие преобразования {R: 3x3 построчно, t: vec3} ---------- */

const IDENT = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0] };

function mulRv(R, v) {
  return [
    R[0] * v[0] + R[1] * v[1] + R[2] * v[2],
    R[3] * v[0] + R[4] * v[1] + R[5] * v[2],
    R[6] * v[0] + R[7] * v[1] + R[8] * v[2]
  ];
}

function mulRR(A, B) {
  const out = new Array(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
    }
  }
  return out;
}

/** A ∘ B: сначала B, потом A. */
function compose(A, B) {
  return { R: mulRR(A.R, B.R), t: add(mulRv(A.R, B.t), A.t) };
}

function applyT(T, p) {
  return add(mulRv(T.R, p), T.t);
}

function rotAxis(axis, ang) {
  const [x, y, z] = axis;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const k = 1 - c;
  return [
    c + x * x * k, x * y * k - z * s, x * z * k + y * s,
    y * x * k + z * s, c + y * y * k, y * z * k - x * s,
    z * x * k - y * s, z * y * k + x * s, c + z * z * k
  ];
}

/** Поворот вокруг прямой A→B. */
function hinge(A, B, ang) {
  const R = rotAxis(norm(sub(B, A)), ang);
  return { R, t: sub(A, mulRv(R, A)) };
}

/* ---------- грани ---------- */

function orientOutward(face) {
  const v = face.verts;
  let n = [0, 0, 0];
  for (let i = 0; i < v.length; i++) n = add(n, cross(v[i], v[(i + 1) % v.length]));
  if (dot(n, face.center) < 0) {
    face.verts.reverse();
    face.keys.reverse();
  }
  face.normal = norm(face.center);
}

function buildFaces() {
  const point = (a, b) => scale(add(ICO[a], scale(sub(ICO[b], ICO[a]), 1 / 3)), SIZE);
  const neighbors = ICO.map(() => new Set());
  for (const [a, b, c] of TRI) {
    neighbors[a].add(b).add(c);
    neighbors[b].add(a).add(c);
    neighbors[c].add(a).add(b);
  }

  const faces = [];

  for (let v = 0; v < ICO.length; v++) {
    const axis = ICO[v];
    const ref = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const e1 = norm(cross(axis, ref));
    const e2 = cross(axis, e1);
    const ring = [...neighbors[v]].map((n) => ({ key: v + ">" + n, p: point(v, n) }));
    const center = scale(axis, dot(ring[0].p, axis));
    ring.sort((A, B) => {
      const da = sub(A.p, center);
      const db = sub(B.p, center);
      return Math.atan2(dot(da, e2), dot(da, e1)) - Math.atan2(dot(db, e2), dot(db, e1));
    });
    const face = {
      id: faces.length,
      kind: "pent",
      keys: ring.map((r) => r.key),
      verts: ring.map((r) => r.p),
      center
    };
    orientOutward(face);
    faces.push(face);
  }

  for (const [a, b, c] of TRI) {
    const pairs = [[a, b], [b, a], [b, c], [c, b], [c, a], [a, c]];
    const verts = pairs.map(([x, y]) => point(x, y));
    const center = scale(verts.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / 6);
    const face = {
      id: faces.length,
      kind: "hex",
      keys: pairs.map(([x, y]) => x + ">" + y),
      verts,
      center
    };
    orientOutward(face);
    faces.push(face);
  }

  return faces;
}

function buildEdges(faces) {
  const edges = new Map();
  for (const f of faces) {
    const n = f.keys.length;
    for (let i = 0; i < n; i++) {
      const k1 = f.keys[i];
      const k2 = f.keys[(i + 1) % n];
      const key = k1 < k2 ? k1 + "|" + k2 : k2 + "|" + k1;
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push({ face: f.id, edge: i });
    }
  }
  const adj = faces.map(() => []);
  for (const list of edges.values()) {
    if (list.length !== 2) throw new Error("ШАР: ребро без пары");
    const [x, y] = list;
    adj[x.face].push({ to: y.face, edge: x.edge });
    adj[y.face].push({ to: x.face, edge: y.edge });
  }
  for (const list of adj) list.sort((p, q) => p.edge - q.edge);
  return adj;
}

/* ---------- развёртка: дерево шарниров ---------- */

function buildTree(faces, adj, root, depthFirst) {
  const parent = faces.map(() => -1);
  const hingeA = [];
  const hingeB = [];
  const angle = faces.map(() => 0);
  const order = [];
  const seen = new Set([root]);
  const frontier = [root];
  while (frontier.length) {
    const f = depthFirst ? frontier.pop() : frontier.shift();
    for (const { to, edge } of adj[f]) {
      if (seen.has(to)) continue;
      seen.add(to);
      const pf = faces[f];
      const A = pf.verts[edge];
      const B = pf.verts[(edge + 1) % pf.verts.length];
      const axis = norm(sub(B, A));
      const nf = pf.normal;
      const nc = faces[to].normal;
      const a = Math.acos(Math.max(-1, Math.min(1, dot(nf, nc))));
      const test = mulRv(rotAxis(axis, a), nc);
      parent[to] = f;
      hingeA[to] = A;
      hingeB[to] = B;
      angle[to] = dot(test, nf) > 0.9999 ? a : -a;
      order.push(to);
      frontier.push(to);
    }
  }
  return { root, parent, hingeA, hingeB, angle, order };
}

/** s = 1 — плоский лист, s = 0 — замкнутый мяч. Координаты — система мяча. */
function treeTransforms(tree, s) {
  const T = new Array(tree.parent.length);
  T[tree.root] = IDENT;
  for (const f of tree.order) {
    T[f] = compose(T[tree.parent[f]], hinge(tree.hingeA[f], tree.hingeB[f], s * tree.angle[f]));
  }
  return T;
}

function polygonsOverlap(P, Q) {
  for (const poly of [P, Q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const nx = b[1] - a[1];
      const ny = a[0] - b[0];
      let pMin = Infinity, pMax = -Infinity, qMin = Infinity, qMax = -Infinity;
      for (const p of P) {
        const d = p[0] * nx + p[1] * ny;
        pMin = Math.min(pMin, d);
        pMax = Math.max(pMax, d);
      }
      for (const q of Q) {
        const d = q[0] * nx + q[1] * ny;
        qMin = Math.min(qMin, d);
        qMax = Math.max(qMax, d);
      }
      if (pMax <= qMin || qMax <= pMin) return false;
    }
  }
  return true;
}

/** 2D-проекция для выбора развёртки (не для отрисовки). Лёгкий shrink — только SAT-проверка. */
function flatPolygons(faces, tree) {
  const T = treeTransforms(tree, 1);
  const root = faces[tree.root];
  const e1 = norm(sub(root.verts[0], root.center));
  const e2 = cross(root.normal, e1);
  return faces.map((f) => {
    const pts = f.verts.map((v) => {
      const p = sub(applyT(T[f.id], v), root.center);
      return [dot(p, e1), dot(p, e2)];
    });
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return pts.map(([x, y]) => [cx + (x - cx) * 0.98, cy + (y - cy) * 0.98]);
  });
}

function countOverlaps(polys) {
  let n = 0;
  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) {
      if (polygonsOverlap(polys[i], polys[j])) n++;
    }
  }
  return n;
}

/** Минимальный по площади прямоугольник (перебор углов) — для компактного листа. */
function bestTwist(polys) {
  const pts = polys.flat();
  let best = { area: Infinity, ang: 0, w: 0, d: 0 };
  for (let deg = 0; deg < 180; deg += 2) {
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      const u = x * c + y * s;
      const v = -x * s + y * c;
      minX = Math.min(minX, u);
      maxX = Math.max(maxX, u);
      minY = Math.min(minY, v);
      maxY = Math.max(maxY, v);
    }
    let w = maxX - minX;
    let d = maxY - minY;
    let ang = a;
    if (d > w) {
      [w, d] = [d, w];
      ang = a + Math.PI / 2;
    }
    if (w * d < best.area) best = { area: w * d, ang, w, d };
  }
  return best;
}

function pickNet(faces, adj) {
  let best = null;
  for (const depthFirst of [false, true]) {
    for (let root = 0; root < faces.length; root++) {
      const tree = buildTree(faces, adj, root, depthFirst);
      const polys = flatPolygons(faces, tree);
      const overlaps = countOverlaps(polys);
      const twist = bestTwist(polys);
      const score = overlaps * 1000 + twist.area;
      if (!best || score < best.score) best = { score, overlaps, tree, twist };
    }
  }
  return best;
}

/* ---------- сборка модели ---------- */

const faces = buildFaces();
const adjacency = buildEdges(faces);
const net = pickNet(faces, adjacency);
const netOverlaps = net.overlaps;
const tree = net.tree;

/**
 * Мировое преобразование: корневая грань лежит на столе (y = 0) лицом вниз,
 * т.е. наружная сторона мяча смотрит в стол, а внутренняя — вверх, к игроку.
 * Сложенный мяч стоит на этой грани.
 */
const WORLD = (() => {
  const root = faces[tree.root];
  const n = root.normal;
  const e1 = norm(sub(root.verts[0], root.center));
  const e2 = cross(n, e1);
  const c = Math.cos(net.twist.ang);
  const s = Math.sin(net.twist.ang);
  const bx = norm(add(scale(e1, c), scale(e2, s)));
  const by = scale(n, -1);
  const bz = cross(bx, by);
  const R = [...bx, ...by, ...bz];
  let W = { R, t: scale(mulRv(R, root.center), -1) };

  const T = treeTransforms(tree, 1);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const f of faces) {
    for (const v of f.verts) {
      const p = applyT(W, applyT(T[f.id], v));
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minZ = Math.min(minZ, p[2]);
      maxZ = Math.max(maxZ, p[2]);
    }
  }
  W = { R, t: add(W.t, [-(minX + maxX) / 2, 0, -(minZ + maxZ) / 2]) };
  return { W, w: maxX - minX, d: maxZ - minZ };
})();

/** Размер плоского листа на столе (x — ширина, z — глубина). */
const netSize = { w: WORLD.w, d: WORLD.d };
/** Центр сложенного мяча в мировых координатах. */
const ballCenter = WORLD.W.t.slice();
const ballRadius = len(faces[0].verts[0]);

/**
 * Мировые преобразования всех граней.
 * fold = 0 — лист на столе, fold = 1 — замкнутый мяч.
 */
function foldTransforms(fold) {
  const T = treeTransforms(tree, 1 - fold);
  return T.map((t) => compose(WORLD.W, t));
}

const EPS = 1e-7;

function faceWorldNormal(wv) {
  let n = [0, 0, 0];
  for (let i = 0; i < wv.length; i++) n = add(n, cross(wv[i], wv[(i + 1) % wv.length]));
  return norm(n);
}

function pointInConvexPoly3(p, poly, outward) {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const e = sub(b, a);
    const ap = sub(p, a);
    if (dot(cross(e, ap), outward) < -EPS) return false;
  }
  return true;
}

/**
 * Сквозной прокол: луч vs все грани в текущей позе (мировые вершины).
 * Возвращает [{ id, t, point:[x,y,z] }] по возрастанию t, без дублей id.
 */
function pierceAlongRay(origin, dir, worldVertsByFace) {
  const o = [origin[0], origin[1], origin[2]];
  const d = norm([dir[0], dir[1], dir[2]]);
  const hits = [];
  for (let i = 0; i < worldVertsByFace.length; i++) {
    const wv = worldVertsByFace[i];
    if (!wv || wv.length < 3) continue;
    const n = faceWorldNormal(wv);
    const denom = dot(n, d);
    if (Math.abs(denom) < EPS) continue;
    const t = dot(n, sub(wv[0], o)) / denom;
    if (t < EPS) continue;
    const p = add(o, scale(d, t));
    if (pointInConvexPoly3(p, wv, n)) hits.push({ id: i, t, point: p });
  }
  hits.sort((a, b) => a.t - b.t);
  const out = [];
  const seen = new Set();
  for (const h of hits) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    out.push(h);
  }
  return out;
}

/* ---------- под-ячейки на панели (сгиб тот же, больше игровых клеток) ---------- */

function faceFrame(face) {
  const c = face.center;
  const e1 = norm(sub(face.verts[0], c));
  const e2 = cross(face.normal, e1);
  const r = len(sub(face.verts[0], c));
  return { c, e1, e2, r };
}

function subCellCount(face) {
  return face.kind === "pent" ? 2 : 3;
}

/** Пента: одна линия между «плечами» → треугольник (верх) + трапеция (низ). */
function pentSplit2D(poly) {
  let top = 0;
  for (let i = 1; i < 5; i++) {
    if (poly[i][1] > poly[top][1]) top = i;
  }
  const left = (top + 1) % 5;
  const right = (top + 4) % 5;
  const triangle = [poly[top], poly[left], poly[right]];
  const trapezoid = [poly[left], poly[(left + 1) % 5], poly[(left + 2) % 5], poly[right]];
  return { triangle, trapezoid, left, right };
}

function subPolys2D(face) {
  const { c, e1, e2 } = faceFrame(face);
  const poly = face.verts.map((v) => {
    const d = sub(v, c);
    return [dot(d, e1), dot(d, e2)];
  });
  if (face.kind === "pent") {
    const { triangle, trapezoid } = pentSplit2D(poly);
    return [triangle, trapezoid];
  }
  const cx = poly.reduce((s, p) => s + p[0], 0) / 6;
  const cy = poly.reduce((s, p) => s + p[1], 0) / 6;
  const m = [cx, cy];
  return [
    [m, poly[0], poly[1], poly[2]],
    [m, poly[2], poly[3], poly[4]],
    [m, poly[4], poly[5], poly[0]]
  ];
}

function inPoly2(pt, poly) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cr = (b[0] - a[0]) * (pt[1] - a[1]) - (b[1] - a[1]) * (pt[0] - a[0]);
    if (Math.abs(cr) < 1e-9) continue;
    const s = cr > 0 ? 1 : -1;
    if (!sign) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function tangentCoords(face, localPoint) {
  const { c, e1, e2 } = faceFrame(face);
  const d = sub(localPoint, c);
  return [dot(d, e1), dot(d, e2)];
}

function subCellAtPoint(face, u, v) {
  const polys = subPolys2D(face);
  for (let i = 0; i < polys.length; i++) {
    if (inPoly2([u, v], polys[i])) return i;
  }
  return 0;
}

function localFromTangent(face, u, v) {
  const { c, e1, e2 } = faceFrame(face);
  return add(c, add(scale(e1, u), scale(e2, v)));
}

/** Отрезки crease в координатах e1/e2 (совпадают с subPolys2D). */
function subCellCreaseSegmentsTangent(face) {
  const { c, e1, e2 } = faceFrame(face);
  const poly = face.verts.map((v) => {
    const d = sub(v, c);
    return [dot(d, e1), dot(d, e2)];
  });
  if (face.kind === "pent") {
    const { left, right } = pentSplit2D(poly);
    return [[poly[left], poly[right]]];
  }
  const polys = subPolys2D(face);
  const m = polys[0][0];
  return [
    [m, polys[0][1]],
    [m, polys[1][1]],
    [m, polys[2][1]]
  ];
}

function subCellCreasesLocal(face) {
  if (face.kind === "pent") {
    const { c, e1, e2 } = faceFrame(face);
    const poly = face.verts.map((v) => {
      const d = sub(v, c);
      return [dot(d, e1), dot(d, e2)];
    });
    const { left, right } = pentSplit2D(poly);
    return [[face.verts[left], face.verts[right]]];
  }
  return subCellCreaseSegmentsTangent(face).map(([a, b]) => [
    localFromTangent(face, a[0], a[1]),
    localFromTangent(face, b[0], b[1])
  ]);
}

function subCellUvCenter(face, sub) {
  const polys = subPolys2D(face);
  const reg = polys[sub];
  const u = reg.reduce((s, p) => s + p[0], 0) / reg.length;
  const v = reg.reduce((s, p) => s + p[1], 0) / reg.length;
  const { r } = faceFrame(face);
  return [0.5 + u / (2 * r), 0.5 + v / (2 * r)];
}

const logicalCellCount = faces.reduce((s, f) => s + subCellCount(f), 0);

/** Центр под-ячейки в координатах e1/e2 (для проверки «рядом с танком»). */
function subCellTangentCenter(face, sub) {
  const polys = subPolys2D(face);
  const reg = polys[sub];
  const u = reg.reduce((s, p) => s + p[0], 0) / reg.length;
  const v = reg.reduce((s, p) => s + p[1], 0) / reg.length;
  return [u, v];
}
