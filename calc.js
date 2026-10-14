// Feltouch RT60 calculation — a port of the engine behind https://rt60.feltouch.tr
// Sabine:  T = 0.161 · V / A     A = Σ (S · α)   (octave bands 125 Hz – 4 kHz)
// Headline value = mean of the 500 Hz and 1 kHz bands (same as the website).
const FeltouchCalc = (() => {
  const SURFACES = ["floor", "ceiling", "wall1", "wall2", "wall3", "wall4"];

  const isAreaType = p => p.add === null || p.add === 1 || p.add === 2;
  // equivalent absorbing area (m²) of `qty` units/m² of a product
  const equivArea = (p, qty) => {
    const f = p.add == null ? 1 : p.add;
    if (!isAreaType(p)) return Math.max(0, qty) * f;
    return f === 2 ? Math.max(0, qty) * 2 : Math.max(0, qty);
  };
  const matAlpha = (id, f) => FT.materials[id].alpha[FT.freqAlphaMap[f]] || 0; // materials use the shifted band key
  const prodAlpha = (p, f) => p.alpha[String(f)] || 0;

  function compute(sc) {
    const { w, l, h } = sc.dims;
    const V = w * l * h;
    const gross = { floor: w * l, ceiling: w * l, wall1: w * h, wall2: w * h, wall3: l * h, wall4: l * h };
    const openings = { wall1: 0, wall2: 0, wall3: 0, wall4: 0 };
    const doorArea = sc.door === false ? 0 : FT.door.w * FT.door.h;
    if (doorArea) openings.wall1 += doorArea;
    const wins = (sc.windows || []).map(x => ({ ...x, wall: "wall" + x.wall.slice(1), area: x.w * x.h }));
    wins.forEach(x => { openings[x.wall] += x.area; });
    const net = { ...gross };
    ["wall1", "wall2", "wall3", "wall4"].forEach(k => { net[k] = Math.max(0, gross[k] - openings[k]); });

    const mats = { floor: sc.materials.floor, ceiling: sc.materials.ceiling };
    ["wall1", "wall2", "wall3", "wall4"].forEach(k => { mats[k] = sc.materials.walls; });

    const eq = {}, sub = {};
    SURFACES.forEach(s => { eq[s] = 0; sub[s] = 0; });
    const items = sc.solution.map(it => {
      const p = FT.products[it.product];
      const e = equivArea(p, it.qty);
      eq[it.surface] += e;
      if (isAreaType(p)) sub[it.surface] += Math.max(0, it.qty);
      return { ...it, p, eqArea: e, area: isAreaType(p) };
    });

    const rows = FT.freqs.map(f => {
      let open = doorArea * matAlpha(sc.door === false ? "wood" : "wood", f);
      wins.forEach(x => { open += x.area * matAlpha("glass", f); });
      let base = open, after = open;
      SURFACES.forEach(s => {
        const a = matAlpha(mats[s], f);
        base += net[s] * a;
        after += Math.max(0, net[s] - sub[s]) * a;
      });
      items.forEach(it => { after += it.eqArea * prodAlpha(it.p, f); });
      const tb = base > 0 ? 0.161 * V / base : Infinity;
      const ta = after > 0 ? 0.161 * V / after : Infinity;
      return { f, base: tb, after: ta, improvement: (tb - ta) / tb * 100 };
    });

    const mean = fn => { const r = rows.filter(x => x.f === 500 || x.f === 1000); return r.reduce((s, x) => s + fn(x), 0) / r.length; };
    const before = mean(x => x.base), after = mean(x => x.after);

    const totalSurface = SURFACES.reduce((s, k) => s + net[k], 0);
    const treated = items.reduce((s, it) => s + it.eqArea, 0);
    const lines = items.map(it => {
      const p = it.p;
      let pieces = null;
      if (it.area) {
        if (p.axisM) pieces = Math.round(it.qty / (p.axisM * p.lenM));
        else if (p.moduleM2) pieces = Math.round(it.qty / p.moduleM2);
      }
      return {
        product: it.product, series: p.series, name: p.name.replace(new RegExp("^" + p.series + "\\s+", "i"), "").replace("FETLFILL", "FELTFILL"),
        kind: p.kind, surface: it.surface, area: it.area,
        qty: it.qty, eqArea: it.eqArea, pieces, moduleLabel: p.moduleLabel || null
      };
    });

    return {
      volume: V, dims: sc.dims, rows, before, after,
      improvement: (before - after) / before * 100,
      deltaDb: 10 * Math.log10(before / after),
      treated, totalSurface, coverage: treated / totalSurface, lines
    };
  }

  return { compute };
})();
