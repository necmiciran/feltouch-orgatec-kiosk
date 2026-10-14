// Minimal offline QR code generator (byte mode, error correction M, versions 1-5).
// QR.svg("https://rt60.feltouch.tr") -> inline <svg> markup (dark modules only, 2-module quiet zone).
const QR = (() => {
  // capacity table for ECC M: [version, dataCodewords, ecCodewordsPerBlock, blocks]
  const SPEC = [null, [1, 16, 10, 1], [2, 28, 16, 1], [3, 44, 26, 1], [4, 64, 18, 2], [5, 86, 24, 2]];
  const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30]];

  // GF(256) arithmetic, polynomial 0x11d
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

  function rsGenerator(deg) {
    let g = [1];
    for (let i = 0; i < deg; i++) {
      const n = new Array(g.length + 1).fill(0);
      g.forEach((c, j) => { n[j] ^= c; n[j + 1] ^= gmul(c, EXP[i]); });
      g = n;
    }
    return g;
  }
  function rsRemainder(data, deg) {
    const gen = rsGenerator(deg), res = new Array(deg).fill(0);
    data.forEach(b => {
      const f = b ^ res.shift();
      res.push(0);
      gen.slice(1).forEach((c, i) => { res[i] ^= gmul(c, f); });
    });
    return res;
  }

  function bch(val, poly, bits, extra) {
    let v = val << extra;
    const top = Math.floor(Math.log2(poly));
    for (let i = bits + extra - 1; i >= top; i--) if (v >> i & 1) v ^= poly << (i - top);
    return (val << extra) | v;
  }

  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    let ver = 1;
    while (ver <= 5 && bytes.length > SPEC[ver][1] - 2) ver++;
    if (ver > 5) throw new Error("text too long");
    const [, dataCw, ecPer, blocks] = SPEC[ver];

    // bit stream
    const bits = [];
    const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push(v >> i & 1); };
    push(4, 4); push(bytes.length, 8); bytes.forEach(b => push(b, 8));
    const cap = dataCw * 8;
    push(0, Math.min(4, cap - bits.length));
    while (bits.length % 8) bits.push(0);
    for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));

    // split into blocks, add EC, interleave
    const per = dataCw / blocks;
    const blk = [], ecs = [];
    for (let b = 0; b < blocks; b++) { const d = data.slice(b * per, (b + 1) * per); blk.push(d); ecs.push(rsRemainder(d, ecPer)); }
    const out = [];
    for (let i = 0; i < per; i++) blk.forEach(d => out.push(d[i]));
    for (let i = 0; i < ecPer; i++) ecs.forEach(e => out.push(e[i]));
    return { ver, codewords: out };
  }

  function matrix(text) {
    const { ver, codewords } = encode(text);
    const n = 17 + ver * 4;
    const m = Array.from({ length: n }, () => new Array(n).fill(null)); // null = free, 0/1 = fixed
    const set = (r, c, v) => { if (r >= 0 && r < n && c >= 0 && c < n) m[r][c] = v; };

    const finder = (r0, c0) => {
      for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
        const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark = inside && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        set(r0 + r, c0 + c, dark ? 1 : 0);
      }
    };
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 ? 0 : 1); set(i, 6, i % 2 ? 0 : 1); }
    const al = ALIGN[ver];
    al.forEach(r => al.forEach(c => {
      if (m[r][c] !== null) return; // overlaps a finder
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++)
        set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) === 1 ? 0 : 1);
    }));
    set(n - 8, 8, 1); // dark module

    // reserve format areas
    const reserved = [];
    for (let i = 0; i < 9; i++) { reserved.push([8, i], [i, 8]); }
    for (let i = 0; i < 8; i++) { reserved.push([8, n - 1 - i], [n - 1 - i, 8]); }
    reserved.forEach(([r, c]) => { if (m[r][c] === null) m[r][c] = 0; });

    // data placement (zig-zag)
    const bitsArr = [];
    codewords.forEach(cw => { for (let i = 7; i >= 0; i--) bitsArr.push(cw >> i & 1); });
    const isFree = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => m[r][c] === null));
    let k = 0, up = true;
    for (let col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let i = 0; i < n; i++) {
        const r = up ? n - 1 - i : i;
        for (let d = 0; d < 2; d++) {
          const c = col - d;
          if (isFree[r][c]) { m[r][c] = k < bitsArr.length ? bitsArr[k] : 0; k++; }
        }
      }
      up = !up;
    }

    // mask 0 ((r + c) % 2 == 0) applied to data modules only
    const dataMask = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => isFree[r][c]));
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dataMask[r][c] && (r + c) % 2 === 0) m[r][c] ^= 1;

    // format information: ECC M (00) + mask 0 (000)
    const fmt = bch(0b00000, 0x537, 5, 10) ^ 0x5412;
    for (let i = 0; i < 15; i++) {
      const bit = fmt >> i & 1;
      // around the top-left finder
      if (i < 6) m[i][8] = bit; else if (i < 8) m[i + 1][8] = bit; else if (i === 8) m[8][7] = bit; else m[8][14 - i] = bit;
      // split copy: top-right / bottom-left
      if (i < 8) m[8][n - 1 - i] = bit; else m[n - 15 + i][8] = bit;
    }
    return m;
  }

  function svg(text, { fill = "currentColor", quiet = 2 } = {}) {
    const m = matrix(text), n = m.length, s = n + quiet * 2;
    let d = "";
    for (let r = 0; r < n; r++) {
      let c = 0;
      while (c < n) {
        if (m[r][c]) { let w = 1; while (c + w < n && m[r][c + w]) w++; d += `M${c + quiet} ${r + quiet}h${w}v1h-${w}z`; c += w; } else c++;
      }
    }
    return `<svg viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="${text}"><rect width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="${fill}"/></svg>`;
  }

  return { svg, matrix };
})();
if (typeof module !== "undefined") module.exports = QR;
