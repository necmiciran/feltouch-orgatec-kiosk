// Mini 3D → SVG interior renderer (v2 — photographic look).
// Perspective rooms with textured materials (plaster, felt, carpet, wood), soft shadows and
// ambient occlusion, window light, anatomically-proportioned people and Feltouch products
// drawn like the real thing: AIR-FELT baffles on suspension wires, thick felt clouds and
// embossed Space-Wall-Panel modules. The "before" and "after" states share exactly the same
// room; the products live in .baffle / .slat groups that drop / fade in via CSS.
(() => {
  "use strict";

  const VB = { w: 640, h: 440, cx: 320, cy: 216 };
  const C = {
    ink: "#4c5054", slate: "#425563", cool: "#d0d0ce", harbor: "#a8c0bb",
    custard: "#e5d68e", moss: "#afab97", oil: "#80856d", egret: "#f3ece0",
    coral: "#e38e84", bisque: "#edcab5", brick: "#b07069"
  };
  // felt colours: brand palette + the neutral felts of the range (anthracite, ash gray, ivory beige)
  const FELT = ["#80856d", "#4a4f52", "#a8c0bb", "#d6ccb8", "#b07069", "#8f9395", "#e5d68e", "#425563"];
  const SKIN = ["#f0c8a6", "#e3b08a", "#c98c66", "#9a6642", "#74482f"];
  const HAIR = ["#17120f", "#2e2118", "#4d3622", "#8a6a3f", "#b79a69", "#6f6f6f", "#cfcfcf"];
  const TOPS = ["#ece8df", "#d9dde0", "#2e3a49", "#44525f", "#6b7a82", "#7d8d76", "#a45c4a", "#c7b595", "#3a3b3d", "#b9c5c9", "#7b5667", "#c8c1b4"];
  const BOTTOMS = ["#24272d", "#343b47", "#4a4338", "#1c1f22", "#475561", "#5c5648", "#2a3140"];
  let UID = 0;

  /* ---------- colour helpers ---------- */
  const h2r = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const r2h = (r, g, b) => "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  const shade = (h, k) => {
    const [r, g, b] = h2r(h);
    if (k <= 1) return r2h(r * k, g * k, b * k);
    const t = k - 1;
    return r2h(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t);
  };
  const mixc = (a, b, t) => {
    const x = h2r(a), y = h2r(b);
    return r2h(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  };
  function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const range = (a, b, s) => { const r = []; for (let v = a; v <= b + 1e-6; v += s) r.push(+v.toFixed(3)); return r; };

  /* =====================================================================
     Global defs: procedural textures + shared gradients + filters
     (one hidden <svg> in the document; every scene references them by id)
     ===================================================================== */
  let defsReady = false;
  function tile(w, h, seed, fn) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d"); fn(x, w, h, mulberry(seed));
    return c.toDataURL("image/png");
  }
  function ensureDefs() {
    if (defsReady || typeof document === "undefined") return;
    defsReady = true;
    const grain = (x, w, h, r, a, lo = 0, hi = 255) => {
      const id = x.createImageData(w, h);
      for (let i = 0; i < id.data.length; i += 4) { const v = lo + r() * (hi - lo); id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = r() * a; }
      x.putImageData(id, 0, 0);
    };
    const felt = tile(96, 96, 11, (x, w, h, r) => {          // pressed polyester felt: fibres + mottling
      grain(x, w, h, r, 34);
      for (let i = 0; i < 700; i++) {
        const px = r() * w, py = r() * h, a = r() * Math.PI * 2, l = 2 + r() * 6;
        x.strokeStyle = r() < .5 ? `rgba(0,0,0,${.05 + r() * .08})` : `rgba(255,255,255,${.05 + r() * .09})`;
        x.lineWidth = .6; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
      }
    });
    const plaster = tile(128, 128, 5, (x, w, h, r) => { grain(x, w, h, r, 22); for (let i = 0; i < 26; i++) { const g = x.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, 30 + r() * 30); g.addColorStop(0, "rgba(0,0,0,.035)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h); } });
    const carpet = tile(64, 64, 3, (x, w, h, r) => { grain(x, w, h, r, 70); for (let i = 0; i < 300; i++) { x.fillStyle = r() < .5 ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.1)"; x.fillRect(r() * w, r() * h, 1.4, 1.4); } });
    const wood = tile(160, 64, 9, (x, w, h, r) => {
      for (let i = 0; i < 90; i++) { const y = r() * h, l = 30 + r() * 110, s = r() * w; x.strokeStyle = `rgba(${r() < .5 ? "40,22,8" : "255,230,190"},${.05 + r() * .09})`; x.lineWidth = .5 + r() * 1.4; x.beginPath(); x.moveTo(s, y); x.bezierCurveTo(s + l * .3, y + (r() - .5) * 3, s + l * .6, y + (r() - .5) * 3, s + l, y + (r() - .5) * 2); x.stroke(); }
      grain(x, w, h, r, 14);
    });
    const fabric = tile(48, 48, 4, (x, w, h, r) => { for (let i = 0; i < w; i += 2) { x.fillStyle = "rgba(0,0,0,.06)"; x.fillRect(i, 0, 1, h); x.fillRect(0, i, w, 1); } grain(x, w, h, r, 30); });
    const film = tile(160, 160, 21, (x, w, h, r) => grain(x, w, h, r, 40));

    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    const pat = (id, src, w, h) => `<pattern id="tx-${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse"><image href="${src}" width="${w}" height="${h}"/></pattern>`;
    const lg = (id, x1, y1, x2, y2, stops) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c[0]}" stop-opacity="${c[1]}"/>`).join("")}</linearGradient>`;
    host.innerHTML = `<svg width="0" height="0"><defs>
      ${pat("felt", felt, 48, 48)}${pat("plaster", plaster, 96, 96)}${pat("carpet", carpet, 32, 32)}${pat("wood", wood, 120, 48)}${pat("fabric", fabric, 24, 24)}${pat("film", film, 120, 120)}
      ${lg("sh-v", 0, 0, 0, 1, [[0, ["#fff", .13]], [1, ["#000", .26]]])}
      ${lg("sh-h", 0, 0, 1, 0, [[0, ["#fff", .10]], [1, ["#000", .26]]])}
      ${lg("sh-hr", 0, 0, 1, 0, [[0, ["#000", .26]], [1, ["#fff", .10]]])}
      ${lg("sh-t", 0, 1, 0, 0, [[0, ["#000", .10]], [1, ["#fff", .20]]])}
      ${lg("ao-up", 0, 1, 0, 0, [[0, ["#000", .34]], [1, ["#000", 0]]])}
      ${lg("ao-down", 0, 0, 0, 1, [[0, ["#000", .30]], [1, ["#000", 0]]])}
      ${lg("ao-l", 0, 0, 1, 0, [[0, ["#000", .28]], [1, ["#000", 0]]])}
      ${lg("ao-r", 1, 0, 0, 0, [[0, ["#000", .28]], [1, ["#000", 0]]])}
      <radialGradient id="shadow-r"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      <radialGradient id="sph" cx=".34" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".62"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
      <radialGradient id="glow-w"><stop offset="0" stop-color="#ffe6b0" stop-opacity=".9"/><stop offset="1" stop-color="#ffe6b0" stop-opacity="0"/></radialGradient>
      <radialGradient id="glow-c"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <filter id="blur1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2"/></filter>
      <filter id="blur4" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4"/></filter>
    </defs></svg>`;
    document.body.appendChild(host);
  }

  /* =====================================================================
     Scene factory
     ===================================================================== */
  function createScene(p) {
    ensureDefs();
    const { W, H, D, f, cb, eye, live } = p;
    const hw = W / 2;
    const id = `rs${++UID}`;
    const rnd = mulberry(p.seed || 7);
    const objs = [], shadows = [], contact = [], lowGlow = [], actors = [], amb = [], dustSpots = [];
    let shell = "", defsStr = "";

    const P = (x, y, z) => [VB.cx + f * x / (z + cb), VB.cy - f * (y - eye) / (z + cb)];
    const pt = q => { const [X, Y] = P(q[0], q[1], q[2]); return `${X.toFixed(1)},${Y.toFixed(1)}`; };
    const poly = (pts, fill, extra = "") => `<polygon points="${pts.map(pt).join(" ")}" fill="${fill}" ${extra}/>`;
    const sc = z => f / (z + cb);
    // layers (live mode): base = static room, prod = wall/ceiling-flush products (cross-fade), hang = hanging baffles / clouds
    const add = (key, svg, o = {}) => {
      let layer = "base";
      if (live) layer = o.layer || (o.cls === "baffle" ? "hang" : o.cls ? "prod" : "base");
      if (o.cls) svg = `<g class="${o.cls}" style="--d:${o.delay || 0}ms">${svg}</g>`;
      objs.push({ key, svg, layer });
    };

    /* ---------- faces with material + light overlays ---------- */
    function face(pts, fill, kind, o) {
      let s = poly(pts, fill);
      if (o.tex) s += poly(pts, `url(#tx-${o.tex})`);
      if (!o.flat) s += poly(pts, `url(#${kind === "top" ? "sh-t" : kind === "front" ? "sh-v" : kind === "sideR" ? "sh-hr" : "sh-h"})`);
      if (o.edge) s += poly(pts, "none", `stroke="${o.edge}" stroke-width=".5" stroke-linejoin="round"`);
      return s;
    }

    function box(x, y, z, w, h, d, col, o = {}) {
      const x0 = x, x1 = x + w, y0 = y, y1 = y + h, z0 = z, z1 = z + d;
      const side = o.side || shade(col, .78), top = o.top || shade(col, 1.14), bot = o.bot || shade(col, .62);
      let s = "";
      if (o.emit) {
        s += poly([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], col);
      } else {
        const ed = o.nostroke ? null : "rgba(18,20,22,.18)";
        if (x0 > 0) s += face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], side, "sideL", { ...o, edge: ed });
        if (x1 < 0) s += face([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], side, "sideR", { ...o, edge: ed });
        if (eye > y1) s += face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], top, "top", { ...o, edge: ed });
        if (eye < y0) s += face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], bot, "bot", { ...o, flat: true, edge: ed });
        s += face([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], col, "front", { ...o, edge: ed });
      }
      if (o.alpha) s = `<g opacity="${o.alpha}">${s}</g>`;
      add(z1 + cb + (o.bias || 0), s, o);
      if (o.shadow !== false && y0 < 0.06 && w * d > 0.01) {
        const ex = Math.min(0.3, h * 0.14 + 0.06);
        shadows.push(poly([[x0 - .05, 0, z0 - .03], [x1 + ex, 0, z0 - .03], [x1 + ex, 0, z1 + .12], [x0 - .05, 0, z1 + .12]], "rgba(14,16,18,.40)"));
        contact.push(poly([[x0 - .01, 0, z0], [x1 + .03, 0, z0], [x1 + .03, 0, z1 + .02], [x0 - .01, 0, z1 + .02]], "rgba(8,9,10,.38)"));
      }
    }

    function cyl(cx, cz, y0, y1, r, col, o = {}) {
      const N = 24, top = [], bot = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        top.push([cx + r * Math.cos(a), y1, cz + r * Math.sin(a)]);
        bot.push([cx + r * Math.cos(a), y0, cz + r * Math.sin(a)]);
      }
      const xs = pts => pts.map(q => P(...q)[0]);
      const idx = (pts, fn) => { const a = xs(pts); return a.indexOf(fn(...a)); };
      const tl = top[idx(top, Math.min)], tr = top[idx(top, Math.max)];
      const bl = bot[idx(bot, Math.min)], br = bot[idx(bot, Math.max)];
      const sideC = o.side || shade(col, .84), topC = o.top || shade(col, 1.12);
      let s = poly(bot, sideC);
      s += poly([tl, tr, br, bl], sideC);
      s += poly([tl, tr, br, bl], "url(#sh-h)");            // cylindrical shading
      if (o.tex) s += poly([tl, tr, br, bl], `url(#tx-${o.tex})`);
      s += eye > y1 ? poly(top, topC) + poly(top, "url(#sh-t)") : poly(top, shade(col, .7));
      add(cz + r + cb, s, o);
      if (o.shadow !== false && y0 < .06) {
        const sh = [];
        for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; sh.push([cx + .12 + (r + .07) * Math.cos(a), 0, cz + .06 + (r + .07) * Math.sin(a)]); }
        shadows.push(poly(sh, "rgba(14,16,18,.36)"));
      }
    }

    /* ---------- people (anatomical proportions, shaded) ---------- */
    function person(x, z, o = {}) {
      const [bx, by] = P(x, 0, z), m = sc(z) * (o.s || 1);
      const r = o.seed != null ? o.seed : Math.floor(rnd() * 1000);
      const pick = (arr, k) => arr[(r * 7 + k * 13) % arr.length];
      const top = o.top || pick(TOPS, 1), bottom = o.bottom || pick(BOTTOMS, 2);
      const skin = o.skin || pick(SKIN, 3), hair = o.hair || pick(HAIR, 4);
      const female = o.g ? o.g === "f" : (r % 3 === 0);
      const back = !!o.back, seated = !!o.seated, pose = o.pose || "stand";
      const act = live && !!o.anim && !seated;           // animated 'actor' (drawn in its own layer)
      const big = m > 72 && !back;
      const part = (d, fill, ov = "sh-h") => `<path d="${d}" fill="${fill}"/>` + (ov ? `<path d="${d}" fill="url(#${ov})"/>` : "");
      const sleeveShort = (r % 4) === 0;
      let g = "";

      if (!seated) g += `<ellipse cx="0" cy="0" rx=".36" ry=".1" fill="url(#shadow-r)"/>`;

      const upper = () => {
        let u = "";
        const sh = female ? .93 : 1;
        const arm = (side, ang, cls) => {
          const sx = side * .215 * sh, base = `translate(${sx},-1.5) rotate(${ang})`;
          const slv = sleeveShort
            ? `M${-.03 * side},0 C${.05 * side},.04 ${.08 * side},.2 ${.075 * side},.3 L${.0 * side},.3 C${-.01 * side},.18 ${-.03 * side},.08 ${-.03 * side},0 Z`
            : `M${-.03 * side},0 C${.06 * side},.05 ${.09 * side},.3 ${.085 * side},.55 L${.0 * side},.55 C${-.005 * side},.3 ${-.03 * side},.1 ${-.03 * side},0 Z`;
          const fore = sleeveShort ? `M${.0 * side},.3 L${.075 * side},.3 L${.08 * side},.56 L${.005 * side},.56 Z` : "";
          const hand = `<ellipse cx="${.044 * side}" cy=".6" rx=".034" ry=".05" fill="${skin}"/>`;
          const inner = `${fore ? part(fore, skin) : ""}${part(slv, top)}${hand}`;
          if (act) return `<g transform="translate(${sx},-1.5)"><g class="a-arm ${cls || ""}" style="--ox:${side > 0 ? 26 : 74}%">${inner}</g></g>`;
          return `<g transform="${base}">${inner}</g>`;
        };
        const sw = pose === "walk" ? (o.step || 1) * 11 : 0;
        if (pose === "phone") {
          u += arm(-1, 2, "a-armQ");
          u += `<path d="M${.2 * sh},-1.5 L.30,-1.3 L.09,-1.66" stroke="${top}" stroke-width=".085" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx=".085" cy="-1.68" r=".034" fill="${skin}"/><rect x=".07" y="-1.74" width=".03" height=".085" rx=".008" fill="#16181b"/>`;
        } else if (seated && !back) {
          u += `<path d="M${-.2 * sh},-1.5 L-.27,-1.18 L-.1,-1.07" stroke="${top}" stroke-width=".085" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
          u += `<path d="M${.2 * sh},-1.5 L.27,-1.18 L.1,-1.07" stroke="${top}" stroke-width=".085" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
          u += `<circle cx="-.1" cy="-1.06" r=".036" fill="${skin}"/><circle cx=".1" cy="-1.06" r=".036" fill="${skin}"/>`;
        } else {
          const gs = r % 2 ? 1 : -1;
          u += arm(-1, -sw, gs < 0 ? "a-armG" : "a-armQ"); u += arm(1, sw, gs > 0 ? "a-armG" : "a-armQ");
        }
        const tw = female ? .195 : .215;
        const torso = `M${-tw},-1.49 C${-tw},-1.56 -.15,-1.6 0,-1.6 C.15,-1.6 ${tw},-1.56 ${tw},-1.49 L${tw * .88},-.97 L${-tw * .88},-.97 Z`;
        u += part(torso, top);
        u += `<path d="M${-tw * .5},-1.5 C${-tw * .2},-1.2 ${-tw * .3},-1.05 ${-tw * .4},-.98" stroke="rgba(0,0,0,.16)" stroke-width=".012" fill="none"/>`;
        if (!back) u += `<path d="M-.04,-1.6 L0,-1.53 L.04,-1.6 Z" fill="${skin}"/>`;
        u += `<path d="M-.036,-1.63 L.036,-1.63 L.042,-1.55 L-.042,-1.55 Z" fill="${skin}"/><path d="M-.036,-1.63 L.036,-1.63 L.042,-1.55 L-.042,-1.55 Z" fill="rgba(0,0,0,.18)"/>`;
        let hd = "";
        if (back) {
          hd += `<ellipse cx="0" cy="-1.7" rx=".082" ry=".104" fill="${hair}"/>`;
          if (female) hd += `<path d="M-.085,-1.7 C-.12,-1.6 -.1,-1.46 -.06,-1.44 L.06,-1.44 C.1,-1.46 .12,-1.6 .085,-1.7 Z" fill="${hair}"/>`;
          hd += `<ellipse cx="-.02" cy="-1.74" rx=".03" ry=".05" fill="rgba(255,255,255,.1)"/>`;
        } else {
          hd += part(`M-.078,-1.7 C-.078,-1.77 .078,-1.77 .078,-1.7 C.078,-1.62 .045,-1.6 0,-1.6 C-.045,-1.6 -.078,-1.62 -.078,-1.7 Z`, skin, "sh-h");
          hd += `<ellipse cx="-.08" cy="-1.69" rx=".012" ry=".024" fill="${skin}"/><ellipse cx=".08" cy="-1.69" rx=".012" ry=".024" fill="${skin}"/>`;
          hd += `<path d="M-.088,-1.69 C-.1,-1.83 .1,-1.83 .088,-1.69 C.075,-1.76 .035,-1.775 0,-1.77 C-.035,-1.775 -.075,-1.76 -.088,-1.69 Z" fill="${hair}"/>`;
          if (female) hd += `<path d="M-.088,-1.69 C-.12,-1.6 -.1,-1.5 -.07,-1.48 L-.055,-1.68 Z" fill="${hair}"/><path d="M.088,-1.69 C.12,-1.6 .1,-1.5 .07,-1.48 L.055,-1.68 Z" fill="${hair}"/>`;
          if (big) hd += `<ellipse cx="-.03" cy="-1.7" rx=".0095" ry=".0065" fill="#1d1a19"/><ellipse cx=".03" cy="-1.7" rx=".0095" ry=".0065" fill="#1d1a19"/><path d="M-.022,-1.645 Q0,-1.635 .022,-1.645" stroke="rgba(120,50,45,.7)" stroke-width=".006" fill="none"/>`;
        }
        u += act ? `<g class="a-head" style="transform-origin:0px -1.6px">${hd}</g>` : hd;
        return u;
      };

      if (seated) {
        const lower = `<path d="M-.19,-.56 L.19,-.56 L.2,-.44 L-.2,-.44 Z" fill="${bottom}"/>
          <path d="M-.19,-.46 C-.2,-.3 -.17,-.15 -.15,-.07 L-.055,-.07 C-.05,-.2 -.05,-.34 -.02,-.46 Z" fill="${bottom}"/>
          <path d="M.02,-.46 C.05,-.34 .05,-.2 .055,-.07 L.15,-.07 C.17,-.15 .2,-.3 .19,-.46 Z" fill="${bottom}"/>
          <ellipse cx="-.1" cy="-.04" rx=".07" ry=".035" fill="#1b1b1d"/><ellipse cx=".1" cy="-.04" rx=".07" ry=".035" fill="#1b1b1d"/>`;
        g += lower + `<g transform="translate(0,.38)">${upper()}</g>`;
      } else {
        const hx = .09, hy = -.98;
        const walk = pose === "walk" ? (o.step || 1) * 13 : 0;
        const legL = `M-.185,-.98 C-.2,-.75 -.17,-.45 -.145,-.075 L-.045,-.075 C-.04,-.45 -.035,-.75 -.005,-.98 Z`;
        const legR = `M.005,-.98 C.035,-.75 .04,-.45 .045,-.075 L.145,-.075 C.17,-.45 .2,-.75 .185,-.98 Z`;
        const shoe = (cx, a) => `<ellipse cx="${cx}" cy="-.035" rx=".072" ry=".04" fill="#1b1b1d" transform="rotate(${a},${cx},-.075)"/>`;
        if (female && (r % 2 === 0)) {
          g += `<g transform="rotate(${-walk},${-hx},${hy})">${part(`M-.15,-.62 C-.16,-.45 -.14,-.2 -.13,-.075 L-.05,-.075 C-.05,-.2 -.05,-.45 -.04,-.62 Z`, skin)}${shoe(-.09, -walk)}</g>`;
          g += `<g transform="rotate(${walk},${hx},${hy})">${part(`M.04,-.62 C.05,-.45 .05,-.2 .05,-.075 L.13,-.075 C.14,-.2 .16,-.45 .15,-.62 Z`, skin)}${shoe(.09, walk)}</g>`;
          g += part(`M-.2,-1.0 L.2,-1.0 L.27,-.6 L-.27,-.6 Z`, bottom, "sh-v");
        } else {
          g += `<g transform="rotate(${-walk},${-hx},${hy})">${part(legL, bottom)}${shoe(-.095, -walk)}</g>`;
          g += `<g transform="rotate(${walk},${hx},${hy})">${part(legR, bottom)}${shoe(.095, walk)}</g>`;
        }
        let up = upper();
        if (pose === "carry" || o.bag) {
          up += `<path d="M-.2,-1.5 L-.34,-.9" stroke="#222" stroke-width=".014" fill="none"/><rect x="-.44" y="-.95" width=".2" height=".26" rx=".025" fill="${o.bag || "#6a4a35"}"/><rect x="-.44" y="-.95" width=".2" height=".26" rx=".025" fill="url(#sh-h)"/>`;
        }
        g += act ? `<g class="a-upper" style="transform-origin:0px -.97px">${up}</g>` : up;
      }
      const flip = (r % 2 && !back) ? "scale(-1,1)" : "";
      if (act) {
        // idle life (breathing, weight shift, head turns, a gesture) – split the body so CSS can move the parts
        actors.push({ key: z, svg: `<g transform="translate(${bx.toFixed(1)},${by.toFixed(1)}) scale(${m.toFixed(2)})"><g style="--ad:${(-rnd() * 9).toFixed(2)}s"><g transform="${flip}"><g class="a-fig">${g}</g></g></g></g>` });
        return;
      }
      add(z + cb + (o.bias != null ? o.bias : .25),
        `<g transform="translate(${bx.toFixed(1)},${by.toFixed(1)}) scale(${m.toFixed(2)})"><g transform="${flip}">${g}</g></g>`);
    }

    // Walking figure in profile (facing right; dir = -1 mirrors it). Live mode: crosses the room on its own path, with a real gait cycle.
    function walker(z, o = {}) {
      const r = o.seed != null ? o.seed : Math.floor(rnd() * 1000);
      const pick = (arr, k) => arr[(r * 7 + k * 13) % arr.length];
      const top = o.top || pick(TOPS, 1), bottom = o.bottom || pick(BOTTOMS, 2), skin = o.skin || pick(SKIN, 3), hair = o.hair || pick(HAIR, 4);
      const female = o.g ? o.g === "f" : (r % 3 === 0), dir = o.dir || 1, speed = o.speed || 1.3;
      const [bx, by] = P(o.x != null ? o.x : 0, 0, z), m = sc(z) * (o.s || 1);
      const st = !live;                                   // static pose (thumbnails)
      const part = (d, fill, ov = "sh-h") => `<path d="${d}" fill="${fill}"/>` + (ov ? `<path d="${d}" fill="url(#${ov})"/>` : "");
      // two-segment legs and arms (hip → knee → ankle, shoulder → elbow) so the gait reads as a real stride
      const thighP = "M-.075,-.98 C-.088,-.86 -.082,-.66 -.07,-.47 L.07,-.47 C.078,-.66 .09,-.86 .095,-.98 Z";
      const shinP = "M-.068,-.06 C-.066,.18 -.062,.34 -.058,.43 L.058,.43 C.058,.34 .07,.18 .068,-.06 Z";
      const shoeP = "M-.07,.43 L.15,.43 C.185,.44 .185,.5 .14,.5 L-.07,.5 Z";
      const shortS = (r % 4) === 0;
      const uarmP = shortS ? "M-.05,0 C.035,.04 .052,.16 .05,.3 L-.035,.3 C-.045,.16 -.055,.07 -.05,0 Z" : "M-.05,0 C.035,.04 .052,.16 .05,.3 L-.035,.3 C-.045,.16 -.055,.07 -.05,0 Z";
      const farmP = "M-.036,0 L.05,0 C.052,.1 .05,.2 .046,.27 L-.03,.27 Z";
      const W = (cls, ph, inner, org) => `<g class="${cls}" style="--ph:${ph};transform-origin:${org}">${inner}</g>`;
      const leg = (far, ph, ang) => {
        const bt = far ? shade(bottom, .68) : bottom, shoe = far ? "#101113" : "#1b1b1d";
        const shin = part(shinP, bt) + (st ? "" : "") + W("w-foot", ph, `<path d="${shoeP}" fill="${shoe}"/>`, "0px .43px");
        const knee = `<g transform="translate(0,-.52)">${W("w-shin", ph, shin, "0px 0px")}</g>`;
        const inner = part(thighP, bt) + knee;
        return st ? `<g style="transform:rotate(${ang}deg);transform-origin:0px -.98px">${inner}</g>` : W("w-thigh", ph, inner, "0px -.98px");
      };
      const armSide = (far, ph, ang) => {
        const tp = far ? shade(top, .72) : top, sk = far ? shade(skin, .8) : skin;
        const fore = (shortS ? part(farmP, sk) : part(farmP, tp)) + `<ellipse cx="0.008" cy=".31" rx=".034" ry=".05" fill="${sk}"/>`;
        const inner = part(uarmP, tp) + `<g transform="translate(0,.3)">${st ? `<g style="transform:rotate(-14deg);transform-origin:0px 0px">${fore}</g>` : W("w-farm", ph, fore, "0px 0px")}</g>`;
        return `<g transform="translate(-.005,-1.5)">${st ? `<g style="transform:rotate(${ang}deg);transform-origin:0px 0px">${inner}</g>` : W("w-uarm", ph, inner, "0px 0px")}</g>`;
      };
      const torsoP = "M-.1,-1.52 C-.14,-1.5 -.15,-1.2 -.125,-.97 L.115,-.97 C.15,-1.2 .14,-1.5 .09,-1.56 C.06,-1.6 -.05,-1.6 -.1,-1.52 Z";
      let head = part("M-.092,-1.7 C-.092,-1.8 .09,-1.8 .095,-1.7 C.098,-1.63 .06,-1.6 0,-1.6 C-.06,-1.6 -.092,-1.63 -.092,-1.7 Z", skin);
      head += `<path d="M.092,-1.69 L.13,-1.665 L.095,-1.65 Z" fill="${skin}"/>`;
      head += `<path d="M-.1,-1.7 C-.105,-1.83 .085,-1.84 .097,-1.73 C.05,-1.76 -.02,-1.75 -.045,-1.68 C-.055,-1.63 -.075,-1.62 -.1,-1.66 Z" fill="${hair}"/>`;
      if (female) head += `<path d="M-.09,-1.74 C-.17,-1.7 -.18,-1.54 -.12,-1.46 C-.1,-1.54 -.09,-1.62 -.075,-1.68 Z" fill="${hair}"/>`;
      head += `<ellipse cx=".05" cy="-1.7" rx=".009" ry=".0065" fill="#1d1a19"/>`;
      const neck = `<path d="M-.03,-1.63 L.045,-1.63 L.05,-1.55 L-.04,-1.55 Z" fill="${skin}"/><path d="M-.03,-1.63 L.045,-1.63 L.05,-1.55 L-.04,-1.55 Z" fill="rgba(0,0,0,.16)"/>`;
      let fig = `<ellipse cx="0" cy="0" rx=".34" ry=".09" fill="url(#shadow-r)"/>`;
      if (o.roller) fig += `<g><line x1="-.5" y1="-.62" x2="-.02" y2="-.88" stroke="#2a2d30" stroke-width=".016"/><rect x="-.66" y="-.6" width=".3" height=".52" rx=".03" fill="${o.roller}"/><rect x="-.66" y="-.6" width=".3" height=".52" rx=".03" fill="url(#sh-h)"/><circle cx="-.6" cy="-.04" r=".04" fill="#222"/><circle cx="-.42" cy="-.04" r=".04" fill="#222"/></g>`;
      fig += leg(true, .5, 14) + leg(false, 0, -14);
      let up = armSide(true, 0, 12) + part(torsoP, top) + neck + `<g class="${st ? "" : "w-head"}" style="transform-origin:0px -1.6px">${head}</g>` + armSide(false, .5, -12);
      fig += `<g transform="rotate(3,0,-.97)"><g class="${st ? "" : "w-sway"}" style="transform-origin:0px -.97px">${up}</g></g>`;
      if (st) {
        add(z + cb + .25, `<g transform="translate(${bx.toFixed(1)},${by.toFixed(1)}) scale(${m.toFixed(2)})"><g transform="scale(${dir},1)">${fig}</g></g>`);
        return;
      }
      const dist = VB.w + 200, T = dist / (speed * m), gp = 1.55 / speed;
      const x0 = (dir > 0 ? -100 : VB.w + 100) - bx, x1 = (dir > 0 ? VB.w + 100 : -100) - bx;
      const dl = o.phase != null ? -o.phase * T : -rnd() * T;
      actors.push({ key: z, svg: `<g class="act-mv" style="--x0:${x0.toFixed(1)}px;--x1:${x1.toFixed(1)}px;--T:${T.toFixed(2)}s;--dl:${dl.toFixed(2)}s;--gp:${gp.toFixed(3)}s"><g transform="translate(${bx.toFixed(1)},${by.toFixed(1)}) scale(${m.toFixed(2)})"><g transform="scale(${dir},1)"><g class="w-bob">${fig}</g></g></g></g>` });
    }

    /* ---------- furniture & props ---------- */
    function chair(x, z, face_, col = C.slate, o = {}) {
      const s = .47, h = .45, tex = "fabric";
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) =>
        box(x + a * .2 - .018, 0, z + b * .2 - .018, .036, h, .036, "#2a2d30", { shadow: false, nostroke: true, bias: -.05, flat: true }));
      box(x - s / 2, h, z - s / 2, s, .07, s, col, { shadow: false, tex });
      if (o.noBack) return;
      const bh = o.bh || .45;
      if (face_ === "+z") box(x - s / 2 + .02, h + .07, z - s / 2, s - .04, bh, .055, col, { shadow: false, tex });
      else if (face_ === "-z") box(x - s / 2 + .02, h + .07, z + s / 2 - .055, s - .04, bh, .055, col, { shadow: false, tex });
      else if (face_ === "+x") box(x - s / 2, h + .07, z - s / 2 + .02, .055, bh, s - .04, col, { shadow: false, tex });
      else box(x + s / 2 - .055, h + .07, z - s / 2 + .02, .055, bh, s - .04, col, { shadow: false, tex });
    }

    function table(x, z, w, d, h, col, o = {}) {
      const lc = o.leg || "#3a3f44";
      [[0, 0], [w - .05, 0], [0, d - .05], [w - .05, d - .05]].forEach(([a, b]) =>
        box(x + a, 0, z + b, .05, h - .04, .05, lc, { shadow: false, nostroke: true, bias: -.05, flat: true }));
      shadows.push(poly([[x + .12, 0, z + .06], [x + w + .2, 0, z + .06], [x + w + .2, 0, z + d + .14], [x + .12, 0, z + d + .14]], "rgba(14,16,18,.26)"));
      box(x, h - .04, z, w, .04, d, col, { shadow: false, tex: o.tex || "wood" });
    }

    function plant(x, z, s = 1) {
      cyl(x, z, 0, .38 * s, .2 * s, "#d9d2c4", { tex: "plaster" });
      const [bx, by] = P(x, .4 * s, z), m = sc(z) * s;
      let g = "";
      const leaves = 22;
      for (let i = 0; i < leaves; i++) {
        const a = (i / leaves) * Math.PI * 2 + rnd(), len = (.28 + rnd() * .55) * m, up = (.15 + rnd() * .75) * m;
        const ex = bx + Math.cos(a) * len * .7, ey = by - up - len * .3;
        const col = ["#4c6b3f", "#5f7f4d", "#3f5a35", "#6c8c58"][i % 4];
        g += `<path d="M${bx.toFixed(1)},${by.toFixed(1)} Q${(bx + (ex - bx) * .4).toFixed(1)},${(by - up * .9).toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" stroke="#3a4a2f" stroke-width="${(.012 * m).toFixed(2)}" fill="none"/>`;
        g += `<ellipse cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" rx="${(.13 * m).toFixed(1)}" ry="${(.07 * m).toFixed(1)}" fill="${col}" transform="rotate(${(a * 57).toFixed(0)},${ex.toFixed(1)},${ey.toFixed(1)})"/><ellipse cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" rx="${(.13 * m).toFixed(1)}" ry="${(.07 * m).toFixed(1)}" fill="url(#sph)" transform="rotate(${(a * 57).toFixed(0)},${ex.toFixed(1)},${ey.toFixed(1)})"/>`;
      }
      if (live) amb.push({ key: z, svg: `<g class="amb-leaf" style="transform-origin:${bx.toFixed(1)}px ${by.toFixed(1)}px;--ad:${(-rnd() * 6).toFixed(2)}s">${g}</g>` });
      else add(z + cb + .25, g);
    }

    function glow(x, y, z, r = .9, a = .55, warm = true) {
      const [gx, gy] = P(x, y, z);
      lowGlow.push(`<circle cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" r="${(r * sc(z)).toFixed(1)}" fill="url(#glow-${warm ? "w" : "c"})" opacity="${a}"/>`);
    }

    function pendant(x, z, y, o = {}) {
      const [tx, ty] = P(x, H, z), [lx, ly] = P(x, y, z), m = sc(z);
      let s = `<line x1="${tx.toFixed(1)}" y1="${ty.toFixed(1)}" x2="${lx.toFixed(1)}" y2="${ly.toFixed(1)}" stroke="#2a2d30" stroke-width=".9"/>`;
      const a = .08 * m, b = (o.r || .24) * m, hh = .22 * m;
      const sh = `M${(lx - a).toFixed(1)},${ly.toFixed(1)} L${(lx + a).toFixed(1)},${ly.toFixed(1)} L${(lx + b).toFixed(1)},${(ly + hh).toFixed(1)} L${(lx - b).toFixed(1)},${(ly + hh).toFixed(1)} Z`;
      s += `<path d="${sh}" fill="${o.col || "#33383c"}"/><path d="${sh}" fill="url(#sh-h)"/>`;
      s += `<ellipse cx="${lx.toFixed(1)}" cy="${(ly + hh).toFixed(1)}" rx="${b.toFixed(1)}" ry="${(.05 * m).toFixed(1)}" fill="#fff3d6"/>`;
      if (live) amb.push({ key: z, svg: `<g class="amb-sway" style="transform-origin:${tx.toFixed(1)}px ${ty.toFixed(1)}px;--ad:${(-rnd() * 6).toFixed(2)}s">${s}</g>` });
      else add(z + cb + .2, s);
      glow(x, y - .08, z, 1.15, .55);
    }

    function monitor(x, y, z, facing, lit = "#bfe0ee") {
      box(x - .27, y + .06, z, .54, .33, .03, "#1c1f22", { shadow: false, nostroke: true, flat: true });
      if (facing === "front") {
        box(x - .25, y + .08, z - .002, .5, .29, .01, lit, { emit: true, nostroke: true, bias: -.02 });
        box(x - .24, y + .3, z - .003, .3, .02, .005, "#ffffff", { emit: true, nostroke: true, bias: -.03, alpha: .5 });
      }
      box(x - .03, y, z + .005, .06, .08, .03, "#2a2d30", { shadow: false, nostroke: true, flat: true });
      box(x - .12, y, z - .02, .24, .01, .1, "#2a2d30", { shadow: false, nostroke: true, flat: true });
    }

    /* ---------- Feltouch products ---------- */
    const feltCol = i => FELT[i % FELT.length];

    // AIR-FELT baffle: felt strip on two suspension wires
    function baffle(x, z, d, h, drop, col, delay) {
      const w = .045, y = H - drop - h;
      let g = "";
      [z + d * .25, z + d * .75].forEach(wz => { const [a1, b1] = P(x, H, wz), [a2, b2] = P(x, y + h * .9, wz); g += `<line x1="${a1.toFixed(1)}" y1="${b1.toFixed(1)}" x2="${a2.toFixed(1)}" y2="${b2.toFixed(1)}" stroke="rgba(30,32,34,.55)" stroke-width=".7"/>`; });
      const x0 = x - w / 2, x1 = x + w / 2, z0 = z, z1 = z + d, y0 = y, y1 = y + h;
      const sd = shade(col, .74), bt = shade(col, .62), tp = shade(col, 1.08);
      if (x0 > 0) g += face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], sd, "sideL", { tex: "felt" });
      if (x1 < 0) g += face([[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], sd, "sideR", { tex: "felt" });
      if (eye < y0) g += face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], bt, "bot", { tex: "felt", flat: true });
      g += face([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], tp, "front", { tex: "felt" });
      add(z1 + cb - .3, g, { cls: "baffle", delay, sway: true });
    }

    // thick felt cloud (rounded rectangle, bevelled edge) on four wires
    function cloud(cx, cz, w, d, drop, col, delay) {
      const t = .05, y = H - drop;
      const rr = (yy, grow = 0) => {
        const pts = [], r = Math.min(w, d) * .22, N = 7;
        const corners = [[cx + w / 2 - r, cz + d / 2 - r, 0], [cx - w / 2 + r, cz + d / 2 - r, 90], [cx - w / 2 + r, cz - d / 2 + r, 180], [cx + w / 2 - r, cz - d / 2 + r, 270]];
        corners.forEach(([ox, oz, a0]) => { for (let i = 0; i <= N; i++) { const a = (a0 + i * 90 / N) * Math.PI / 180; pts.push([ox + (r + grow) * Math.cos(a), yy, oz + (r + grow) * Math.sin(a)]); } });
        return pts;
      };
      let g = "";
      [[-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]].forEach(([a, b]) => { const [x1, y1] = P(cx + a * w, H, cz + b * d), [x2, y2] = P(cx + a * w, y + t, cz + b * d); g += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(30,32,34,.5)" stroke-width=".6"/>`; });
      g += poly(rr(y + t), shade(col, .55));
      g += poly(rr(y), shade(col, .92)) + poly(rr(y), "url(#tx-felt)") + poly(rr(y), "url(#sh-v)");
      g += poly(rr(y, -.04), shade(col, 1.0)) + poly(rr(y, -.04), "url(#tx-felt)");
      add(cz + d / 2 + cb - .2, g, { cls: "baffle", delay, sway: true });
    }

    // plane helpers: map (u, v) on a wall / the ceiling to 3D
    const planeOf = side => side === "L" ? (u, v) => [-hw + .012, v, u] : side === "R" ? (u, v) => [hw - .012, v, u] : side === "B" ? (u, v) => [u, v, D - .012] : (u, v) => [u, H - .012, v];
    function rrect(m, u0, v0, u1, v1, r) {
      const pts = [], N = 5;
      const cs = [[u1 - r, v1 - r, 0], [u0 + r, v1 - r, 90], [u0 + r, v0 + r, 180], [u1 - r, v0 + r, 270]];
      cs.forEach(([cu, cv, a0]) => { for (let i = 0; i <= N; i++) { const a = (a0 + i * 90 / N) * Math.PI / 180; pts.push(m(cu + r * Math.cos(a), cv + r * Math.sin(a))); } });
      return pts;
    }

    // Space-Wall-Panel-like embossed felt module (600 × 600 mm)
    function module_(m, u0, v0, s, col, delay) {
      const g = .022, a0 = u0 + g, b0 = v0 + g, a1 = u0 + s - g, b1 = v0 + s - g;
      let o = poly(rrect(m, a0 + .035, b0 - .035, a1 + .035, b1 - .035, .06), "rgba(10,12,14,.26)");
      const out = rrect(m, a0, b0, a1, b1, .06), mid = rrect(m, a0 + .06, b0 + .06, a1 - .06, b1 - .06, .045), inn = rrect(m, a0 + .1, b0 + .1, a1 - .1, b1 - .1, .035);
      o += poly(out, col) + poly(out, "url(#tx-felt)") + poly(out, "url(#sh-v)");
      o += poly(mid, shade(col, .8));
      o += poly(inn, shade(col, 1.04)) + poly(inn, "url(#tx-felt)") + poly(inn, "url(#sh-v)");
      o += poly(out, "none", `stroke="rgba(255,255,255,.22)" stroke-width=".5"`);
      return `<g class="slat" style="--d:${delay}ms">${o}</g>`;
    }

    function wallModules(side, zone, qty, colOff) {
      const m = planeOf(side);
      const u0 = zone.u0, u1 = zone.u1, v0 = zone.v0, v1 = zone.v1, s = .6;
      const cols = Math.max(1, Math.floor((u1 - u0) / (s + .02))), rows = Math.max(1, Math.floor((v1 - v0) / (s + .02)));
      const n = Math.min(cols * rows, Math.max(2, Math.round(qty / (s * s))));
      const rUsed = Math.min(rows, Math.ceil(n / cols)), cUsed = Math.min(cols, Math.ceil(n / rUsed));
      const uStart = u0 + ((u1 - u0) - cUsed * (s + .02)) / 2, vStart = v0 + ((v1 - v0) - rUsed * (s + .02)) / 2;
      let out = "", k = 0;
      for (let r = 0; r < rUsed; r++) for (let c = 0; c < cUsed && k < n; c++, k++)
        out += module_(m, uStart + c * (s + .02), vStart + r * (s + .02), s, feltCol(r + colOff), 260 + (r * cUsed + c) * 28);
      add(side === "B" ? D + cb - .6 : zone.u1 + cb - .6, out, { layer: "prod" });
    }

    // slab panels (SENSE FLUX FLAT, DECOSOUND…): large felt boards with a fine routed pattern
    function wallSlabs(side, zone, qty, colOff, flutes) {
      const m = planeOf(side);
      const hgt = zone.v1 - zone.v0, zl = zone.u1 - zone.u0;
      const Ltot = Math.min(zl - .2, qty / hgt);
      const n = Math.max(1, Math.min(8, Math.round(Ltot / 1.2)));
      const len = Ltot / n, gap = Math.max(.08, (zl - Ltot) / (n + 1));
      let out = "";
      for (let i = 0; i < n; i++) {
        const col = feltCol(i + colOff), u0 = zone.u0 + gap + i * (len + gap), u1 = u0 + len;
        const q = [m(u0, zone.v0), m(u1, zone.v0), m(u1, zone.v1), m(u0, zone.v1)];
        let g = poly([m(u0 + .03, zone.v0 - .03), m(u1 + .03, zone.v0 - .03), m(u1 + .03, zone.v1 - .03), m(u0 + .03, zone.v1 - .03)], "rgba(10,12,14,.26)");
        g += poly(q, col) + poly(q, "url(#tx-felt)") + poly(q, "url(#sh-v)");
        if (flutes) for (let u = u0 + .08; u < u1 - .04; u += .09) g += poly([m(u, zone.v0 + .03), m(u + .018, zone.v0 + .03), m(u + .018, zone.v1 - .03), m(u, zone.v1 - .03)], "rgba(0,0,0,.18)");
        g += poly(q, "none", `stroke="rgba(255,255,255,.2)" stroke-width=".5"`);
        out += `<g class="slat" style="--d:${260 + i * 80}ms">${g}</g>`;
      }
      add(side === "B" ? D + cb - .6 : zone.u1 + cb - .6, out, { layer: "prod" });
    }

    // ceiling-mounted flat panels (flush)
    function ceilTiles(z, qty, colOff) {
      const m = planeOf("C"), s = .6;
      const n = Math.max(6, Math.min(48, Math.round(qty / (s * s))));
      const zw = z.x1 - z.x0, zd = z.z1 - z.z0;
      const cols = Math.max(2, Math.floor(zw / (s + .02))), rows = Math.max(2, Math.floor(zd / (s + .02)));
      let k = 0, out = "";
      const cu = Math.min(cols, Math.ceil(Math.sqrt(n * zw / zd))), rr = Math.min(rows, Math.ceil(n / cu));
      const x0 = z.x0 + (zw - cu * (s + .02)) / 2, z0 = z.z0 + (zd - rr * (s + .02)) / 2;
      for (let r = 0; r < rr; r++) for (let c = 0; c < cu && k < n; c++, k++) out += module_(m, x0 + c * (s + .02), z0 + r * (s + .02), s, feltCol(k % 3 + colOff), 80 + k * 22);
      add(zd + cb, out, { layer: "prod" });
    }

    // spherical bowls on a wall (SPARKLE)
    function pods(side, zone, n, colOff) {
      const m = planeOf(side);
      n = Math.min(60, n);
      const cols = Math.max(3, Math.round(Math.sqrt(n * (zone.u1 - zone.u0) / (zone.v1 - zone.v0)))), rows = Math.ceil(n / cols);
      let k = 0, out = "";
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols && k < n; c++, k++) {
        const cu = zone.u0 + (c + .5) * ((zone.u1 - zone.u0) / cols), cv = zone.v0 + (r + .5) * ((zone.v1 - zone.v0) / rows), rad = .2 * (.85 + rnd() * .2);
        const col = feltCol(k + colOff), ring = [], inner = [];
        for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; ring.push(m(cu + rad * Math.cos(a), cv + rad * Math.sin(a))); inner.push(m(cu + rad * .66 * Math.cos(a) - .02, cv + rad * .66 * Math.sin(a) + .02)); }
        out += poly(ring, "rgba(10,12,14,.3)");
        out += poly(ring, shade(col, .85)) + poly(ring, "url(#tx-felt)") + poly(ring, "url(#sph)");
        out += poly(inner, shade(col, .78)) + poly(inner, "url(#sph)");
      }
      add(zone.u1 + cb - .6, `<g class="slat" style="--d:300ms">${out}</g>`, { layer: "prod" });
    }

    /* ---------- shell: walls, floor, ceiling, light ---------- */
    function buildShell(o) {
      const wall = o.wall, floor = o.floor, ceil = o.ceil;
      const defs = [];
      const lg = (n, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
        `<linearGradient id="${id}${n}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([of, c, a = 1]) => `<stop offset="${of}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</linearGradient>`;
      defs.push(lg("wb", [[0, shade(o.backWall || wall, 1.05)], [1, shade(o.backWall || wall, .88)]]));
      defs.push(lg("wl", [[0, shade(wall, .7)], [.5, shade(wall, .9)], [1, shade(wall, 1.0)]], 0, 0, 1, 0));
      defs.push(lg("wr", [[0, shade(wall, 1.0)], [.5, shade(wall, .9)], [1, shade(wall, .7)]], 0, 0, 1, 0));
      defs.push(lg("fl", [[0, mixc(floor, "#ffffff", .26)], [1, shade(floor, .84)]]));
      defs.push(lg("ce", [[0, shade(ceil, .84)], [1, shade(ceil, 1.06)]]));
      defs.push(lg("sky", [[0, o.skyTop || "#a2c6da"], [.65, o.skyBot || "#eef2ec"], [1, "#dfe6dc"]]));
      defs.push(`<linearGradient id="${id}vig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14181a" stop-opacity=".24"/><stop offset=".25" stop-color="#14181a" stop-opacity="0"/><stop offset=".76" stop-color="#14181a" stop-opacity="0"/><stop offset="1" stop-color="#14181a" stop-opacity=".3"/></linearGradient>`);
      defs.push(`<radialGradient id="${id}vig2" cx=".5" cy=".5" r=".78"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient>`);
      defs.push(`<filter id="${id}blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3.6"/></filter>`);
      defs.push(`<filter id="${id}blur2" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.1"/></filter>`);
      defsStr = defs.join("");

      const zN = -cb + 1.1;
      let s = "";
      s += poly([[-hw, 0, D], [hw, 0, D], [hw, H, D], [-hw, H, D]], `url(#${id}wb)`);
      s += poly([[-hw, 0, D], [hw, 0, D], [hw, H, D], [-hw, H, D]], "url(#tx-plaster)");
      s += poly([[-hw, 0, zN], [-hw, 0, D], [-hw, H, D], [-hw, H, zN]], `url(#${id}wl)`);
      s += poly([[hw, 0, zN], [hw, 0, D], [hw, H, D], [hw, H, zN]], `url(#${id}wr)`);
      s += poly([[-hw, 0, zN], [-hw, 0, D], [-hw, H, D], [-hw, H, zN]], "url(#tx-plaster)") + poly([[hw, 0, zN], [hw, 0, D], [hw, H, D], [hw, H, zN]], "url(#tx-plaster)");
      s += poly([[-hw, 0, zN], [hw, 0, zN], [hw, 0, D], [-hw, 0, D]], `url(#${id}fl)`);
      if (o.floorTex) s += poly([[-hw, 0, zN], [hw, 0, zN], [hw, 0, D], [-hw, 0, D]], `url(#tx-${o.floorTex})`);
      s += poly([[-hw, H, zN], [hw, H, zN], [hw, H, D], [-hw, H, D]], `url(#${id}ce)`);
      s += poly([[-hw, H, zN], [hw, H, zN], [hw, H, D], [-hw, H, D]], "url(#tx-plaster)");

      const lines = [];
      const lp = (a, b) => `M${pt(a)}L${pt(b)}`;
      if (o.floorPat === "planks") {
        for (let x = -hw + .3; x < hw; x += .3) lines.push(lp([x, 0, zN], [x, 0, D]));
        for (let z = .9, k = 0; z < D; z += 1.5, k++) for (let x = -hw + .3 + (k % 2) * .15; x < hw; x += .6) lines.push(lp([x, 0, z], [x + .3, 0, z]));
      } else if (o.floorPat === "tiles") {
        for (let x = -hw; x <= hw + .01; x += 1.2) lines.push(lp([x, 0, zN], [x, 0, D]));
        for (let z = 0; z <= D; z += 1.2) lines.push(lp([-hw, 0, z], [hw, 0, z]));
      }
      if (lines.length) s += `<path d="${lines.join("")}" stroke="${o.floorLine || "rgba(30,34,36,.16)"}" stroke-width=".7" fill="none"/>`;

      if (o.glossy) {
        s += poly([[-hw, 0, zN], [hw, 0, zN], [hw, 0, D], [-hw, 0, D]], "url(#sh-t)", 'opacity=".5"');
        s += `<g filter="url(#blur4)">${(o.lights || []).map(([x, z, w, d]) => poly([[x - w / 2, 0, z], [x + w / 2, 0, z], [x + w / 2, 0, z + d], [x - w / 2, 0, z + d]], "rgba(255,255,255,.14)")).join("")}</g>`;
      }

      const cl = [];
      for (let x = -hw; x <= hw + .01; x += 1.2) cl.push(lp([x, H, zN], [x, H, D]));
      for (let z = 0; z <= D; z += 1.2) cl.push(lp([-hw, H, z], [hw, H, z]));
      if (o.ceilGrid !== false) s += `<path d="${cl.join("")}" stroke="rgba(30,34,36,.12)" stroke-width=".6" fill="none"/>`;

      const ao = .55;
      [-hw, hw].forEach(x => {
        s += poly([[x, 0, zN], [x, 0, D], [x, ao, D], [x, ao, zN]], "url(#ao-up)");
        s += poly([[x, H - ao * .7, zN], [x, H - ao * .7, D], [x, H, D], [x, H, zN]], "url(#ao-down)");
      });
      s += poly([[-hw, 0, D], [hw, 0, D], [hw, ao, D], [-hw, ao, D]], "url(#ao-up)");
      s += poly([[-hw, H - ao * .7, D], [hw, H - ao * .7, D], [hw, H, D], [-hw, H, D]], "url(#ao-down)");
      s += poly([[-hw, 0, D], [-hw + .7, 0, D], [-hw + .7, H, D], [-hw, H, D]], "url(#ao-l)", 'opacity=".6"');
      s += poly([[hw - .7, 0, D], [hw, 0, D], [hw, H, D], [hw - .7, H, D]], "url(#ao-r)", 'opacity=".6"');

      const sk = shade(wall, .6);
      s += poly([[-hw, 0, zN], [-hw, 0, D], [-hw, .12, D], [-hw, .12, zN]], sk);
      s += poly([[hw, 0, zN], [hw, 0, D], [hw, .12, D], [hw, .12, zN]], sk);
      s += poly([[-hw, 0, D], [hw, 0, D], [hw, .12, D], [-hw, .12, D]], sk);

      (o.lights || []).forEach(([x, z, w, d]) => {
        s += poly([[x - w / 2, H - .012, z], [x + w / 2, H - .012, z], [x + w / 2, H - .012, z + d], [x - w / 2, H - .012, z + d]], "#fffdf0");
        const zc = Math.min(z + d / 2, 14), [gx, gy] = P(x, H - .02, zc);
        s += `<ellipse cx="${gx.toFixed(1)}" cy="${(gy + 3).toFixed(1)}" rx="${(w * sc(zc) * .9 + 6).toFixed(1)}" ry="${(d * sc(zc) * .12 + 5).toFixed(1)}" fill="url(#glow-c)" opacity=".5"/>`;
      });
      shell = s;
    }

    function windowSide(side, z0, z1, y0, y1, n = 1, opts = {}) {
      const x = side * hw;
      let s = poly([[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], `url(#${id}sky)`);
      let ext = "";
      for (let k = 0; k < 9; k++) {
        const za = z0 + rnd() * (z1 - z0 - .8), zb = za + .5 + rnd() * 1.2, hy = y0 + .1 + rnd() * (y1 - y0) * .5;
        ext += poly([[x, y0, za], [x, y0, zb], [x, hy, zb], [x, hy, za]], k % 3 === 0 ? "#7d8f7a" : "#aab4bb", 'opacity=".55"');
      }
      s += `<g filter="url(#${id}blur2)">${ext}</g>`;
      const k = -side;
      s += `<g filter="url(#${id}blur)">${poly([[x, y1, z0], [x, y1, z1], [x + k * 3.6, 0.02, z1 + 2.2], [x + k * 3.6, 0.02, z0 + 2.2]], "rgba(255,248,222,.17)")}${poly([[x, 0.02, z0], [x, 0.02, z1], [x + k * 3.2, 0.02, z1 + 2.0], [x + k * 3.2, 0.02, z0 + 2.0]], "rgba(255,248,222,.38)")}</g>`;
      for (let i = 0; i <= n; i++) {
        const z = z0 + (z1 - z0) * i / n;
        s += poly([[x, y0, z - .035], [x, y0, z + .035], [x, y1, z + .035], [x, y1, z - .035]], opts.frame || "#e8e6e1");
      }
      s += poly([[x, y0, z0], [x, y0, z1], [x, y0 + .06, z1], [x, y0 + .06, z0]], opts.frame || "#e8e6e1");
      s += poly([[x, y1 - .06, z0], [x, y1 - .06, z1], [x, y1, z1], [x, y1, z0]], opts.frame || "#e8e6e1");
      s += poly([[x, y0 - .02, z0], [x, y0 - .02, z1], [x, y0, z1], [x, y0, z0]], "rgba(0,0,0,.2)");
      shell += s;
      if (live) dust(Math.min(x, x + k * 3.2), Math.max(x, x + k * 3.2), y0 + .1, y1, z0, Math.min(D, z1 + 2), Math.round((z1 - z0) * 2.2) + 8);
    }

    // floating dust in a light shaft (3D box → a handful of tiny drifting specks)
    function dust(x0, x1, y0, y1, z0, z1, n) {
      dustSpots.push([x0, x1, y0, y1, z0, z1, n]);
    }
    function dustSvg() {
      let out = "";
      dustSpots.forEach(([x0, x1, y0, y1, z0, z1, n]) => {
        for (let i = 0; i < n; i++) {
          const x = x0 + (x1 - x0) * rnd(), y = y0 + (y1 - y0) * rnd(), z = z0 + (z1 - z0) * rnd(), [X, Y] = P(x, y, z);
          const r = (.5 + rnd() * 1.1) * Math.min(1.6, Math.max(.6, sc(z) / 45));
          out += `<circle class="dust" cx="${X.toFixed(1)}" cy="${Y.toFixed(1)}" r="${r.toFixed(2)}" style="--dx:${((rnd() - .5) * 26).toFixed(1)}px;--dy:${(-8 - rnd() * 26).toFixed(1)}px;--dt:${(14 + rnd() * 16).toFixed(1)}s;--ad:${(-rnd() * 24).toFixed(1)}s"/>`;
        }
      });
      return out;
    }

    function waves(zs) {
      let rip = "";
      const [cx0] = P(0, 0, zs), R = 6.4, rx = f * R / (zs + cb);
      const near = Math.max(zs - R, .3), yN = VB.cy + f * eye / (near + cb), yF = VB.cy + f * eye / (zs + R + cb);
      const n = live ? 12 : 4;
      for (let i = 0; i < n; i++)
        rip += `<ellipse class="ripple r${i + 1}" cx="${cx0.toFixed(1)}" cy="${((yN + yF) / 2).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${((yN - yF) / 2).toFixed(1)}"/>`;
      const path = pts => `M${pts.map(pt).join("L")}`;
      const e = [
        path([[0, 1.3, zs], [-hw * .55, H, zs + 3], [-hw, H * .55, zs + 6], [-hw * .3, 0, zs + 8]]),
        path([[0, 1.3, zs], [hw * .55, H, zs + 3.5], [hw, H * .5, zs + 6.5], [hw * .35, 0, zs + 9]]),
        path([[0, 1.3, zs], [0, H * .9, D], [-hw * .4, 0.4, zs + 3]])
      ].map(d => `<path class="echo" d="${d}"/>`).join("");
      return { rip, echo: e };
    }

    function finish(o) {
      objs.sort((a, b) => b.key - a.key);
      const w = waves(o.zs || D * .45);
      const head = `viewBox="0 0 ${VB.w} ${VB.h}" preserveAspectRatio="xMidYMin slice" aria-hidden="true"`;
      const tail = `<g>${lowGlow.join("")}</g>
        <rect width="${VB.w}" height="${VB.h}" fill="url(#${id}vig)"/>
        <rect width="${VB.w}" height="${VB.h}" fill="url(#${id}vig2)"/>
        <rect width="${VB.w}" height="${VB.h}" fill="url(#tx-film)" opacity=".16"/>`;
      const room = (layers) => `<g>${shell}</g><g filter="url(#${id}blur)">${shadows.join("")}</g><g filter="url(#${id}blur2)">${contact.join("")}</g>` +
        objs.filter(x => layers.includes(x.layer)).map(x => x.svg).join("");
      if (!live) {
        // thumbnails: one static svg, products already in place (the CSS state decides how they look)
        const rip = `<g class="ripples">${w.rip}</g>`;
        return `<div class="scene"><svg ${head}><defs>${defsStr}</defs>${room(["base"])}${rip}${tail}</svg></div>`;
      }
      const fx = `<g>${dustSvg()}</g><g class="ripples">${w.rip}</g><g class="echoes">${w.echo}</g><rect class="tint" width="${VB.w}" height="${VB.h}"/>`;
      const ambS = amb.sort((a, b) => b.key - a.key).map(x => x.svg).join("");
      const act = actors.sort((a, b) => b.key - a.key).map(x => x.svg).join("");
      const fp = o.focus ? P(o.focus[0], o.focus[1], o.focus[2]) : [VB.cx, VB.cy];
      return `<div class="scene live" data-fx="${fp[0].toFixed(1)}" data-fy="${fp[1].toFixed(1)}" data-fz="${(o.focus && o.focus[3]) || 1.8}">` +
        `<svg class="sc-a" ${head}><defs>${defsStr}</defs>${room(["base"])}${tail}</svg>` +
        `<svg class="sc-b" ${head}>${room(["base", "prod"])}${tail}</svg>` +
        `<svg class="sc-hang" ${head}>${objs.filter(x => x.layer === "hang").map(x => x.svg).join("")}</svg>` +
        `<svg class="sc-amb" ${head}>${ambS}</svg>` +
        `<svg class="sc-actors" ${head}>${act}</svg>` +
        `<svg class="sc-fx" ${head}>${fx}</svg></div>`;
    }

    // Draw the Feltouch products of this scenario (kind / look / surface / quantity come from calc.js)
    function applySolution(lines, zn) {
      const roomCeil = W * D;
      lines.forEach((ln, i) => {
        const area = ln.area ? ln.qty : ln.eqArea;
        const pid = ln.product || "";
        const uv = z => z ? { u0: z.z0, u1: z.z1, v0: z.y0, v1: z.y1 } : null;
        if (ln.surface === "ceiling") {
          const cz = zn.ceiling;
          if (ln.kind === "baffle") {
            const cov = Math.min(1, ln.qty / roomCeil);
            const zw = cz.x1 - cz.x0, zd = cz.z1 - cz.z0;
            const cols = Math.max(6, Math.min(24, Math.round(8 + cov * 18)));
            const d = zn.baffleD || 2.4, gap = .25, rows = Math.max(2, Math.floor((zd + gap) / (d + gap)));
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
              const x = cz.x0 + c * (zw / (cols - 1)), z = cz.z0 + r * ((zd - d) / Math.max(1, rows - 1));
              baffle(x, z, d, zn.baffleH || .3, zn.baffleDrop || .35, feltCol(Math.floor(c / 3) + r * 2), (c * 38 + r * 80) % 900);
            }
          } else if (ln.kind === "cloud") {
            const n = Math.max(3, Math.min(24, Math.round(ln.area ? ln.qty / 2.9 : ln.qty)));
            const cw = zn.cloudW || 1.3, cd = zn.cloudD || 2.1, zw = cz.x1 - cz.x0, zd = cz.z1 - cz.z0;
            const cols = Math.max(2, Math.round(Math.sqrt(n * zw / zd))), rows = Math.ceil(n / cols);
            let k = 0;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols && k < n; c++, k++)
              cloud(cz.x0 + (c + .5) * (zw / cols), cz.z0 + (r + .5) * (zd / rows), cw, cd, zn.cloudDrop || .5, feltCol(k + r), (k * 55) % 800);
          } else ceilTiles(cz, ln.qty, i);
        } else if (ln.surface === "wall3" || ln.surface === "wall4") {
          const side = ln.surface === "wall3" ? "L" : "R", z = uv((ln.surface === "wall3" ? zn.wallL : zn.wallR)[0]);
          if (ln.kind === "pods") pods(side, z, ln.qty, i);
          else if (pid.startsWith("cosmos")) wallModules(side, z, area, i);
          else wallSlabs(side, z, area, i, pid.startsWith("decosound"));
        } else if (ln.surface === "wall2") {
          const zones = zn.wallB || [];
          const tot = zones.reduce((a, q) => a + (q.x1 - q.x0) * (q.y1 - q.y0), 0) || 1;
          zones.forEach(q => {
            const share = area * ((q.x1 - q.x0) * (q.y1 - q.y0)) / tot, z = { u0: q.x0, u1: q.x1, v0: q.y0, v1: q.y1 };
            if (pid.startsWith("cosmos")) wallModules("B", z, share, i);
            else wallSlabs("B", z, share, i, pid.startsWith("decosound"));
          });
        }
      });
    }

    return {
      id, W, H, D, hw, P, poly, sc, add, rnd, box, cyl, person, walker, chair, table, plant, glow, pendant, monitor,
      applySolution, buildShell, windowSide, finish, dust
    };
  }

  /* =====================================================================
     SCENES
     ===================================================================== */
  const SCENES = {};

  /* ---------- AIRPORT TERMINAL ---------- */
  SCENES.airport = (lines, live) => {
    const S = createScene({ live, W: 16, H: 7.5, D: 26, f: 760, cb: 8, eye: 1.65, seed: 31 });
    const { hw, H, D, P, poly, box, sc } = S;
    S.buildShell({
      wall: "#e3e2dd", floor: "#cfd1d0", ceil: "#dfe2e3", floorPat: "tiles", floorLine: "rgba(40,46,50,.15)", glossy: true,
      skyTop: "#8fb7d0", skyBot: "#eef2ea", backWall: "#d6dada", ceilGrid: false,
      lights: [[-6, 0, .5, D], [-2, 0, .5, D], [2, 0, .5, D], [6, 0, .5, D]]
    });
    S.add(D + 8 + 50, (() => {
      const m = sc(D), [cx, cy] = P(2.5, 2.7, D), n = v => v.toFixed(1);
      let s = poly([[-hw, .3, D], [hw, .3, D], [hw, H - .5, D], [-hw, H - .5, D]], `url(#${S.id}sky)`);
      s += `<g filter="url(#blur1)" opacity=".7">${poly([[-hw, .3, D - .02], [hw, .3, D - .02], [hw, 1.5, D - .02], [-hw, 1.5, D - .02]], "#9aa1a3")}
        ${poly([[-6, 1.5, D - .02], [-5.2, 1.5, D - .02], [-5.2, 2.6, D - .02], [-6, 2.6, D - .02]], "#8f9ba3")}${poly([[-4.6, 1.5, D - .02], [-3.2, 1.5, D - .02], [-3.2, 3.2, D - .02], [-4.6, 3.2, D - .02]], "#9aa6ad")}</g>`;
      s += `<g filter="url(#blur1)"><ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(4.6 * m)}" ry="${n(.64 * m)}" fill="#c9d1d5"/>
        <path d="M${n(cx - 4 * m)},${n(cy - .1 * m)} L${n(cx - 4.8 * m)},${n(cy - 1.95 * m)} L${n(cx - 3.8 * m)},${n(cy - 1.95 * m)} L${n(cx - 2.3 * m)},${n(cy - .1 * m)}Z" fill="#c2cbd0"/>
        <path d="M${n(cx - .8 * m)},${n(cy + .1 * m)} L${n(cx - 2.8 * m)},${n(cy + 1.25 * m)} L${n(cx - 1.7 * m)},${n(cy + 1.25 * m)} L${n(cx + 1.2 * m)},${n(cy + .1 * m)}Z" fill="#aeb8be"/>
        <rect x="${n(cx - 3.7 * m)}" y="${n(cy - .08 * m)}" width="${n(7.7 * m)}" height="${n(.1 * m)}" fill="#425563" opacity=".6"/></g>`;
      return s;
    })());
    range(-hw, hw, 2).forEach(x => box(x - .07, 0, D - .16, .14, H - .4, .14, "#3b4044", { shadow: false, nostroke: true }));
    [3.4, 5.9].forEach(y => box(-hw, y, D - .16, hw * 2, .1, .14, "#3b4044", { shadow: false, nostroke: true }));

    range(7, 21, 3.6).forEach(z => {
      box(-7.5, 0, z, 1.8, 1.08, 3, "#f0efec", { tex: "plaster" });
      box(-7.6, 1.08, z - .02, 2.0, .06, 3.04, "#2d3235", { nostroke: true });
      S.monitor(-7.0, 1.14, z + .7, "front");
      box(-7.4, 4.0, z + .3, 1.5, .55, .1, "#2f343a", { shadow: false });
      box(-7.3, 4.15, z + .26, 1.1, .1, .02, "#e5c25b", { emit: true, nostroke: true });
      S.person(-6.1, z + 1.9, { seed: Math.round(z * 3), s: 1.0 });
    });
    [8, 11.5, 15, 18.5, 22].forEach(z => {
      for (let i = 0; i < 4; i++) {
        const x = 3.2 + i * 1.0;
        box(x, .43, z, .92, .1, .55, "#3f4f5d", { shadow: true, tex: "fabric" });
        box(x, .53, z - .02, .92, .55, .09, "#3f4f5d", { shadow: false, tex: "fabric" });
      }
      box(3.4, 0, z + .1, .06, .43, .06, "#2e3235", { shadow: false, nostroke: true });
      box(7.0, 0, z + .1, .06, .43, .06, "#2e3235", { shadow: false, nostroke: true });
    });
    [[-4.6, 10], [4.6, 10], [-4.6, 19], [4.6, 19]].forEach(([x, z]) => box(x - .4, 0, z - .4, .8, H, .8, "#d6d7d4", { tex: "plaster" }));
    [12, 21].forEach(z => {
      box(-1.0, 5.0, z, 2.0, .09, .1, "#2b2f33", { shadow: false });
      box(-.95, 5.15, z, 1.9, 1.05, .08, "#1b222b", { nostroke: true });
      for (let i = 0; i < 5; i++) box(-.8, 5.95 - i * .19, z - .006, 1.2 * (.5 + ((i * 37) % 10) / 20), .07, .005, i % 2 ? "#e5c25b" : "#f2f2f2", { emit: true, nostroke: true, bias: -.03 });
    });
    [[-1.2, 8.4, 1], [1.0, 10.2, -1], [-2.4, 13.4, 1], [0.2, 15.6, -1], [-.8, 19.4, 1], [2.2, 17.2, -1], [-3.2, 21.5, 1], [1.2, 23, -1]].forEach(([x, z, st], i) => {
      S.person(x, z, { seed: i * 17 + 3, s: .98 + (i % 3) * .03, pose: i % 3 === 0 ? "walk" : "stand", step: st, back: i % 2 === 1, bag: i % 4 === 1 ? "#26323f" : null });
      if (i % 2 === 0) { box(x + .4, 0, z - .08, .42, .66, .24, ["#3b4a58", "#8a2f2f", "#2a2d30"][i % 3], { shadow: true, tex: "fabric" }); box(x + .58, .66, z, .04, .24, .02, "#999", { shadow: false, nostroke: true }); }
    });
    [[3.9, 7.2], [5.6, 7.2], [4.4, 10.7], [6.2, 14.2], [4.8, 21.2]].forEach(([x, z], i) => S.person(x, z, { seated: true, back: true, seed: i * 11 + 5, bias: -.3 }));

    S.walker(4.3, { dir: 1, speed: 1.35, seed: 3, x: -2, phase: .15 });
    S.walker(4.55, { dir: 1, speed: 1.35, seed: 11, g: "f", x: -1.5, phase: .17, roller: "#8a2f2f" });
    S.walker(5.7, { dir: -1, speed: 1.1, seed: 8, g: "f", x: 2.5, phase: .62 });
    S.dust(-5, 5, .4, 5.2, 17, 25, 36);
    S.person(-2.95, 3.7, { seed: 21, anim: "idle", g: "m", s: 1 });
    S.person(-2.1, 3.8, { seed: 34, anim: "idle", g: "f", s: 1 });
    S.person(5.2, 4.6, { seed: 12, anim: "idle", pose: "phone", g: "m" });
    S.applySolution(lines, { ceiling: { x0: -7, x1: 7, z0: 5, z1: 24 }, baffleH: .3, baffleDrop: .55, baffleD: 2.8,
      wallL: [{ z0: 6, z1: 25, y0: 1.9, y1: 5.2 }], wallR: [{ z0: 6, z1: 25, y0: 1.9, y1: 5.2 }], wallB: [{ x0: -7, x1: 7, y0: .3, y1: 1.2 }] });
    return S.finish({ zs: 11, focus: [-2.5, 1.2, 3.75, 2.1] });
  };

  /* ---------- UNIVERSITY CLASSROOM ---------- */
  SCENES.classroom = (lines, live) => {
    const S = createScene({ live, W: 9, H: 3.4, D: 11, f: 800, cb: 7, eye: 1.65, seed: 17 });
    const { H, D, box, table, chair, plant } = S;
    S.buildShell({
      wall: "#ece4d5", floor: "#b99f80", ceil: "#f3f0ea", floorPat: "planks", floorLine: "rgba(60,40,20,.18)", floorTex: "wood", glossy: true,
      lights: [[-2, 2.5, 1.2, .6], [2, 2.5, 1.2, .6], [-2, 5.5, 1.2, .6], [2, 5.5, 1.2, .6], [-2, 8.5, 1.2, .6], [2, 8.5, 1.2, .6]]
    });
    S.windowSide(-1, 2.4, 10.4, 1.0, 2.8, 4);
    box(-2.1, 1.0, D - .06, 4.2, 1.45, .06, "#fbfbf8", { shadow: false });
    box(-2.18, .96, D - .08, 4.36, .06, .08, "#8d939a", { shadow: false, nostroke: true });
    box(-2.18, 2.45, D - .08, 4.36, .06, .08, "#8d939a", { shadow: false, nostroke: true });
    [[1.9, 1.3], [1.7, 2.4], [1.5, 1.7]].forEach(([y, l], i) => box(-1.6, y, D - .07, l, .03, .01, ["#3d6c9c", "#b5453b", "#2f2f2f"][i], { emit: true, nostroke: true, alpha: .8 }));
    box(2.4, 2.55, D - .08, .5, .5, .03, "#f5f5f2", { shadow: false, nostroke: true });
    table(-1.8, 8.8, 1.7, .7, .76, "#8a6a4a");
    box(-1.3, .76, 9.0, .42, .02, .3, "#c8cacc", { nostroke: true });
    S.person(1.2, 9.6, { seed: 21, top: "#44525f", g: "m", pose: "phone" });
    S.person(.2, 9.3, { seed: 24, g: "f", pose: "stand" });
    [4.2, 6.0, 7.8].forEach((z, ri) => [-3.2, -1.1, 1.1, 3.2].forEach((x, ci) => {
      table(x - .7, z, 1.4, .55, .74, "#d8cdb8", { leg: "#4a4f54", tex: "wood" });
      chair(x, z - .55, "+z", ["#425563", "#6f7a73", "#52606b"][ci % 3]);
      if ((ri * 4 + ci) % 5 !== 2) S.person(x, z - .64, { seated: true, back: true, seed: ri * 9 + ci * 5 + 2 });
      if ((ri + ci) % 2 === 0) { box(x - .24, .74, z + .1, .36, .02, .25, "#c9ccd0", { nostroke: true }); box(x - .24, .76, z + .3, .36, .2, .012, "#202428", { nostroke: true, shadow: false }); }
      else box(x + .1, .74, z + .1, .22, .02, .3, "#f3f1ea", { nostroke: true, shadow: false });
    }));
    plant(3.7, 9.8, 1.1);
    S.walker(2.5, { dir: 1, speed: 1.3, seed: 14, x: -1, phase: .3 });
    S.walker(2.95, { dir: -1, speed: 1.15, seed: 32, g: "f", x: 2, phase: .75 });
    S.person(-1.65, 2.9, { seed: 27, anim: "idle", g: "f" });
    S.person(-.8, 3.0, { seed: 9, anim: "idle", g: "m", top: "#7d8d76" });
    S.applySolution(lines, { ceiling: { x0: -3.9, x1: 3.9, z0: 2.6, z1: 9.8 }, cloudDrop: .5,
      wallL: [{ z0: 2.4, z1: 10.4, y0: 2.85, y1: 3.3 }], wallR: [{ z0: 2.4, z1: 10.4, y0: .8, y1: 2.6 }],
      wallB: [{ x0: -4.3, x1: -2.4, y0: .8, y1: 2.6 }, { x0: 2.4, x1: 4.3, y0: .8, y1: 2.6 }] });
    return S.finish({ zs: 5, focus: [-1.2, 1.15, 2.95, 2.0] });
  };

  /* ---------- OPEN OFFICE ---------- */
  SCENES.office = (lines, live) => {
    const S = createScene({ live, W: 11, H: 3.2, D: 14, f: 800, cb: 7, eye: 1.65, seed: 23 });
    const { box, table, chair, plant } = S;
    S.buildShell({
      wall: "#e6e4df", floor: "#8d9499", ceil: "#cdd0d1", floorTex: "carpet", ceilGrid: false,
      skyTop: "#9cc2d8", skyBot: "#e9f0ee",
      lights: [[-3, 3, .35, 10], [0, 3, .35, 10], [3, 3, .35, 10]]
    });
    S.windowSide(-1, 2.2, 13.4, .9, 2.8, 6);
    box(-1.0, 2.55, 1.5, .7, .45, 12.4, "#aeb2b4", { shadow: false, tex: "plaster" });
    box(1.6, 2.7, 1.5, .5, .35, 12.4, "#b9bcbe", { shadow: false, tex: "plaster" });
    const cols = [-3.6, -1.1, 2.4];
    [3.6, 7.4, 11.0].forEach((z, ri) => cols.forEach((x, ci) => {
      table(x - .75, z, 1.5, .75, .74, "#e9e6df", { leg: "#4a4f54", tex: "plaster" });
      S.monitor(x, .74, z + .35, "back");
      box(x - .22, .74, z + .08, .44, .012, .15, "#222", { nostroke: true, shadow: false });
      chair(x, z - .55, "+z", "#4c5054");
      if ((ri + ci) % 4 !== 3) S.person(x, z - .66, { seated: true, back: true, seed: ri * 7 + ci * 3 + 4 });
      table(x - .75, z + 1.45, 1.5, .75, .74, "#e9e6df", { leg: "#4a4f54", tex: "plaster" });
      S.monitor(x, .74, z + 1.5, "front", ci % 2 ? "#a9cfe0" : "#d3e4ea");
      chair(x, z + 2.4, "-z", "#6d7276");
      if ((ri * 3 + ci) % 3 !== 1) S.person(x, z + 2.5, { seated: true, seed: ri * 5 + ci * 7 + 9, bias: -.1 });
      box(x - .8, .74, z + .78, 1.6, .42, .035, "#cfd4d6", { shadow: false, tex: "fabric" });
      box(x + .35, .74, z + .5, .08, .1, .08, "#e8e8e8", { nostroke: true, shadow: false });
    }));
    box(3.0, 0, 11, 2.4, 2.4, .04, "#bcd6dc", { alpha: .28, shadow: false, nostroke: true });
    box(3.0, 0, 13.7, 2.4, 2.4, .04, "#bcd6dc", { alpha: .3, shadow: false, nostroke: true });
    table(3.5, 12.0, 1.5, .8, .74, "#7b6a58");
    [3.6, 4.6].forEach(x => chair(x, 11.6, "+z", "#425563"));
    S.person(4.1, 12.9, { seed: 55, g: "f", pose: "stand" });
    S.person(-2.2, 6.2, { seed: 61, pose: "walk", step: 1, bag: "#2a2d30" });
    plant(-4.8, 4.2, 1.2); plant(4.8, 5.6, 1.1); plant(-4.8, 12.5, 1.1);
    S.walker(2.3, { dir: -1, speed: 1.3, seed: 55, g: "f", x: 1.5, phase: .4 });
    S.walker(2.75, { dir: 1, speed: 1.2, seed: 70, x: -2, phase: .85 });
    S.person(2.75, 2.9, { seed: 61, anim: "idle", g: "m" });
    S.person(-4.4, 2.7, { seed: 18, anim: "idle", pose: "phone", g: "f" });
    S.person(1.9, 2.8, { seed: 38, anim: "idle", g: "f" });
    S.applySolution(lines, { ceiling: { x0: -4.8, x1: 4.8, z0: 2.2, z1: 13.9 }, baffleH: .3, baffleDrop: .4, baffleD: 2.4,
      wallL: [{ z0: 2.2, z1: 13.4, y0: 2.85, y1: 3.1 }], wallR: [{ z0: 2.6, z1: 13.6, y0: .9, y1: 2.6 }], wallB: [{ x0: -5, x1: -.4, y0: .8, y1: 2.7 }] });
    return S.finish({ zs: 6.5, focus: [2.3, 1.15, 2.85, 2.0] });
  };

  /* ---------- RESTAURANT ---------- */
  SCENES.restaurant = (lines, live) => {
    const S = createScene({ live, W: 10, H: 3.4, D: 12, f: 800, cb: 7, eye: 1.65, seed: 41 });
    const { D, box, cyl, chair, plant, pendant } = S;
    S.buildShell({
      wall: "#d6c1ac", floor: "#a67f5d", ceil: "#8d8882", floorPat: "planks", floorLine: "rgba(50,30,15,.24)", floorTex: "wood", glossy: true,
      backWall: "#bfa68f", ceilGrid: false, skyTop: "#cfdde6", skyBot: "#f4eede", lights: []
    });
    S.windowSide(-1, 2.6, 10.6, 1.0, 2.7, 3, { frame: "#5b4636" });
    [1.5, 2.0, 2.5].forEach(y => box(-3.4, y, D - .3, 6.8, .04, .3, "#5a4636", { shadow: false, tex: "wood" }));
    for (let i = 0; i < 22; i++) {
      const x = -3.2 + i * .3, y = [1.5, 2.0, 2.5][i % 3] + .04, hh = .22 + (i * 7 % 5) * .035;
      box(x, y, D - .22, .075, hh, .075, ["#3f5b4f", "#7a4a3a", "#cfc6a8", "#3e4a5a", "#b07069"][i % 5], { shadow: false, nostroke: true, bias: -.1 });
      box(x + .02, y + hh, D - .2, .035, .06, .035, "#c8c8c0", { shadow: false, nostroke: true, bias: -.11 });
    }
    box(-3.4, 0, D - 1.7, 6.8, 1.1, .7, "#4a3a2e", { tex: "wood" });
    box(-3.5, 1.1, D - 1.75, 7.0, .06, .8, "#8a6a4a", { nostroke: true, tex: "wood" });
    [-2.4, -.6, 1.4, 2.8].forEach((x, i) => S.person(x, D - .6, { seed: 30 + i * 4, top: ["#2a2d30", "#44525f", "#2a2d30", "#7d8d76"][i], g: i === 1 ? "f" : "m" }));
    [[-2.8, 4.0], [0, 4.7], [2.8, 4.0], [-3.0, 7.4], [0, 8.1], [3.0, 7.4]].forEach(([x, z], i) => {
      cyl(x, z, 0, .72, .05, "#2e3235", { shadow: false });
      cyl(x, z, .72, .76, .48, "#f4f1ea", { tex: "fabric" });
      cyl(x, z, .55, .72, .5, "#efece4", { shadow: false, tex: "fabric" });
      cyl(x, z, 0, .03, .27, "#2e3235", { shadow: false });
      cyl(x - .13, z + .06, .76, .78, .09, "#ffffff", { shadow: false });
      cyl(x + .16, z - .06, .76, .78, .09, "#ffffff", { shadow: false });
      cyl(x - .03, z - .12, .76, .86, .028, "#e6f1f4", { shadow: false });
      cyl(x + .02, z + .14, .76, .83, .02, "#f4e0a8", { shadow: false });
      chair(x - .64, z, "+x", "#6d4e3a"); chair(x + .64, z, "-x", "#6d4e3a"); chair(x, z + .68, "-z", "#6d4e3a");
      if (i % 2 === 0) S.person(x - .68, z, { seated: true, seed: i * 6 + 1, bias: -.35 });
      S.person(x, z + .74, { seated: true, seed: i * 9 + 4, bias: -.35 });
      if (i % 3 !== 1) S.person(x + .68, z, { seated: true, seed: i * 5 + 8, bias: -.35 });
      pendant(x, z, 2.35, { r: .27 });
    });
    box(3.7, 0, 3, 1.2, .45, 8.5, "#7a4a3a", { tex: "fabric" });
    box(4.85, .45, 3, .12, .7, 8.5, "#6a4033", { shadow: false, tex: "fabric" });
    plant(-4.4, 3.2, 1.2);
    S.person(-1.2, 5.9, { seed: 77, pose: "walk", step: 1, top: "#f1f1ee", bottom: "#222", g: "f" });
    S.walker(3.15, { dir: -1, speed: 1.1, seed: 81, g: "f", x: 2, phase: .6 });
    S.walker(2.7, { dir: 1, speed: 1.25, seed: 77, g: "m", top: "#f1f1ee", bottom: "#222", x: -1, phase: .2 });
    S.person(-1.75, 3.0, { seed: 90, anim: "idle", g: "f" });
    S.person(-.9, 3.1, { seed: 44, anim: "idle", g: "m" });
    S.applySolution(lines, { ceiling: { x0: -4.2, x1: 4.2, z0: 2.6, z1: 11.2 }, cloudDrop: .55, cloudW: 1.2, cloudD: 1.9,
      wallL: [{ z0: 2.6, z1: 10.6, y0: 2.85, y1: 3.3 }], wallR: [{ z0: 2.6, z1: 11, y0: 1.25, y1: 2.7 }],
      wallB: [{ x0: -5, x1: -3.5, y0: .8, y1: 2.9 }, { x0: 3.5, x1: 5, y0: .8, y1: 2.9 }] });
    return S.finish({ zs: 5.5, focus: [-1.3, 1.15, 3.05, 2.0] });
  };

  /* ---------- WAITING AREA ---------- */
  SCENES.waiting = (lines, live) => {
    const S = createScene({ live, W: 9, H: 3.4, D: 10, f: 800, cb: 6.5, eye: 1.65, seed: 53 });
    const { D, box, chair, plant, table } = S;
    S.buildShell({
      wall: "#e9e4da", floor: "#cbc6bd", ceil: "#f1efea", floorPat: "tiles", floorLine: "rgba(60,60,58,.16)", glossy: true,
      backWall: "#dde2de",
      lights: [[-2, 2.2, 1.2, .6], [2, 2.2, 1.2, .6], [-2, 5.2, 1.2, .6], [2, 5.2, 1.2, .6], [-2, 8.2, 1.2, .6], [2, 8.2, 1.2, .6]]
    });
    S.windowSide(-1, 2.4, 9.4, 1.0, 2.8, 3);
    box(-4.5, 0, D - .05, 4.3, 3.4, .05, "#a8c0bb", { shadow: false, nostroke: true, tex: "plaster" });
    box(-1.7, 1.9, D - .12, 2.5, 1.05, .08, "#17202a", { nostroke: true });
    for (let i = 0; i < 4; i++) box(-1.5, 2.7 - i * .2, D - .125, 1.1 * (.5 + ((i * 37) % 10) / 22), .07, .005, i % 2 ? "#e5d68e" : "#f2f2f2", { emit: true, nostroke: true, bias: -.03 });
    box(.9, 0, D - 1.8, 3.4, 1.05, .8, "#f2f0ea", { tex: "plaster" });
    box(.8, 1.05, D - 1.85, 3.6, .06, .9, "#2e3235", { nostroke: true });
    S.monitor(2.4, 1.11, D - 1.5, "back");
    S.person(2.0, D - .9, { seed: 44, top: "#44525f", g: "f" });
    S.person(.2, D - 2.8, { seed: 51, pose: "phone", g: "m" });
    [-2.4, -1.4, -.4, .6, 1.6].forEach((x, i) => {
      chair(x, 5.6, "+z", "#425563", { bh: .5 });
      chair(x, 6.3, "-z", "#80856d", { bh: .5 });
      if (i % 2 === 0) S.person(x, 5.55, { seated: true, back: true, seed: i * 13 + 6, bias: -.3 });
      if (i % 3 === 1) S.person(x, 6.35, { seated: true, seed: i * 7 + 2, bias: -.3 });
    });
    [4.2, 5.2, 6.2].forEach((z, i) => { chair(-3.6, z + 1.2, "+x", "#b07069", { bh: .5 }); if (i === 1) S.person(-3.55, z + 1.2, { seated: true, seed: 77, bias: -.3 }); });
    box(2.4, 0, 3.6, 1.9, .44, .85, "#6f7a80", { tex: "fabric" });
    box(2.4, .44, 3.6, 1.9, .52, .22, "#5e686e", { shadow: false, tex: "fabric" });
    box(2.28, .44, 3.7, .2, .32, .75, "#5e686e", { shadow: false, tex: "fabric" });
    box(4.2, .44, 3.7, .2, .32, .75, "#5e686e", { shadow: false, tex: "fabric" });
    S.person(3.1, 3.95, { seated: true, back: true, seed: 63, bias: -.3 });
    table(3.0, 5.4, .8, .5, .45, "#8a6a4a");
    box(3.15, .45, 5.55, .3, .02, .22, "#e8e2d4", { nostroke: true, shadow: false });
    plant(-4.0, 9.2, 1.4); plant(4.0, 3.0, 1.1);
    S.walker(3.4, { dir: 1, speed: 1.3, seed: 66, x: 0, phase: .5 });
    S.walker(4.05, { dir: -1, speed: 1.15, seed: 85, g: "f", x: 1.5, phase: .9 });
    S.person(-3.4, 3.9, { seed: 52, anim: "idle", pose: "phone", g: "m" });
    S.person(1.15, 3.6, { seed: 19, anim: "idle", g: "f" });
    S.person(1.95, 3.7, { seed: 73, anim: "idle", g: "m" });
    S.applySolution(lines, { ceiling: { x0: -3.8, x1: 3.8, z0: 2.0, z1: 9.0 },
      wallL: [{ z0: 2.4, z1: 9.4, y0: 2.85, y1: 3.3 }], wallR: [{ z0: 2.2, z1: 9.6, y0: .9, y1: 2.7 }], wallB: [{ x0: .9, x1: 4.3, y0: 1.5, y1: 2.9 }] });
    return S.finish({ zs: 4.8, focus: [1.55, 1.15, 3.65, 2.0] });
  };

  window.renderRoomScene = (icon, lines, live) => (SCENES[icon] ? SCENES[icon](lines || [], !!live) : "");
})();
