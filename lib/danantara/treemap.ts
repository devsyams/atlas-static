export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Squarified treemap (Bruls, Huizing & van Wijk 2000). Lays `items` (by value)
 * into `rect`, favouring near-square tiles. Returns a rect per input index, in
 * input order. Pure — used for the portfolio hero (nested: sectors → holdings).
 */
export function squarify(items: { i: number; v: number }[], rect: Rect): Map<number, Rect> {
  const out = new Map<number, Rect>();
  const total = items.reduce((a, b) => a + b.v, 0);
  if (total <= 0 || rect.w <= 0 || rect.h <= 0) return out;

  const area = rect.w * rect.h;
  const nodes = items.map((it) => ({ i: it.i, a: (it.v / total) * area }));

  const shortest = (r: Rect) => Math.max(1e-6, Math.min(r.w, r.h));
  const worst = (row: number[], side: number) => {
    if (!row.length) return Infinity;
    const s = row.reduce((a, b) => a + b, 0);
    const max = Math.max(...row);
    const min = Math.min(...row);
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };

  const place = (row: { i: number; a: number }[], r: Rect): Rect => {
    const sum = row.reduce((a, b) => a + b.a, 0);
    if (r.w >= r.h) {
      const colW = sum / r.h;
      let y = r.y;
      for (const n of row) {
        const hh = n.a / colW;
        out.set(n.i, { x: r.x, y, w: colW, h: hh });
        y += hh;
      }
      return { x: r.x + colW, y: r.y, w: r.w - colW, h: r.h };
    }
    const rowH = sum / r.w;
    let x = r.x;
    for (const n of row) {
      const ww = n.a / rowH;
      out.set(n.i, { x, y: r.y, w: ww, h: rowH });
      x += ww;
    }
    return { x: r.x, y: r.y + rowH, w: r.w, h: r.h - rowH };
  };

  let r: Rect = { ...rect };
  let row: { i: number; a: number }[] = [];
  let i = 0;
  while (i < nodes.length) {
    const side = shortest(r);
    const cur = row.map((n) => n.a);
    const next = [...cur, nodes[i].a];
    if (row.length === 0 || worst(next, side) <= worst(cur, side)) {
      row.push(nodes[i]);
      i++;
    } else {
      r = place(row, r);
      row = [];
    }
  }
  if (row.length) place(row, r);
  return out;
}

/** Inset a rect by `pad` on every side (and optionally a header strip on top). */
export function inset(r: Rect, pad: number, top = 0): Rect {
  return {
    x: r.x + pad,
    y: r.y + pad + top,
    w: Math.max(0, r.w - pad * 2),
    h: Math.max(0, r.h - pad * 2 - top),
  };
}
