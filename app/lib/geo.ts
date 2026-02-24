/**
 * Split a polyline into segments wherever it crosses the antimeridian (±180°).
 * This prevents Leaflet from drawing a horizontal line across the entire map.
 */
export function splitAtAntimeridian(pts: [number, number][]): [number, number][][] {
  if (pts.length < 2) return [pts];

  const segments: [number, number][][] = [];
  let seg: [number, number][] = [pts[0]];

  for (let i = 1; i < pts.length; i++) {
    const [lat2, lon2] = pts[i];
    const [lat1, lon1] = seg[seg.length - 1];
    const diff = lon2 - lon1;

    if (Math.abs(diff) > 180) {
      // Normalise to the "short" crossing direction
      const shortDiff = diff > 180 ? diff - 360 : diff + 360;
      const exitLon  = shortDiff < 0 ? -180 :  180;
      const enterLon = shortDiff < 0 ?  180 : -180;
      const t = Math.abs(exitLon - lon1) / Math.abs(shortDiff);
      const crossLat = lat1 + t * (lat2 - lat1);

      seg.push([crossLat, exitLon]);
      segments.push(seg);
      seg = [[crossLat, enterLon], [lat2, lon2]];
    } else {
      seg.push([lat2, lon2]);
    }
  }

  segments.push(seg);
  return segments;
}

export function greatCirclePoints(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  n = 80
): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;

  const φ1 = toRad(lat1), λ1 = toRad(lon1);
  const φ2 = toRad(lat2), λ2 = toRad(lon2);

  const x1 = Math.cos(φ1) * Math.cos(λ1), y1 = Math.cos(φ1) * Math.sin(λ1), z1 = Math.sin(φ1);
  const x2 = Math.cos(φ2) * Math.cos(λ2), y2 = Math.cos(φ2) * Math.sin(λ2), z2 = Math.sin(φ2);

  const d = Math.acos(Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2)));
  if (d < 1e-6) return [[lat1, lon1]];

  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const A = Math.sin((1 - t) * d) / Math.sin(d);
    const B = Math.sin(t * d) / Math.sin(d);
    const x = A * x1 + B * x2, y = A * y1 + B * y2, z = A * z1 + B * z2;
    pts.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
  }
  return pts;
}
