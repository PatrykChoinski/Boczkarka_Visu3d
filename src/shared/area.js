// Obszar stolu i kamienia jak w PLC (Settings/WorkArea): do 8 wierzcholkow XYZ zapisanych z pozycji osi
// (aCuttingBoardX/Y/Z, aCuttingRockX/Y/Z [0..7]), liczba wierzcholkow iCuttingBoardApexNumber /
// iCuttingRockApexNumber. Wysokosc materialu jak w PLC: fCutMaterialHeight := fCuttingBoardZMin - grubosc.

export const MAX_APEX = 8;

// Wierzcholki [[x, y, z], ...] z tablic PLC (pierwsze count punktow)
export function apexPoints(xs, ys, zs, count) {
  const n = Math.max(0, Math.min(MAX_APEX, Math.round(Number(count) || 0)));
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([Number(xs?.[i]) || 0, Number(ys?.[i]) || 0, Number(zs?.[i]) || 0]);
  return pts;
}

// fCuttingBoardZMin jak w WorkArea: pierwszy punkt zawsze, kolejne tylko z Z > 0 (niezapisane = 0)
export function boardZMin(points) {
  if (!points.length) return null;
  let z = points[0][2];
  for (let i = 1; i < points.length; i++) if (points[i][2] > 0) z = Math.min(z, points[i][2]);
  return z;
}

export function polygonArea(points) {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    s += x0 * y1 - x1 * y0;
  }
  return s / 2;
}

// Wielokat (co najmniej 3 punkty, niezerowe pole)
export const isArea = (points) => points.length >= 3 && Math.abs(polygonArea(points)) > 1;

// [minX, minY, maxX, maxY] albo null
export function bounds(points) {
  if (!points.length) return null;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Prostokat jako 4 wierzcholki (wartosci domyslne, testowy PLC)
export const rectangle = (x0, y0, x1, y1, z) => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
