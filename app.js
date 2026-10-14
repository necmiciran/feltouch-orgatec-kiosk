(() => {
  "use strict";

  // Feltouch brandbook colours (canvas drawing)
  const BRICK = "#b07069"; // Brick Dust → "before"
  const OIL = "#80856d";   // Oil Green  → "after"
  const FELT = ["#80856d", "#a8c0bb", "#e5d68e", "#afab97", "#b07069", "#425563"];

  const IDLE_TIMEOUT_MS = 45000;
  const WIPE_COVER_MS = 520;   // bars fully cover the screen → swap content
  const WIPE_DONE_MS = 620;    // bars have left → navigation unlocked
  const $ = id => document.getElementById(id);
  const app = $("app");

  /* ---------------- language (EN default for ORGATEC Köln; 9 languages) ---------------- */
  let lang = DEFAULT_LANG;
  const t = (key, params = {}) =>
    (I18N[lang][key] ?? I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? params[k] : ""));
  const pick = v => (typeof v === "string" ? v : v[lang] || v.en);
  const num = (x, d = 2) => new Intl.NumberFormat(lang, { minimumFractionDigits: d, maximumFractionDigits: d }).format(x);
  const num1 = x => new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(x);

  function setLang(next) {
    if (next === lang) return;
    lang = next;
    app.classList.add("blink");
    applyLang();
    setTimeout(() => app.classList.remove("blink"), 520);
  }

  function applyLang() {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll("[data-lang-menu]").forEach(root => {
      root.querySelector(".lang-code").textContent = lang.toUpperCase();
      root.querySelectorAll(".lang-pop button").forEach(b => b.classList.toggle("on", b.dataset.lang === lang));
    });
    document.title = lang === "tr" ? "Feltouch · Akustik Deneyim" : "Feltouch · Acoustic Experience";
    updateGridTexts();
    if (currentScenario) {
      compareTitle.textContent = pick(currentScenario.room);
      renderSolution(currentScenario);
      refreshDurations();
      if (deltaPct != null) showDelta();
      if (statShown.before) statBefore.textContent = num(currentScenario.calc.before);
      if (statShown.after) statAfter.textContent = num(currentScenario.calc.after);
      const curves = [curvesState.before, curvesState.after].filter(Boolean);
      if ($("screen-compare").classList.contains("active")) drawChartFrame(chartMaxTime(currentScenario), curves);
    }
    renderLabel();
  }

  // language picker (dropdown) — rendered into every [data-lang-menu]
  document.querySelectorAll("[data-lang-menu]").forEach(root => {
    root.innerHTML = `
      <button class="lang-btn" type="button" aria-haspopup="listbox" aria-expanded="false">
        <svg viewBox="0 0 24 24" aria-hidden="true" class="ic-globe"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>
        <span class="lang-code">EN</span>
        <svg viewBox="0 0 10 6" aria-hidden="true" class="ic-chev"><path d="M1 1l4 4 4-4"/></svg>
      </button>
      <div class="lang-pop" role="listbox" hidden>
        ${LANGS.map(l => `<button type="button" role="option" data-lang="${l.code}"><b>${l.code.toUpperCase()}</b><span>${l.name}</span></button>`).join("")}
      </div>`;
    const btn = root.querySelector(".lang-btn"), pop = root.querySelector(".lang-pop");
    btn.addEventListener("click", e => { e.stopPropagation(); togglePop(root, pop.hidden); });
    pop.addEventListener("click", e => {
      const b = e.target.closest("button[data-lang]");
      if (!b) return;
      setLang(b.dataset.lang);
      togglePop(root, false);
    });
  });
  function togglePop(root, open) {
    document.querySelectorAll("[data-lang-menu]").forEach(r => {
      const o = r === root && open;
      r.querySelector(".lang-pop").hidden = !o;
      r.querySelector(".lang-btn").setAttribute("aria-expanded", String(o));
      r.classList.toggle("open", o);
    });
  }
  document.addEventListener("pointerdown", e => { if (!e.target.closest("[data-lang-menu]")) togglePop(null, false); });

  /* ---------------- navigation (brand-bar wipe between screens) ---------------- */
  const screens = document.querySelectorAll(".screen");
  const wipe = $("wipe");
  let navigating = false;
  let idleTimer = null;

  function showScreen(name) {
    screens.forEach(s => s.classList.toggle("active", s.dataset.screen === name));
    togglePop(null, false);
    if (name !== "compare") stopAmbienceAndResetUI();
    if (name === "idle") { if (lang !== DEFAULT_LANG) { lang = DEFAULT_LANG; applyLang(); } Fon.start(); } else Fon.stop();
    resetIdleTimer();
  }

  function navigate(name, setup) {
    if (navigating) return;
    const cur = document.querySelector(".screen.active");
    if (cur && cur.dataset.screen === name && !setup) return;
    navigating = true;
    wipe.classList.remove("out");
    wipe.classList.add("in");
    setTimeout(() => {
      showScreen(name);
      if (setup) setup();
      wipe.classList.remove("in");
      wipe.classList.add("out");
      setTimeout(() => { wipe.classList.remove("out"); navigating = false; }, WIPE_DONE_MS);
    }, WIPE_COVER_MS);
  }

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    const current = document.querySelector(".screen.active").dataset.screen;
    if (current === "idle") return;
    idleTimer = setTimeout(() => navigate("idle"), IDLE_TIMEOUT_MS);
  }
  document.addEventListener("pointerdown", resetIdleTimer);

  $("btn-start").addEventListener("click", () => {
    unlockAudio();
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    navigate("select");
  });

  document.querySelectorAll("[data-nav]").forEach(btn => {
    btn.addEventListener("click", () => navigate(btn.dataset.nav));
  });

  /* ---------------- scenario cards ---------------- */
  const grid = $("scenario-grid");
  const cardRefs = [];
  SCENARIOS.forEach((sc, i) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "room-card rise";
    card.style.setProperty("--i", i + 2);
    card.innerHTML = `
      <div class="room-thumb state-after">${renderRoomScene(sc.icon, sc.calc.lines)}</div>
      <div class="room-info">
        <span class="room-no">0${i + 1}</span>
        <h3></h3>
        <p class="room-meta"><b></b><span></span></p>
      </div>`;
    card.addEventListener("click", () => navigate("compare", () => openScenario(sc)));
    grid.appendChild(card);
    cardRefs.push({ sc, h3: card.querySelector("h3"), b: card.querySelector(".room-meta b"), s: card.querySelector(".room-meta span") });
  });
  // sixth tile: the Feltouch RT60 calculator (QR code) — fills the grid
  (() => {
    const tile = document.createElement("div");
    tile.className = "calc-tile rise";
    tile.style.setProperty("--i", SCENARIOS.length + 2);
    tile.innerHTML = `
      <div class="calc-qr">${QR.svg("https://rt60.feltouch.tr", { fill: "#4c5054" })}</div>
      <div class="calc-text">
        <svg class="calc-ic" aria-hidden="true"><use href="#ft-symbol"/></svg>
        <h3 data-i18n="calc_cta"></h3>
        <p data-i18n="calc_note"></p>
        <b>rt60.feltouch.tr</b>
      </div>`;
    grid.appendChild(tile);
  })();
  function updateGridTexts() {
    cardRefs.forEach(({ sc, h3, b, s }) => {
      h3.textContent = pick(sc.room);
      b.textContent = `${num(sc.calc.treated, 0)} m²`;
      s.textContent = t("prod_count", { n: sc.calc.lines.length });
    });
  }

  /* ---------------- compare screen ---------------- */
  const compareTitle = $("compare-title");
  const statBefore = $("stat-before");
  const statAfter = $("stat-after");
  const statDelta = $("stat-delta");
  const deltaValue = $("delta-value");
  const deltaDb = $("delta-db");
  const playheadLabel = $("playhead-label");
  const btnBefore = $("btn-before");
  const btnAfter = $("btn-after");
  const progBefore = $("prog-before");
  const progAfter = $("prog-after");
  const timeBefore = $("time-before");
  const timeAfter = $("time-after");
  const roomVisual = $("room-visual");
  const roomDims = $("room-dims");
  const factDuration = $("fact-duration");
  const solList = $("sol-list");
  const solTotal = $("sol-total");
  const solCover = $("sol-cover");
  const canvas = $("decay-canvas");
  const ctx2d = canvas.getContext("2d");

  let currentScenario = null;
  let curvesState = { before: null, after: null };
  let statShown = { before: false, after: false };
  let deltaPct = null;
  let renderGen = 0; // bumped on every tap so a stale in-flight animation never blocks new taps
  let label = { key: "hint_default", params: {} };

  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  function setLabel(key, params = {}) { label = { key, params }; renderLabel(); }
  function renderLabel() {
    const p = label.params;
    // numbers are stored raw and formatted here so they follow the active language
    playheadLabel.textContent = label.key === "summary"
      ? t("summary", { n: num(p.n, 0), a: num(p.a), b: num(p.b) })
      : t(label.key, p);
  }

  function refreshDurations() {
    const buf = currentScenario && bufferCache.get(currentScenario.audio);
    const txt = buf ? fmt(Math.max(0, buf.duration - Acoustics.TRIM_START)) : "—";
    timeBefore.textContent = txt;
    timeAfter.textContent = txt;
    factDuration.textContent = txt === "—" ? "" : `${txt} ${t("min")}`;
  }

  function renderSolution(sc) {
    const c = sc.calc;
    roomDims.textContent = t("room_dims", { w: num1(c.dims.w), l: num1(c.dims.l), h: num1(c.dims.h), v: num(c.volume, 0) });
    solList.innerHTML = c.lines.map((l, i) => {
      const surf = t(l.surface === "ceiling" ? "surf_ceiling" : l.surface === "floor" ? "surf_floor" : "surf_wall");
      const qty = l.area ? `${num(l.qty, 0)} m²` : `${num(l.qty, 0)} ${t("pcs")}`;
      const sub = l.area ? (l.pieces ? t("approx_pcs", { n: num(l.pieces, 0) }) : "") : `${num(l.eqArea, 1)} m² ${t("eq")}`;
      return `<li>
        <i class="sw k-${l.kind}" style="--c:${FELT[(i + 1) % FELT.length]}"></i>
        <div class="sol-name"><span class="sol-series">${l.series} · ${surf}</span><b>${l.name}</b></div>
        <div class="sol-qty"><b>${qty}</b><small>${sub}</small></div>
      </li>`;
    }).join("");
    solTotal.textContent = `${num(c.treated, 0)} m²`;
    solCover.textContent = t("sol_cover", { p: num(Math.round(c.coverage * 100), 0) });
  }

  // numbers count up with a small pop instead of just appearing
  function countTo(el, target, ms = 750) {
    el.classList.remove("pop");
    void el.offsetWidth;
    el.classList.add("pop");
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = num(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => { el.textContent = num(target); }, ms + 80);
  }

  function showDelta() {
    deltaValue.textContent = t("delta", { n: num(deltaPct, 0) });
    deltaDb.textContent = t("db_value", { n: num(currentScenario.calc.deltaDb, 1) });
  }

  function openScenario(sc) {
    currentScenario = sc;
    curvesState = { before: null, after: null };
    statShown = { before: false, after: false };
    deltaPct = null;
    renderGen++;
    stopAmbienceAndResetUI();

    compareTitle.textContent = pick(sc.room);
    renderSolution(sc);
    statBefore.textContent = "—";
    statAfter.textContent = "—";
    deltaValue.textContent = "—";
    deltaDb.innerHTML = "&nbsp;";
    statDelta.classList.remove("ready");
    setLabel("hint_default");

    roomVisual.innerHTML = renderRoomScene(sc.icon, sc.calc.lines);
    setRoomState("before");
    refreshDurations();
    loadBuffer(sc.audio).catch(() => {});
    getRender(sc).catch(() => {}); // prepare both versions of this room right away

    fitCanvas();
    drawChartFrame(chartMaxTime(sc), []);
  }

  btnBefore.addEventListener("click", () => playSide("before"));
  btnAfter.addEventListener("click", () => playSide("after"));

  async function playSide(mode) {
    if (!currentScenario) return;
    const myGen = ++renderGen; // supersedes any in-flight animation from a previous tap
    const sc = currentScenario;
    const rt60 = mode === "before" ? sc.calc.before : sc.calc.after;
    const color = mode === "before" ? BRICK : OIL;
    const maxTime = chartMaxTime(sc);

    btnBefore.classList.remove("playing");
    btnAfter.classList.remove("playing");
    progBefore.style.width = progAfter.style.width = "0%";
    refreshDurations();
    (mode === "before" ? btnBefore : btnAfter).classList.add("playing");
    roomVisual.classList.add("is-playing");
    setRoomState(mode);
    setLabel(mode === "before" ? "playing_before" : "playing_after");
    statShown[mode] = true;
    countTo(mode === "before" ? statBefore : statAfter, rt60);

    playAmbience(sc, mode);

    const other = curvesState[mode === "before" ? "after" : "before"];
    await animateCurve(rt60, color, other ? [other] : [], maxTime, () => myGen === renderGen);
    if (myGen !== renderGen) return; // a newer tap took over meanwhile — don't finalize stale state
    curvesState[mode] = { rt60, upTo: curveSpan(rt60), color };
    // The "playing" state is cleared by the audio source's onended handler — the
    // real recording keeps playing for its full length after this short curve.

    if (curvesState.before && curvesState.after) {
      deltaPct = Math.round(sc.calc.improvement);
      showDelta();
      statDelta.classList.remove("ready");
      void statDelta.offsetWidth;
      statDelta.classList.add("ready");
      setLabel("summary", { n: deltaPct, a: sc.calc.before, b: sc.calc.after });
    } else if (label.key !== "preparing") {
      setLabel(mode === "before" ? "hint_tap_after" : "hint_tap_before");
    }
  }

  function setRoomState(mode) {
    roomVisual.classList.toggle("state-after", mode === "after");
    roomVisual.classList.toggle("state-before", mode === "before");
  }

  /* ---------------- audio: real recording (before) + processed recording (after) ---------------- */
  let audioCtx = null;
  const bufferCache = new Map();
  const renderCache = new Map();  // scenario id → Promise<{before, after}>  (AudioBuffers)
  const renderReady = new Set();
  let currentSource = null;
  let progressTimer = null;
  let playToken = 0;

  function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  async function loadBuffer(url) {
    if (bufferCache.has(url)) return bufferCache.get(url);
    const ctx = getAudioCtx();
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buf = await ctx.decodeAudioData(arr);
    bufferCache.set(url, buf);
    if (currentScenario && currentScenario.audio === url) refreshDurations();
    return buf;
  }

  // Both versions are the same recording placed in the room: "before" with the existing
  // room's calculated RT60 (long, unclean reverberation), "after" with the Feltouch-treated
  // room's calculated RT60 (see dsp.js → Acoustics.render).
  function getRender(sc) {
    if (!renderCache.has(sc.id)) {
      renderCache.set(sc.id, loadBuffer(sc.audio)
        .then(buf => Acoustics.render(getAudioCtx(), buf, sc.calc, sc.audioFx))
        .then(r => { renderReady.add(sc.id); return r; }));
    }
    return renderCache.get(sc.id);
  }

  function stopAmbience() {
    playToken++;
    clearInterval(progressTimer);
    progressTimer = null;
    if (currentSource) {
      currentSource.onended = null;
      try { currentSource.stop(); } catch (e) { /* already stopped */ }
      currentSource = null;
    }
  }

  function resetPlaybackUI() {
    btnBefore.classList.remove("playing");
    btnAfter.classList.remove("playing");
    roomVisual.classList.remove("is-playing");
    progBefore.style.width = progAfter.style.width = "0%";
    refreshDurations();
  }

  function stopAmbienceAndResetUI() {
    stopAmbience();
    resetPlaybackUI();
  }

  function startProgress(mode, startTime, dur) {
    clearInterval(progressTimer);
    const bar = mode === "before" ? progBefore : progAfter;
    const lbl = mode === "before" ? timeBefore : timeAfter;
    progressTimer = setInterval(() => {
      const tt = Math.min(dur, Math.max(0, audioCtx.currentTime - startTime));
      bar.style.width = `${(tt / dur * 100).toFixed(1)}%`;
      lbl.textContent = `${fmt(tt)} / ${fmt(dur)}`;
    }, 100);
  }

  // iOS/Safari only "unlocks" audio for a sound that starts synchronously inside a
  // real touch event. Starting playback later (after `await fetch`) stays silent on
  // iPad, so we unlock on the very first tap, pre-decode every recording and
  // prepare every "after" version in the background.
  let audioUnlocked = false;
  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    const ctx = getAudioCtx();
    const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = silent;
    src.connect(ctx.destination);
    src.start(0);
    SCENARIOS.forEach(sc => { loadBuffer(sc.audio).catch(() => {}); });
    SCENARIOS.reduce((p, sc) => p.then(() => getRender(sc)).catch(() => {}), Promise.resolve());
  }

  async function playAmbience(sc, mode) {
    const token = ++playToken;
    let buffer;
    try {
      if (!renderReady.has(sc.id)) setLabel("preparing");
      buffer = (await getRender(sc))[mode];
      if (label.key === "preparing" && token === playToken) setLabel(mode === "before" ? "playing_before" : "playing_after");
    } catch (e) {
      console.warn("Audio could not be loaded:", sc.audio, e);
      return;
    }
    if (token !== playToken) return; // a newer tap superseded this one while loading
    const ctx = getAudioCtx();
    stopAmbience();
    playToken = token;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const dur = buffer.duration; // each recording plays for its own real length
    const now = ctx.currentTime;
    const fadeIn = Math.min(0.4, dur / 4);
    const fadeOut = Math.min(0.5, dur / 4);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fadeIn);
    gain.gain.setValueAtTime(1, Math.max(now + fadeIn, now + dur - fadeOut));
    gain.gain.linearRampToValueAtTime(0, now + dur);
    // safety limiter on the output: loud, but never a bang
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.2;
    src.connect(gain);
    gain.connect(lim);
    lim.connect(ctx.destination);

    src.onended = () => {
      if (currentSource === src) {
        currentSource = null;
        clearInterval(progressTimer);
        progressTimer = null;
        resetPlaybackUI();
      }
    };

    src.start(now);
    src.stop(now + dur + 0.05);
    currentSource = src;
    startProgress(mode, now, dur);
  }

  /* ---------------- chart rendering (real RT60 values, axis in seconds) ---------------- */
  const PAD = { left: 50, right: 18, top: 22, bottom: 30 };

  function fitCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const curveSpan = rt60 => rt60 * 1.15;                       // seconds of decay drawn
  const animDur = rt60 => Math.max(0.9, Math.min(3, 0.35 * rt60 + 0.9)); // on-screen reveal time

  function chartMaxTime(sc) {
    return Math.max(curveSpan(sc.calc.before), curveSpan(sc.calc.after));
  }

  function plotSize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    return { w, h, plotW: w - PAD.left - PAD.right, plotH: h - PAD.top - PAD.bottom };
  }

  function timeToX(tt, maxTime, plotW) { return PAD.left + (tt / maxTime) * plotW; }
  function dbToY(db, plotH) { return PAD.top + (db / -60) * plotH; }

  function drawChartFrame(maxTime, curves) {
    const { w, h, plotW, plotH } = plotSize();
    const font = getComputedStyle(document.body).fontFamily;
    ctx2d.clearRect(0, 0, w, h);
    ctx2d.lineWidth = 1;
    ctx2d.font = `600 11px ${font}`;

    for (let db = 0; db >= -60; db -= 10) {
      const y = dbToY(db, plotH);
      ctx2d.strokeStyle = db === 0 || db === -60 ? "rgba(76,80,84,.34)" : "rgba(76,80,84,.12)";
      ctx2d.setLineDash(db === -60 ? [4, 4] : []);
      ctx2d.beginPath();
      ctx2d.moveTo(PAD.left, y);
      ctx2d.lineTo(PAD.left + plotW, y);
      ctx2d.stroke();
      ctx2d.fillStyle = "rgba(76,80,84,.7)";
      ctx2d.textAlign = "right";
      ctx2d.fillText(`${db}`, PAD.left - 10, y + 4);
    }
    ctx2d.setLineDash([]);

    ctx2d.textAlign = "center";
    const step = maxTime > 6 ? 1 : maxTime > 3 ? 0.5 : maxTime > 1.5 ? 0.25 : 0.1;
    for (let tt = 0; tt <= maxTime + 0.001; tt += step) {
      const x = timeToX(tt, maxTime, plotW);
      ctx2d.strokeStyle = "rgba(76,80,84,.07)";
      ctx2d.beginPath();
      ctx2d.moveTo(x, PAD.top);
      ctx2d.lineTo(x, PAD.top + plotH);
      ctx2d.stroke();
      ctx2d.fillStyle = "rgba(76,80,84,.7)";
      ctx2d.fillText(`${num1(tt)} ${t("sec")}`, x, PAD.top + plotH + 19);
    }
    ctx2d.textAlign = "left";
    ctx2d.fillStyle = "rgba(76,80,84,.55)";
    ctx2d.fillText("dB", 6, PAD.top - 8);

    curves.forEach(c => drawCurve(c, maxTime, plotW, plotH));
  }

  function drawCurve({ rt60, upTo, color }, maxTime, plotW, plotH) {
    const steps = 140;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const tt = (upTo / steps) * i;
      const db = Math.max(-60, -60 * (tt / rt60));
      pts.push([timeToX(tt, maxTime, plotW), dbToY(db, plotH)]);
    }
    const baseY = dbToY(-60, plotH);

    // soft area under the curve
    const grad = ctx2d.createLinearGradient(0, PAD.top, 0, baseY);
    grad.addColorStop(0, hexA(color, 0.2));
    grad.addColorStop(1, hexA(color, 0.02));
    ctx2d.beginPath();
    ctx2d.moveTo(pts[0][0], baseY);
    pts.forEach(([x, y]) => ctx2d.lineTo(x, y));
    ctx2d.lineTo(pts[pts.length - 1][0], baseY);
    ctx2d.closePath();
    ctx2d.fillStyle = grad;
    ctx2d.fill();

    ctx2d.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx2d.lineTo(x, y) : ctx2d.moveTo(x, y)));
    ctx2d.strokeStyle = color;
    ctx2d.lineWidth = 3;
    ctx2d.lineJoin = "round";
    ctx2d.lineCap = "round";
    ctx2d.stroke();

    if (upTo >= rt60) {
      // RT60 marker where the curve reaches −60 dB
      const x = timeToX(rt60, maxTime, plotW);
      ctx2d.beginPath();
      ctx2d.arc(x, baseY, 5.5, 0, Math.PI * 2);
      ctx2d.fillStyle = color;
      ctx2d.fill();
      ctx2d.lineWidth = 2;
      ctx2d.strokeStyle = "#faf8f3";
      ctx2d.stroke();
      ctx2d.font = `700 12px ${getComputedStyle(document.body).fontFamily}`;
      ctx2d.textAlign = "center";
      ctx2d.fillStyle = color;
      ctx2d.fillText(`${num(rt60)} ${t("sec")}`, x, baseY - 14);
    } else if (upTo > 0) {
      const x = timeToX(upTo, maxTime, plotW);
      ctx2d.beginPath();
      ctx2d.strokeStyle = hexA(color, 0.45);
      ctx2d.lineWidth = 1;
      ctx2d.moveTo(x, PAD.top);
      ctx2d.lineTo(x, PAD.top + plotH);
      ctx2d.stroke();
    }
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  function animateCurve(rt60, color, existingCurves, maxTime, isCurrent) {
    return new Promise(resolve => {
      const start = performance.now(), dur = animDur(rt60), span = curveSpan(rt60);
      function frame(now) {
        if (isCurrent && !isCurrent()) { resolve(); return; } // superseded by a newer tap
        const k = Math.min(1, (now - start) / 1000 / dur);
        const eased = 1 - Math.pow(1 - k, 2);
        drawChartFrame(maxTime, [...existingCurves, { rt60, upTo: span * eased, color }]);
        if (k < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  window.addEventListener("resize", () => {
    if ($("screen-compare").classList.contains("active") && currentScenario) {
      fitCanvas();
      const curves = [curvesState.before, curvesState.after].filter(Boolean);
      drawChartFrame(chartMaxTime(currentScenario), curves);
    }
  });

  $("sol-qr").innerHTML = QR.svg("https://rt60.feltouch.tr", { fill: "#4c5054" });
  applyLang();
  Fon.init();
  Fon.start();
})();
