// Idle-screen background ("fon"): brand-palette gradient (slate · harbor gray · oil green) with flowing contour lines.
//
// The gradient itself is never touched. Only the thin contour lines move: each bundle of
// parallel lines undulates slowly, like a sound wave travelling through it.
//
// If the original artwork is placed in assets/bg/ it is used 1:1:
//   assets/bg/fon.jpg        – the gradient (without lines)
//   assets/bg/fon-lines.png  – the line layer (transparent PNG) → animated as a travelling shimmer
// Without those files a CSS gradient + procedurally generated line bundles are used.
const Fon = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const W = 2000, H = 1121;

  // centre curve of each bundle (in the 2000 × 1121 artwork space), number of lines, spacing
  const BUNDLES = [
    { pts: [[392, -10], [352, 120], [270, 245], [150, 320], [20, 348], [-20, 350]], n: 8, gap: 15 },
    { pts: [[812, -10], [830, 40], [940, 90], [1060, 140], [1100, 215], [1200, 252], [1320, 232], [1425, 160], [1478, 40], [1490, -10]], n: 7, gap: 14 },
    { pts: [[-20, 985], [60, 905], [150, 765], [195, 680], [310, 690], [420, 662], [525, 655], [612, 722], [640, 830], [592, 905], [505, 948], [445, 992], [405, 1060], [385, 1135]], n: 8, gap: 17 },
    { pts: [[1182, 930], [1190, 820], [1285, 775], [1425, 705], [1530, 612], [1660, 523], [1800, 482], [1905, 470], [2020, 452]], n: 9, gap: 14 },
    { pts: [[1262, 1135], [1278, 1062], [1332, 1002], [1402, 962], [1392, 902], [1340, 842]], n: 7, gap: 12 },
    { pts: [[1865, 1135], [1885, 1005], [1942, 905], [2020, 850]], n: 8, gap: 14 }
  ];

  let svg = null, groups = [], raf = 0, running = false, t0 = 0, raster = false;

  const norm = (pts, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  };

  // Catmull-Rom → cubic Bézier path
  function smooth(p) {
    let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
      d += `C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  // resample a polyline to evenly spaced points so the wave phase is smooth
  function resample(pts, step) {
    const out = [pts[0]];
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let d = step - carry;
      while (d <= seg) { const k = d / seg; out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]); d += step; }
      carry = seg - (d - step);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function build() {
    svg.innerHTML = "";
    groups = BUNDLES.map((b, gi) => {
      const base = resample(b.pts, 48);
      const normals = base.map((_, i) => norm(base, i));
      const lines = [];
      for (let i = 0; i < b.n; i++) {
        const path = document.createElementNS(NS, "path");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "#fff");
        path.setAttribute("stroke-width", "1.15");
        path.setAttribute("stroke-opacity", (0.16 - i * 0.006).toFixed(3));
        svg.appendChild(path);
        lines.push(path);
      }
      return { b, base, normals, lines, phase: gi * 1.7 };
    });
  }

  function draw(tsec) {
    groups.forEach(g => {
      const { base, normals, lines, b } = g;
      lines.forEach((path, li) => {
        const off = (li - (b.n - 1) / 2) * b.gap;
        const pts = base.map((p, i) => {
          // travelling wave along the bundle; neighbouring lines lag slightly → soft, net-like flow
          const w = Math.sin(i * 0.33 - tsec * 0.7 + g.phase + li * 0.22) * 7
                  + Math.sin(i * 0.12 + tsec * 0.35 + g.phase * 0.6) * 11;
          const k = off + w;
          return [p[0] + normals[i][0] * k, p[1] + normals[i][1] * k];
        });
        path.setAttribute("d", smooth(pts));
      });
    });
  }

  // ~20 fps is plenty for slow contour lines, and keeps the tablet cool; pauses entirely while the page is hidden
  let last = 0;
  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (document.hidden || now - last < 48) return;
    last = now;
    draw((now - t0) / 1000);
  }

  function probe(url, ok) {
    const img = new Image();
    img.onload = () => ok(url);
    img.src = url;
  }

  return {
    init() {
      svg = document.getElementById("fon-svg");
      if (!svg) return;
      build();
      draw(0);
      const fon = svg.closest(".fon");
      probe("assets/bg/fon.jpg", url => { fon.style.backgroundImage = `url(${url})`; fon.classList.add("fon-image"); });
      probe("assets/bg/fon-lines.png", url => {
        raster = true;
        const r = document.createElement("div");
        r.className = "fon-raster";
        r.style.backgroundImage = `url(${url})`;
        fon.appendChild(r);
        svg.parentElement.style.display = "none";
        this.stop();
      });
    },
    start() {
      if (running || raster || !svg) return;
      running = true;
      t0 = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() { running = false; cancelAnimationFrame(raf); }
  };
})();
