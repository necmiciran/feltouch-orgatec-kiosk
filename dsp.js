// "After" sound: spectral late-reverberation suppression (Lebart-style), driven by the
// calculated RT60 of the room before / after Feltouch. The real "before" recording is
// processed so that its reverberant tail decays like the treated room: the late
// reverberant power is estimated from the recording's own decay rate (RT60 before) and
// removed in proportion to how much RT60 drops (RT60 after / before). A small level
// drop models the lower diffuse sound level of the more absorptive room (≈ 10·log10 of
// the RT60 ratio, damped).
//
// Runs in a Web Worker so the touch UI stays smooth; falls back to the main thread.
function dereverbCore(chs, sr, rtB, rtA) {
  const N = 1024, HOP = 256, K = N / 2 + 1;
  const len = chs[0].length, nch = chs.length;
  const nfr = Math.ceil((len + N) / HOP);
  const total = (nfr - 1) * HOP + N;

  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);

  // radix-2 FFT tables
  const rev = new Uint32Array(N);
  for (let i = 0, bits = Math.log2(N); i < N; i++) {
    let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const cosT = new Float64Array(N / 2), sinT = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos(2 * Math.PI * i / N); sinT[i] = -Math.sin(2 * Math.PI * i / N); }
  function fft(re, im, inverse) {
    for (let i = 0; i < N; i++) {
      const j = rev[i];
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1, step = N / size;
      for (let s = 0; s < N; s += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const wr = cosT[k], wi = inverse ? -sinT[k] : sinT[k];
          const a = s + j, b = a + half;
          const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
        }
      }
    }
    if (inverse) for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
  }

  // ---- analysis ----
  const re = new Float64Array(N), im = new Float64Array(N);
  const spec = [];
  const P = new Float32Array(nfr * K);
  for (let c = 0; c < nch; c++) {
    const x = chs[c];
    const sr_ = new Float32Array(nfr * K), si_ = new Float32Array(nfr * K);
    for (let m = 0; m < nfr; m++) {
      const off = m * HOP - N / 2;
      for (let i = 0; i < N; i++) {
        const idx = off + i;
        re[i] = (idx >= 0 && idx < len ? x[idx] : 0) * win[i];
        im[i] = 0;
      }
      fft(re, im, false);
      const b = m * K;
      for (let k = 0; k < K; k++) {
        sr_[b + k] = re[k]; si_[b + k] = im[k];
        P[b + k] += (re[k] * re[k] + im[k] * im[k]) / nch;
      }
    }
    spec.push({ re: sr_, im: si_ });
  }

  // ---- late-reverb gains ----
  const delta = 3 * Math.LN10 / rtB;                 // decay rate of the "before" room
  const Lf = Math.max(1, Math.round(0.06 * sr / HOP)); // late-reverb delay ≈ 60 ms
  const ed = Math.exp(-2 * delta * 0.06);
  const keep = Math.sqrt(Math.min(1, rtA / rtB));   // share of the tail that remains
  const alpha = Math.min(0.92, (1 - keep) * 1.3);
  const gmin = 0.16;

  const Pf = new Float32Array(nfr * K);              // frequency-smoothed power
  for (let m = 0; m < nfr; m++) {
    const b = m * K;
    for (let k = 0; k < K; k++) {
      let s = 0, n = 0;
      for (let d = -2; d <= 2; d++) { const kk = k + d; if (kk >= 0 && kk < K) { s += P[b + kk]; n++; } }
      Pf[b + k] = s / n;
    }
  }
  const G = new Float32Array(nfr * K);
  const prev = new Float32Array(K).fill(1), cur = new Float32Array(K);
  for (let m = 0; m < nfr; m++) {
    const b = m * K;
    for (let k = 0; k < K; k++) {
      const late = m >= Lf ? ed * Pf[(m - Lf) * K + k] : 0;
      const p = P[b + k] + 1e-12;
      const g = Math.sqrt(Math.max(1 - alpha * late / p, gmin * gmin));
      cur[k] = g > prev[k] ? 0.25 * prev[k] + 0.75 * g : 0.6 * prev[k] + 0.4 * g; // quick rise, slower fall
    }
    for (let k = 0; k < K; k++) {                    // 3-tap smoothing across frequency
      const a = cur[Math.max(0, k - 1)], c = cur[Math.min(K - 1, k + 1)];
      G[b + k] = 0.25 * a + 0.5 * cur[k] + 0.25 * c;
    }
    prev.set(G.subarray(b, b + K));
  }

  // ---- synthesis ----
  const dB = Math.min(4.5, 0.35 * 10 * Math.log10(rtB / rtA));
  const lvl = Math.pow(10, -dB / 20) / 1.5;          // 1.5 = Hann² overlap-add normalisation at 75 %
  const out = [];
  let peak = 0;
  for (let c = 0; c < nch; c++) {
    const y = new Float32Array(total);
    const { re: sr_, im: si_ } = spec[c];
    for (let m = 0; m < nfr; m++) {
      const b = m * K;
      for (let k = 0; k < K; k++) {
        const g = G[b + k];
        re[k] = sr_[b + k] * g; im[k] = si_[b + k] * g;
      }
      for (let k = 1; k < N / 2; k++) { re[N - k] = re[k]; im[N - k] = -im[k]; }
      fft(re, im, true);
      const off = m * HOP;
      for (let i = 0; i < N; i++) y[off + i] += re[i] * win[i];
    }
    const res = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const v = y[i + N / 2] * lvl;
      res[i] = v;
      const a = Math.abs(v); if (a > peak) peak = a;
    }
    out.push(res);
  }
  if (peak > 0.98) { const s = 0.98 / peak; out.forEach(a => { for (let i = 0; i < a.length; i++) a[i] *= s; }); }
  return out;
}

const Dereverb = (() => {
  let worker = null, failed = false;
  const pending = new Map();
  let seq = 0;

  function ensureWorker() {
    if (worker || failed) return;
    try {
      const src = `${dereverbCore.toString()}
        self.onmessage = e => { const d = e.data;
          const out = dereverbCore(d.channels, d.sr, d.rtB, d.rtA);
          self.postMessage({ id: d.id, out }, out.map(a => a.buffer)); };`;
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
      worker.onmessage = e => { const r = pending.get(e.data.id); if (r) { pending.delete(e.data.id); r(e.data.out); } };
      worker.onerror = () => { failed = true; worker = null; };
    } catch (err) { failed = true; worker = null; }
  }

  // returns a Promise<AudioBuffer> — the "after" version of `buffer`
  function process(ctx, buffer, rtB, rtA) {
    const chans = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) chans.push(new Float32Array(buffer.getChannelData(c)));
    ensureWorker();
    const run = () => new Promise(resolve => {
      if (worker && !failed) {
        const id = ++seq;
        pending.set(id, resolve);
        worker.postMessage({ id, channels: chans, sr: buffer.sampleRate, rtB, rtA }, chans.map(a => a.buffer));
      } else {
        setTimeout(() => resolve(dereverbCore(chans, buffer.sampleRate, rtB, rtA)), 0);
      }
    });
    return run().then(out => {
      const ab = ctx.createBuffer(out.length, out[0].length, buffer.sampleRate);
      out.forEach((a, c) => ab.copyToChannel(a, c));
      return ab;
    });
  }

  return { process };
})();

// ---------------------------------------------------------------------------------
// Room acoustics renderer — "before" and "after" are the SAME dry source placed in the
// room before / after the Feltouch treatment:
//   1. the recording is first made dry (late reverberation removed, see dereverbCore);
//   2. a room impulse response is synthesised from the calculated RT60 of every octave
//      band (125 Hz – 4 kHz, rows from calc.js = rt60.feltouch.tr engine): noise per band
//      with an exponential decay that reaches −60 dB at exactly that band's RT60;
//   3. direct sound + convolved reverberation are mixed with the real direct-to-reverberant
//      ratio of the room:  critical distance  dc = 0.057·√(V / RT60)  and a listener at
//      LISTENER_D metres  →  reverberant level = LISTENER_D / dc  (relative to the direct sound);
//   4. the after version also gets the calculated drop of the diffuse sound level.
// ---------------------------------------------------------------------------------
const Acoustics = (() => {
  const BANDS = [125, 250, 500, 1000, 2000, 4000];
  const MAX_RT = 8;        // s — longest tail that is synthesised
  const LISTENER_D = 3;    // m — listener distance from the sources
  const WET_CAP = 3.2;     // max reverberant/direct amplitude ratio (keeps the "before" listenable)
  const TRIM_START = 3;    // s — the first seconds of every recording are cut (reverb is rendered first)
  const TARGET_RMS_DB = -17;   // dBFS — every version is brought to this (loud) average level
  const CEILING = 0.89;        // ≈ −1 dBFS — nothing can exceed this (soft look-ahead limiter)
  const AFTER_DROP_DB = 0;     // extra level drop of "after" (0 = equally loud, a fair A/B; the UI still shows the calculated dB)

  const OAC = () => window.OfflineAudioContext || window.webkitOfflineAudioContext;

  async function makeIR(sr, rts, tilt = 0.5) {
    const sec = Math.min(MAX_RT, Math.max(...rts)) * 1.02 + 0.05;
    const len = Math.ceil(sr * sec);
    const oc = new (OAC())(2, len, sr);
    BANDS.forEach((f, i) => {
      const rt = Math.min(MAX_RT, Math.max(0.12, rts[i]));
      const nb = oc.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) { const d = nb.getChannelData(ch); for (let k = 0; k < len; k++) d[k] = Math.random() * 2 - 1; }
      const src = oc.createBufferSource(); src.buffer = nb;
      const bp = oc.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = 1.4;
      const g = oc.createGain(); g.gain.setValueAtTime(0, 0);
      const N = 4096, curve = new Float32Array(N), start = 0.012, span = len / sr - start;
      const w = Math.pow(125 / f, tilt);                      // gentle pink tilt (smaller = brighter, longer-ringing highs)
      for (let k = 0; k < N; k++) curve[k] = w * Math.pow(10, -3 * (k / (N - 1) * span) / rt); // −60 dB at t = RT60
      g.gain.setValueCurveAtTime(curve, start, span);
      src.connect(bp); bp.connect(g); g.connect(oc.destination); src.start();
    });
    const ir = await oc.startRendering();
    let e = 0;
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let k = 0; k < d.length; k++) e += d[k] * d[k]; }
    const sc = 1 / Math.sqrt(e / 2 || 1);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let k = 0; k < d.length; k++) d[k] *= sc; }
    return ir;
  }

  async function place(dry, V, rtMid, rts, opt = {}) {
    const sr = dry.sampleRate;
    const ir = await makeIR(sr, rts, opt.tilt);
    const dc = 0.057 * Math.sqrt(V / rtMid);
    const wet = Math.min(opt.wetCap || WET_CAP, LISTENER_D / dc);
    const oc = new (OAC())(dry.numberOfChannels, dry.length, sr);
    const src = oc.createBufferSource(); src.buffer = dry;
    const conv = oc.createConvolver(); conv.normalize = false; conv.buffer = ir;
    const gw = oc.createGain(); gw.gain.value = wet;
    src.connect(oc.destination); src.connect(conv); conv.connect(gw); gw.connect(oc.destination);
    src.start();
    return { buf: await oc.startRendering(), wet, dc };
  }

  const rms = b => { let s = 0, n = 0; for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) s += d[i] * d[i]; n += d.length; } return Math.sqrt(s / n); };
  const scale = (b, k) => { for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; } };
  const peak = b => { let p = 0; for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > p) p = a; } } return p; };

  // smooth look-ahead peak limiter: no clipping, no sudden bangs
  function limit(b, ceiling) {
    const n = b.length, nch = b.numberOfChannels, sr = b.sampleRate;
    const look = Math.max(8, Math.round(sr * 0.004)), rel = Math.exp(-1 / (sr * 0.12));
    const need = new Float32Array(n);
    for (let c = 0; c < nch; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) { const a = Math.abs(d[i]); if (a > ceiling) { const g = ceiling / a; if (g < need[i] || need[i] === 0) need[i] = g; } } }
    for (let i = 0; i < n; i++) if (need[i] === 0) need[i] = 1;
    // look-ahead minimum (sliding window) then box-smooth → linear attack ramps
    const mn = new Float32Array(n), dq = new Int32Array(n); let h = 0, t = 0;
    for (let i = n - 1; i >= 0; i--) {
      while (t > h && need[dq[t - 1]] >= need[i]) t--;
      dq[t++] = i;
      while (dq[h] > i + look) h++;
      mn[i] = need[dq[h]];
    }
    const ps = new Float64Array(n + 1); for (let i = 0; i < n; i++) ps[i + 1] = ps[i] + mn[i];
    let gPrev = 1;
    const gain = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const lo = Math.max(0, i - look), hi = Math.min(n, i + 1);
      const target = Math.min(mn[i], (ps[hi] - ps[lo]) / (hi - lo));        // ramped attack, never above the minimum
      gPrev = target < gPrev ? target : gPrev + (target - gPrev) * (1 - rel); // release
      gain[i] = Math.min(gPrev, mn[i]);
    }
    for (let c = 0; c < nch; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] *= gain[i]; }
  }

  function trim(ctx, b, sec) {
    const cut = Math.min(b.length - 1, Math.round(sec * b.sampleRate));
    const out = ctx.createBuffer(b.numberOfChannels, b.length - cut, b.sampleRate);
    for (let c = 0; c < b.numberOfChannels; c++) out.copyToChannel(b.getChannelData(c).subarray(cut), c);
    return out;
  }

  // Cutlery / plate / glass clatter (restaurants): inharmonic metallic partials with short
  // decays, Poisson-distributed in time. Added to the DRY signal, so the room decides how
  // long they ring: in the reverberant room they pile up into a metallic wash that buries
  // the speech; in the treated room they are short and speech stays clear.
  function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // Tableware events, each a short, heavily damped impact (a few ms to tens of ms) – the *room* then makes them ring on.
  //   plate  : ceramic clack – dull body knock + stiff mid modes, ~10 ms decay
  //   tink   : metal cutlery on china – brighter, ~15–30 ms
  //   glass  : rare, soft, a little longer
  //   scrape : cutlery dragged over a plate – band-limited noise with a stick-slip rattle
  function synthImpact(kind, sr, rnd) {
    const dur = kind === "scrape" ? 0.22 : kind === "glass" ? 0.28 : 0.12, n = Math.floor(sr * dur);
    const o = new Float32Array(n), TWO_PI = 2 * Math.PI;
    const modes = [];
    if (kind === "plate") {
      const f = 900 + rnd() * 900;
      modes.push([f * 0.42, 0.9, 0.007], [f, 1, 0.011], [f * 2.31 * (0.97 + rnd() * 0.06), 0.62, 0.008], [f * 3.87 * (0.97 + rnd() * 0.06), 0.4, 0.006], [f * 5.6 * (0.97 + rnd() * 0.06), 0.22, 0.004]);
    } else if (kind === "tink") {
      const f = 3000 + rnd() * 3200;
      modes.push([f, 1, 0.014 + rnd() * 0.012], [f * 1.47 * (0.98 + rnd() * 0.04), 0.5, 0.01], [f * 2.76 * (0.98 + rnd() * 0.04), 0.3, 0.006], [f * 0.5, 0.35, 0.012]);
    } else if (kind === "glass") {
      const f = 2300 + rnd() * 1200;
      modes.push([f, 1, 0.05 + rnd() * 0.03], [f * 2.32, 0.3, 0.03]);
    }
    if (kind !== "scrape") {
      for (const [fr, a, tau] of modes) {
        const ph = rnd() * TWO_PI;
        for (let k = 0; k < n; k++) { const t = k / sr; o[k] += a * Math.sin(TWO_PI * fr * t + ph) * Math.exp(-t / tau); }
      }
      // contact noise: first 1–3 ms, band-limited by a one-pole high-pass so it clicks rather than hisses
      const nn = Math.floor(sr * (0.0012 + rnd() * 0.0018)); let prev = 0;
      for (let k = 0; k < nn; k++) { const w = rnd() * 2 - 1, hp = w - prev; prev = w; o[k] += hp * 1.1 * (1 - k / nn); }
    } else {
      let lp1 = 0, lp2 = 0, env = 0;
      const rate = 70 + rnd() * 90, a1 = 0.55 + rnd() * 0.3;
      for (let k = 0; k < n; k++) {
        const t = k / sr, w = rnd() * 2 - 1;
        lp1 += (w - lp1) * a1; lp2 += (lp1 - lp2) * 0.35;
        const stick = 0.5 + 0.5 * Math.sin(TWO_PI * rate * t + 3 * Math.sin(TWO_PI * 11 * t));
        env = Math.sin(Math.PI * Math.min(1, k / n)) * stick * stick;
        o[k] = (lp1 - lp2) * 2.4 * env;
      }
    }
    // tiny fade-out so the event never ends on a click
    const f = Math.floor(sr * 0.004); for (let k = 0; k < f; k++) o[n - 1 - k] *= k / f;
    return o;
  }

  function addClinks(ctx, dry, cfg) {
    const sr = dry.sampleRate, n = dry.length, nch = dry.numberOfChannels;
    const out = ctx.createBuffer(nch, n, sr);
    const layer = []; for (let c = 0; c < nch; c++) layer.push(new Float32Array(n));
    const rnd = mulberry(cfg.seed || 20261014);
    const times = [];
    let t = 0.2;
    const kindOf = () => { const r = rnd(); return r < 0.46 ? "plate" : r < 0.88 ? "tink" : r < 0.94 ? "scrape" : "glass"; };
    while (t < n / sr - 0.4) {
      t += -Math.log(1 - rnd()) / cfg.perSec;                           // Poisson spacing
      const kind = kindOf();
      const burst = (kind === "plate" || kind === "tink") && rnd() < 0.35 ? 2 + Math.floor(rnd() * 3) : 1;   // clatter = quick cluster
      let when = t, amp0 = 0.4 + rnd() * 0.6;
      const pan = rnd();
      for (let b = 0; b < burst; b++) {
        const kd = b === 0 ? kind : (rnd() < 0.6 ? kind : "tink");
        const i0 = Math.floor(when * sr);
        if (i0 >= n - sr * 0.4) break;
        times.push(when);
        const ev = synthImpact(kd, sr, rnd), amp = amp0 * (kd === "glass" ? 0.45 : 1) * (1 - b * 0.12);
        const len = Math.min(ev.length, n - i0);
        for (let c = 0; c < nch; c++) {
          const g = nch === 1 ? 1 : (c === 0 ? 1 - pan : pan) * 1.4, L = layer[c];
          for (let k = 0; k < len; k++) L[i0 + k] += ev[k] * amp * g;
        }
        when += 0.018 + rnd() * 0.07;
      }
    }
    let eL = 0, eD = 0;
    for (let c = 0; c < nch; c++) { const d = dry.getChannelData(c), l = layer[c]; for (let i = 0; i < n; i++) { eL += l[i] * l[i]; eD += d[i] * d[i]; } }
    const k = Math.sqrt(eD / (eL || 1)) * cfg.level;                    // clatter RMS = level × speech/ambience RMS
    for (let c = 0; c < nch; c++) { const d = dry.getChannelData(c), l = layer[c], o = out.getChannelData(c); for (let i = 0; i < n; i++) o[i] = d[i] + l[i] * k; }
    return { buf: out, times };
  }

  // calc = scenario.calc (rows per octave band, volume, before / after, deltaDb)
  async function render(ctx, rec, calc, fx = {}) {
    let dry = await Dereverb.process(ctx, rec, 1.2, 0.35);
    let clinkTimes = null;
    if (fx.clinks) { const c = addClinks(ctx, dry, fx.clinks); dry = c.buf; clinkTimes = c.times; }
    const bandRT = key => calc.rows.map(r => r[key]);
    const opt = { wetCap: fx.wetCap, tilt: fx.irTilt };
    const before = await place(dry, calc.volume, calc.before, bandRT("base"), opt);
    const after = await place(dry, calc.volume, calc.after, bandRT("after"), { tilt: fx.irTilt });
    // cut the first seconds (the reverberant field has already built up), then level-match
    const b0 = trim(ctx, before.buf, TRIM_START), a0 = trim(ctx, after.buf, TRIM_START);
    const target = Math.pow(10, TARGET_RMS_DB / 20);
    scale(b0, target / (rms(b0) || 1));
    scale(a0, target * Math.pow(10, -AFTER_DROP_DB / 20) / (rms(a0) || 1));
    limit(b0, CEILING); limit(a0, CEILING);
    before.buf = b0; after.buf = a0;
    return { before: before.buf, after: after.buf, info: { clinkTimes, wetBefore: before.wet, wetAfter: after.wet, dcBefore: before.dc, dcAfter: after.dc, dropDb: AFTER_DROP_DB } };
  }

  return { render, makeIR, BANDS, TRIM_START };
})();

if (typeof module !== "undefined") module.exports = { dereverbCore };
