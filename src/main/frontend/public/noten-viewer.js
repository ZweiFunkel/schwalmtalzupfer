/* Noten-Viewer: PDF anzeigen, zoomen, (Vorstand/Admin) beschriften, speichern, Versionen wiederherstellen.
 * Wird von Website (iframe), Web-App (iframe + postMessage) und Android (WebView) genutzt.
 * Parameter: ?key=<R2-Key>[&host=1]   host=1: Bytes kommen per postMessage vom Elternfenster.
 * Token: URL-Fragment #token=... (WebView) oder localStorage 'auth_token' (gleiche Origin) oder Session-Cookie. */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var KEY = params.get('key') || '';
  var HOST = params.get('host') === '1';
  var NAME = (KEY.split('/').pop() || 'Note').replace(/\.pdf$/i, '');
  var ZOOM_STORE = 'noten_zoom';
  var FINGER_STORE = 'noten_finger_draws';

  var token = '';
  try { token = new URLSearchParams(location.hash.slice(1)).get('token') || ''; } catch (e) {}
  if (token) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
  if (!token) { try { token = localStorage.getItem('auth_token') || ''; } catch (e) {} }

  function $(id) { return document.getElementById(id); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function toParent(msg) {
    msg = Object.assign({ source: 'noten-viewer' }, msg);
    try { if (window.ReactNativeWebView) { window.ReactNativeWebView.postMessage(JSON.stringify(msg)); return; } } catch (e) {}
    try { if (window.parent !== window) window.parent.postMessage(msg, location.origin); } catch (e) {}
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({}, opts.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(path, Object.assign({}, opts, { headers: headers, credentials: 'same-origin' }));
  }

  // ── Zustand ────────────────────────────────────────────────────────────
  var pdfjs = null, pdfDoc = null, pdfBytes = null;
  var pages = [];            // {wrap, canvas, ink, w1, h1 (Größe bei Scale 1), rendered, task}
  var zoomMode = store(ZOOM_STORE) || 'default';
  var canEdit = false, editing = false;
  var tool = 'pen', color = '#e11d48', sizeIdx = 1;
  var fingerDraws = store(FINGER_STORE) === '1';
  var marks = [], redo = [];
  var activeStroke = null, erasing = false;
  var renderGen = 0;

  var COLORS = ['#e11d48', '#2563eb', '#16a34a', '#111111', '#f59e0b'];
  // Strichbreite relativ zur Seitenbreite; Marker dicker
  var WIDTHS = { pen: [0.0014, 0.0028, 0.005], highlighter: [0.012, 0.02, 0.032] };
  var TEXT_SIZES = [0.016, 0.024, 0.036];
  var ZOOMS = [
    { id: 'default', label: 'Standard' },
    { id: 'fit', label: 'Seitenbreite (max.)' },
    { id: '1.25', label: '125 %' },
    { id: '1.5', label: '150 %' },
    { id: '2', label: '200 %' },
    { id: '3', label: '300 %' }
  ];

  // ── UI-Helfer ──────────────────────────────────────────────────────────
  var toastTimer = 0;
  function toast(msg, ms) {
    var t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.add('hidden'); }, ms || 2600);
  }
  function setState(text, isErr, withClose) {
    var s = $('state'); s.classList.remove('hidden');
    s.innerHTML = '';
    var d = document.createElement('div'); d.textContent = text; if (isErr) d.className = 'err'; s.appendChild(d);
    if (withClose) {
      var b = document.createElement('button'); b.textContent = '← Zurück'; b.onclick = close; s.appendChild(b);
    }
  }
  function hideState() { $('state').classList.add('hidden'); }

  function close() {
    if (editing && marks.length && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
    if (window.parent !== window || window.ReactNativeWebView) toParent({ type: 'close' });
    else if (history.length > 1) history.back();
    else window.close();
  }

  var barVisible = false;
  function showBar(v) {
    barVisible = v;
    $('bar').classList.toggle('off', !v);
    if (!v) closeSheets();
  }
  function closeSheets() {
    $('zoomSheet').classList.add('hidden'); $('historySheet').classList.add('hidden'); $('backdrop').classList.add('hidden');
  }
  function openSheet(id) {
    closeSheets(); $(id).classList.remove('hidden'); $('backdrop').classList.remove('hidden');
  }

  // Kein Kontextmenü (Rechtsklick / langes Drücken), keine Drag-Vorschau
  ['contextmenu', 'dragstart', 'selectstart'].forEach(function (ev) {
    document.addEventListener(ev, function (e) {
      if (e.target && e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
    }, { capture: true });
  });

  // ── PDF laden ──────────────────────────────────────────────────────────
  async function loadPdfjs() {
    if (pdfjs) return pdfjs;
    pdfjs = await import('/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
    return pdfjs;
  }

  async function fetchBytes() {
    var res = await api('/api/noten/preview?key=' + encodeURIComponent(KEY));
    if (res.status === 401 || res.status === 403) throw new Error('Bitte zuerst anmelden.');
    if (!res.ok) throw new Error('Note konnte nicht geladen werden (' + res.status + ').');
    return new Uint8Array(await res.arrayBuffer());
  }

  var hostBytesResolve = null;
  function waitForHostBytes() {
    return new Promise(function (resolve, reject) {
      hostBytesResolve = resolve;
      toParent({ type: 'ready' });
      setTimeout(function () { if (hostBytesResolve) { hostBytesResolve = null; reject(new Error('Keine Daten erhalten.')); } }, 20000);
    });
  }
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.source !== 'noten-host') return;
    if (e.data.type === 'bytes' && hostBytesResolve) {
      var r = hostBytesResolve; hostBytesResolve = null; r(new Uint8Array(e.data.bytes));
    }
  });

  async function openDocument(bytes) {
    await loadPdfjs();
    pdfBytes = bytes;
    if (pdfDoc) { try { pdfDoc.destroy(); } catch (e) {} }
    // Kopie übergeben: pdf.js gibt den Puffer an den Worker ab
    pdfDoc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, useSystemFonts: true }).promise;
    pages = [];
    $('pages').innerHTML = '';
    for (var i = 0; i < pdfDoc.numPages; i++) {
      var pg = await pdfDoc.getPage(i + 1);
      var vp = pg.getViewport({ scale: 1 });
      var wrap = document.createElement('div'); wrap.className = 'page';
      var canvas = document.createElement('canvas');
      var ink = document.createElement('canvas'); ink.className = 'ink';
      wrap.appendChild(canvas); wrap.appendChild(ink);
      $('pages').appendChild(wrap);
      var entry = { index: i, page: pg, wrap: wrap, canvas: canvas, ink: ink, w1: vp.width, h1: vp.height, rendered: 0, cssW: 0, cssH: 0 };
      pages.push(entry);
      bindInk(entry);
    }
    applyZoom(true);
  }

  // ── Zoom ───────────────────────────────────────────────────────────────
  function baseScaleFor(entry) {
    var availW = $('scroller').clientWidth;
    if (zoomMode === 'fit') return availW / entry.w1;
    // Standard: wie bisher - auf Breite begrenzt (max. 820 px) damit es am PC nicht riesig wird
    return Math.min(availW, 820) / entry.w1;
  }
  function zoomFactor() {
    if (zoomMode === 'default' || zoomMode === 'fit') return 1;
    var f = parseFloat(zoomMode); return isFinite(f) && f > 0 ? f : 1;
  }
  function zoomLabel() {
    for (var i = 0; i < ZOOMS.length; i++) if (ZOOMS[i].id === zoomMode) return ZOOMS[i].label.replace(' (max.)', '');
    return 'Standard';
  }

  function applyZoom(initial) {
    // Mittelpunkt der Ansicht beibehalten
    var sc = $('scroller');
    var relX = sc.scrollWidth > sc.clientWidth ? (sc.scrollLeft + sc.clientWidth / 2) / sc.scrollWidth : 0.5;
    var relY = sc.scrollHeight ? (sc.scrollTop + sc.clientHeight / 2) / sc.scrollHeight : 0;
    pages.forEach(function (p) {
      var s = baseScaleFor(p) * zoomFactor();
      p.cssW = Math.round(p.w1 * s); p.cssH = Math.round(p.h1 * s);
      p.wrap.style.width = p.cssW + 'px'; p.wrap.style.height = p.cssH + 'px';
      p.rendered = 0;
    });
    $('zoomLabel').textContent = zoomLabel();
    renderGen++;
    renderVisible();
    if (!initial) {
      sc.scrollLeft = Math.max(0, relX * sc.scrollWidth - sc.clientWidth / 2);
      sc.scrollTop = Math.max(0, relY * sc.scrollHeight - sc.clientHeight / 2);
    }
  }
  function setZoom(id) {
    zoomMode = id; store(ZOOM_STORE, id);
    applyZoom(false);
    buildZoomList();
  }
  function buildZoomList() {
    var list = $('zoomList'); list.innerHTML = '';
    ZOOMS.forEach(function (z) {
      var b = document.createElement('button'); b.className = 'item' + (z.id === zoomMode ? ' on' : '');
      b.textContent = z.label + (z.id === zoomMode ? '  ✓' : '');
      b.onclick = function () { setZoom(z.id); closeSheets(); };
      list.appendChild(b);
    });
  }

  // ── Rendering (nur sichtbare Seiten, scharf für Gerätepixel) ───────────
  var renderQueued = false;
  function renderVisible() {
    if (renderQueued) return; renderQueued = true;
    requestAnimationFrame(function () { renderQueued = false; doRenderVisible(); });
  }
  async function doRenderVisible() {
    var gen = renderGen;
    var sc = $('scroller'), top = sc.scrollTop, bottom = top + sc.clientHeight;
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i];
      var pt = p.wrap.offsetTop, pb = pt + p.cssH;
      var near = pb > top - sc.clientHeight && pt < bottom + sc.clientHeight;
      if (!near) continue;
      if (p.rendered === p.cssW) continue;
      p.rendered = p.cssW;
      await renderPage(p, gen);
      if (gen !== renderGen) return;
    }
  }
  async function renderPage(p, gen) {
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    var scale = (p.cssW / p.w1) * dpr;
    // Canvas-Größe begrenzen (mobile Browser)
    var maxPx = 16000000;
    if (p.w1 * scale * p.h1 * scale > maxPx) scale = Math.sqrt(maxPx / (p.w1 * p.h1));
    var vp = p.page.getViewport({ scale: scale });
    var off = document.createElement('canvas'); off.width = Math.floor(vp.width); off.height = Math.floor(vp.height);
    try {
      await p.page.render({ canvasContext: off.getContext('2d'), viewport: vp }).promise;
    } catch (e) { return; }
    if (gen !== renderGen) return;
    p.canvas.width = off.width; p.canvas.height = off.height;
    p.canvas.style.width = p.cssW + 'px'; p.canvas.style.height = p.cssH + 'px';
    p.canvas.getContext('2d').drawImage(off, 0, 0);
    p.ink.width = off.width; p.ink.height = off.height;
    p.ink.style.width = p.cssW + 'px'; p.ink.style.height = p.cssH + 'px';
    redrawInk(p);
  }

  // ── Ink (Anzeige der Markierungen) ─────────────────────────────────────
  function drawMark(ctx, m, W, H) {
    if (m.type === 'text') {
      var fs = m.size * W;
      ctx.save(); ctx.fillStyle = m.color; ctx.font = fs + 'px Helvetica, Arial, sans-serif'; ctx.textBaseline = 'alphabetic';
      var lines = String(m.text).split(/\r?\n/);
      // PDF-Seite: m.y = Grundlinie der ersten Zeile
      for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], m.x * W, m.y * H + i * fs * 1.2);
      ctx.restore(); return;
    }
    var pts = m.points; if (!pts || !pts.length) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = m.color; ctx.lineWidth = Math.max(1, m.width * W);
    ctx.globalAlpha = m.opacity || 1;
    if (m.type === 'highlighter') ctx.globalCompositeOperation = 'multiply';
    ctx.beginPath(); ctx.moveTo(pts[0][0] * W, pts[0][1] * H);
    if (pts.length === 1) ctx.lineTo(pts[0][0] * W, pts[0][1] * H);
    for (var j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0] * W, pts[j][1] * H);
    ctx.stroke(); ctx.restore();
  }
  function redrawInk(p) {
    var ctx = p.ink.getContext('2d'); ctx.clearRect(0, 0, p.ink.width, p.ink.height);
    for (var i = 0; i < marks.length; i++) if (marks[i].page === p.index) drawMark(ctx, marks[i], p.ink.width, p.ink.height);
    if (activeStroke && activeStroke.page === p.index) drawMark(ctx, activeStroke, p.ink.width, p.ink.height);
  }
  function redrawAll() { pages.forEach(redrawInk); updateUndoButtons(); }

  // ── Zeichnen: Pointer Events (Maus, Stift, Finger) ─────────────────────
  var touchScroll = null; // manuelles Scrollen mit dem Finger im Bearbeitungsmodus
  function pointerPos(entry, e) {
    var r = entry.ink.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  }
  function bindInk(entry) {
    var ink = entry.ink;
    ink.addEventListener('pointerdown', function (e) {
      if (!editing) return;
      if (e.pointerType === 'touch' && !fingerDraws) {
        // Finger scrollt, Stift/Maus zeichnen
        var sc = $('scroller');
        touchScroll = { id: e.pointerId, x: e.clientX, y: e.clientY, sl: sc.scrollLeft, st: sc.scrollTop };
        ink.setPointerCapture(e.pointerId); return;
      }
      if (e.button !== undefined && e.button > 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      var pos = pointerPos(entry, e);
      if (tool === 'text') { startTextEdit(entry, pos); return; }
      if (tool === 'eraser') { erasing = true; ink.setPointerCapture(e.pointerId); eraseAt(entry, pos); return; }
      var hi = tool === 'highlighter';
      activeStroke = {
        type: tool, page: entry.index, color: color, opacity: hi ? 0.35 : 1,
        width: WIDTHS[hi ? 'highlighter' : 'pen'][sizeIdx], points: [pos]
      };
      ink.setPointerCapture(e.pointerId);
      redrawInk(entry);
    });
    ink.addEventListener('pointermove', function (e) {
      if (touchScroll && touchScroll.id === e.pointerId) {
        var sc = $('scroller');
        sc.scrollLeft = touchScroll.sl - (e.clientX - touchScroll.x);
        sc.scrollTop = touchScroll.st - (e.clientY - touchScroll.y);
        return;
      }
      if (!editing) return;
      if (erasing) { eraseAt(entry, pointerPos(entry, e)); return; }
      if (!activeStroke || activeStroke.page !== entry.index) return;
      e.preventDefault();
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      if (!evs.length) evs = [e];
      for (var i = 0; i < evs.length; i++) {
        var pos = pointerPos(entry, evs[i]), last = activeStroke.points[activeStroke.points.length - 1];
        if (Math.abs(pos[0] - last[0]) + Math.abs(pos[1] - last[1]) > 0.0004) activeStroke.points.push(pos);
      }
      redrawInk(entry);
    });
    function end(e) {
      if (touchScroll && touchScroll.id === e.pointerId) { touchScroll = null; return; }
      if (erasing) { erasing = false; return; }
      if (!activeStroke || activeStroke.page !== entry.index) return;
      marks.push(activeStroke); redo = []; activeStroke = null;
      redrawAll();
    }
    ink.addEventListener('pointerup', end);
    ink.addEventListener('pointercancel', end);
  }

  function eraseAt(entry, pos) {
    var W = entry.ink.width, H = entry.ink.height, r = 14 / entry.cssW; // ~14 px Radius
    var removed = false;
    for (var i = marks.length - 1; i >= 0; i--) {
      var m = marks[i]; if (m.page !== entry.index) continue;
      var hit = false;
      if (m.type === 'text') {
        hit = Math.abs(pos[0] - m.x) < 0.12 && pos[1] > m.y - m.size * 1.2 * (W / H) && pos[1] < m.y + 0.03;
      } else {
        var tol = r + m.width / 2;
        for (var j = 0; j < m.points.length && !hit; j++) {
          var dx = (pos[0] - m.points[j][0]), dy = (pos[1] - m.points[j][1]) * (H / W);
          if (Math.sqrt(dx * dx + dy * dy) < tol) hit = true;
        }
      }
      if (hit) { marks.splice(i, 1); removed = true; break; }
    }
    if (removed) { redo = []; redrawAll(); }
  }

  function startTextEdit(entry, pos) {
    var ta = document.createElement('textarea'); ta.className = 'txt';
    var fs = TEXT_SIZES[sizeIdx] * entry.cssW;
    ta.style.left = pos[0] * entry.cssW + 'px'; ta.style.top = (pos[1] * entry.cssH - fs) + 'px';
    ta.style.fontSize = fs + 'px'; ta.style.color = color; ta.rows = 1;
    entry.wrap.appendChild(ta);
    setTimeout(function () { ta.focus(); }, 0);
    var done = false;
    function commit() {
      if (done) return; done = true;
      var text = ta.value.replace(/\s+$/, '');
      ta.remove();
      if (text) { marks.push({ type: 'text', page: entry.index, color: color, opacity: 1, width: 0, points: null, x: pos[0], y: pos[1], text: text, size: TEXT_SIZES[sizeIdx] }); redo = []; redrawAll(); }
    }
    ta.addEventListener('blur', commit);
    ta.addEventListener('keydown', function (e) { if (e.key === 'Escape') { ta.value = ''; ta.blur(); } });
  }

  // ── Bearbeiten, Speichern ──────────────────────────────────────────────
  function updateUndoButtons() { $('btnUndo').disabled = !marks.length; $('btnRedo').disabled = !redo.length; }
  function setEditing(on) {
    editing = on;
    document.body.classList.toggle('editing', on);
    $('editbar').classList.toggle('hidden', !on);
    $('btnEdit').classList.toggle('on', on);
    if (on) showBar(true); // Zoom/Zurück bleiben im Bearbeitungsmodus erreichbar
    updateUndoButtons();
  }
  function setTool(t) {
    tool = t;
    document.body.classList.toggle('tool-text', t === 'text');
    document.querySelectorAll('[data-tool]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tool') === t); });
  }
  function buildColors() {
    var c = $('colors'); c.innerHTML = '';
    COLORS.forEach(function (col) {
      var b = document.createElement('button'); b.className = 'sw' + (col === color ? ' on' : ''); b.style.background = col;
      b.setAttribute('aria-label', 'Farbe ' + col);
      b.onclick = function () { color = col; buildColors(); };
      c.appendChild(b);
    });
  }

  async function save() {
    if (!marks.length) { toast('Keine Änderungen.'); return; }
    var btn = $('btnSave'); btn.disabled = true; btn.textContent = 'Speichere…';
    try {
      var res = await api('/api/noten/annotate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: KEY, marks: marks })
      });
      var data = {}; try { data = await res.json(); } catch (e) {}
      if (!res.ok) throw new Error(data.error || ('Fehler ' + res.status));
      marks = []; redo = [];
      setEditing(false);
      toast('Gespeichert – vorige Version wurde gesichert.');
      await reloadDocument();
      toParent({ type: 'saved' });
    } catch (e) {
      toast('Speichern fehlgeschlagen: ' + e.message, 5000);
    } finally { btn.disabled = false; btn.textContent = 'Speichern'; }
  }

  async function reloadDocument() {
    var sc = $('scroller'), st = sc.scrollTop, sl = sc.scrollLeft;
    var bytes = await fetchBytes();
    await openDocument(bytes);
    sc.scrollTop = st; sc.scrollLeft = sl;
  }

  // ── Versionen ──────────────────────────────────────────────────────────
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return iso; }
  }
  async function openHistory() {
    openSheet('historySheet');
    var list = $('historyList'); list.textContent = 'Lade…';
    try {
      var res = await api('/api/noten/versions?key=' + encodeURIComponent(KEY));
      if (!res.ok) throw new Error('Fehler ' + res.status);
      var vs = await res.json();
      list.innerHTML = '';
      if (!vs.length) { list.textContent = 'Noch keine früheren Versionen.'; return; }
      vs.forEach(function (v) {
        var b = document.createElement('button'); b.className = 'item';
        var l = document.createElement('div'); l.textContent = fmtDate(v.savedAt);
        var m = document.createElement('div'); m.className = 'meta'; m.textContent = (v.savedBy ? v.savedBy + ' · ' : '') + Math.round(v.size / 1024) + ' KB';
        l.appendChild(m); b.appendChild(l);
        var r = document.createElement('span'); r.textContent = 'Wiederherstellen'; b.appendChild(r);
        b.onclick = function () { restore(v); };
        list.appendChild(b);
      });
    } catch (e) { list.textContent = 'Versionen konnten nicht geladen werden.'; }
  }
  async function restore(v) {
    if (!confirm('Version vom ' + fmtDate(v.savedAt) + ' wiederherstellen? Der aktuelle Stand wird vorher gesichert.')) return;
    try {
      var res = await api('/api/noten/restore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: KEY, versionKey: v.versionKey })
      });
      if (!res.ok) { var d = {}; try { d = await res.json(); } catch (e) {} throw new Error(d.error || ('Fehler ' + res.status)); }
      closeSheets(); toast('Version wiederhergestellt.');
      await reloadDocument(); toParent({ type: 'saved' });
    } catch (e) { toast('Wiederherstellen fehlgeschlagen: ' + e.message, 5000); }
  }

  // ── Events ─────────────────────────────────────────────────────────────
  function bind() {
    $('title').textContent = NAME; document.title = NAME;
    $('btnBack').onclick = close;
    $('btnZoom').onclick = function () { buildZoomList(); openSheet('zoomSheet'); };
    $('zoomBack').onclick = closeSheets; $('historyBack').onclick = closeSheets;
    $('backdrop').onclick = closeSheets;
    $('btnHistory').onclick = openHistory;
    $('btnEdit').onclick = function () { if (editing) { if (!marks.length || confirm('Ungespeicherte Änderungen verwerfen?')) { marks = []; redo = []; setEditing(false); redrawAll(); } } else { setEditing(true); } };
    $('btnCancel').onclick = function () { if (!marks.length || confirm('Änderungen verwerfen?')) { marks = []; redo = []; setEditing(false); redrawAll(); } };
    $('btnSave').onclick = save;
    $('btnUndo').onclick = function () { var m = marks.pop(); if (m) { redo.push(m); redrawAll(); } };
    $('btnRedo').onclick = function () { var m = redo.pop(); if (m) { marks.push(m); redrawAll(); } };
    var fb = $('btnFinger'); fb.classList.toggle('on', fingerDraws);
    fb.onclick = function () { fingerDraws = !fingerDraws; store(FINGER_STORE, fingerDraws ? '1' : '0'); fb.classList.toggle('on', fingerDraws); toast(fingerDraws ? 'Finger zeichnet.' : 'Finger scrollt, Stift/Maus zeichnen.'); };
    document.querySelectorAll('[data-tool]').forEach(function (b) { b.onclick = function () { setTool(b.getAttribute('data-tool')); }; });
    document.querySelectorAll('[data-size]').forEach(function (b) {
      b.onclick = function () { sizeIdx = parseInt(b.getAttribute('data-size'), 10);
        document.querySelectorAll('[data-size]').forEach(function (x) { x.classList.toggle('on', x === b); }); };
    });
    buildColors();

    var sc = $('scroller');
    sc.addEventListener('scroll', renderVisible, { passive: true });
    window.addEventListener('resize', function () { if (pages.length) applyZoom(false); });
    // Tippen auf die Seite blendet die Leiste ein/aus (nicht beim Zeichnen/Scrollen)
    var down = null;
    sc.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, t: Date.now(), st: sc.scrollTop, sl: sc.scrollLeft }; });
    sc.addEventListener('pointerup', function (e) {
      if (!down || editing) { down = null; return; }
      var moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
      var scrolled = Math.abs(sc.scrollTop - down.st) + Math.abs(sc.scrollLeft - down.sl);
      var quick = Date.now() - down.t < 450;
      down = null;
      if (moved < 8 && scrolled < 4 && quick) showBar(!barVisible);
    });
    // Im Bearbeitungsmodus: Leiste per Doppeltipp außerhalb der Seite? -> einfach Button oben links
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (!$('zoomSheet').classList.contains('hidden') || !$('historySheet').classList.contains('hidden')) closeSheets(); else if (barVisible) showBar(false); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && editing) { e.preventDefault(); $('btnUndo').click(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && editing) { e.preventDefault(); save(); }
    });
    window.addEventListener('beforeunload', function (e) { if (editing && marks.length) { e.preventDefault(); e.returnValue = ''; } });
  }

  async function detectRole() {
    try {
      var res = await api('/api/auth/me');
      if (!res.ok) return;
      var me = await res.json();
      var roles = [].concat(me.role || [], me.roles || [], me.authorities || []).map(function (r) { return String(r.authority || r); });
      canEdit = roles.indexOf('ROLE_ADMIN') >= 0 || roles.indexOf('ROLE_BOARD') >= 0;
    } catch (e) {}
    $('btnEdit').classList.toggle('hidden', !canEdit);
    $('btnHistory').classList.toggle('hidden', !canEdit);
  }

  async function init() {
    bind();
    if (!KEY || !/\.pdf$/i.test(KEY)) { setState('Keine PDF-Note angegeben.', true, true); return; }
    // Leiste anfangs kurz zeigen, damit man sie findet
    detectRole();
    try {
      var bytes = HOST ? await waitForHostBytes() : await fetchBytes();
      await openDocument(bytes);
      hideState();
      showBar(true); setTimeout(function () { if (!editing && $('zoomSheet').classList.contains('hidden')) showBar(false); }, 2500);
    } catch (e) {
      setState(e && e.message ? e.message : 'PDF konnte nicht angezeigt werden.', true, true);
    }
  }
  init();
})();
