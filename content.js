/* ═══════════════════════════════════════════════════════════════
   SCRIBBLE- UAT EXTENSION — CONTENT SCRIPT
   Author: Anil James
   LinkedIn: https://www.linkedin.com/in/aniljames7/
   Iconography: Apple SF Symbols & Lucide Precision Vector Set
 ═══════════════════════════════════════════════════════════════ */

(() => {
  if (window.__MARKER_EXT_INJECTED__) return;
  window.__MARKER_EXT_INJECTED__ = true;

  // ── 1. STATE & VARS ──────────────────────────────────────────
  const state = {
    visible: false,
    activeTool: 'select',
    color: '#007aff',
    brushSize: 3,
    annotations: [],
    history: [],
    redoStack: [],
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentPath: [],
    pendingTextPos: null,
    pendingInspectedElement: null,
    activeBucketFilter: 'all',
    buckets: [
      { id: 'ui', name: 'UI Bug', color: '#ff3b30' },
      { id: 'functional', name: 'Functional', color: '#ff9500' },
      { id: 'responsive', name: 'Responsive', color: '#007aff' },
      { id: 'content', name: 'Copy / Content', color: '#34c759' },
      { id: 'perf', name: 'Performance', color: '#af52de' },
      { id: 'a11y', name: 'Accessibility', color: '#5ac8fa' }
    ],
    selectedBucket: 'ui',
    selectedSeverity: 'high'
  };

  let canvas, ctx;
  let container, toolbar, drawer, modalBackdrop, toastEl;
  let undoBtn, redoBtn, clearBtn;
  let elementHighlightBox, elementBadge;

  // ── 2. SERVICE WORKER MESSAGES ──────────────────────────────
  chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    if (req.action === 'PING') {
      sendResponse({ status: 'PONG' });
      return;
    }
    if (req.action === 'TOGGLE_TOOLBAR') {
      toggleExtensionVisibility();
    }
  });

  function toggleExtensionVisibility() {
    state.visible = !state.visible;
    if (state.visible) {
      if (!container) initUI();
      container.style.display = 'block';
      canvas.style.display = 'block';
      resizeCanvas();
      showToast('Scribble- UAT Extension Active (Browse Mode)');
    } else {
      if (container) container.style.display = 'none';
      if (canvas) canvas.style.display = 'none';
      if (drawer) drawer.classList.add('hidden');
      if (modalBackdrop) modalBackdrop.classList.remove('show');
      disableElementInspector();
    }
  }

  // ── 3. INIT DOM & MINIMAL APPLE TOOLBAR WITH CRISP ICONOGRAPHY ─
  function initUI() {
    canvas = document.createElement('canvas');
    canvas.id = 'marker-ext-canvas';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');

    elementHighlightBox = document.createElement('div');
    elementHighlightBox.id = 'marker-ext-element-highlight';
    elementBadge = document.createElement('div');
    elementBadge.id = 'marker-ext-element-badge';
    elementHighlightBox.appendChild(elementBadge);
    document.body.appendChild(elementHighlightBox);

    container = document.createElement('div');
    container.id = 'marker-ext-container';
    document.body.appendChild(container);

    container.innerHTML = `
      <!-- Minimal Apple Floating Dock -->
      <div id="marker-ext-toolbar" role="toolbar" aria-label="Scribble- UAT Extension Dock">
        <div class="mk-tool-group">
          <button class="mk-btn active" data-tool="select" title="Browse / Pan Mode (Esc)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7 18 3-7 7-3L3 3z"/></svg>
            <span>Browse</span>
          </button>
          <button class="mk-btn" data-tool="inspect" title="Inspect DOM Element">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="1" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="1" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="23" y2="12"/></svg>
          </button>
        </div>
        <div class="mk-sep"></div>

        <!-- Annotation Tools -->
        <div class="mk-tool-group">
          <button class="mk-btn" data-tool="pen" title="Pen Tool">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          </button>
          <button class="mk-btn" data-tool="highlighter" title="Highlighter Tool">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
          </button>
          <button class="mk-btn" data-tool="arrow" title="Arrow Tool">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
          <button class="mk-btn" data-tool="rect" title="Rectangle Tool">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>
          </button>
          <button class="mk-btn" data-tool="circle" title="Circle Tool">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>
          </button>
          <button class="mk-btn" data-tool="line" title="Line Tool">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="20" y2="4"/></svg>
          </button>
          <button class="mk-btn" data-tool="text" title="Pin Labeled Note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="13" y2="13"/></svg>
            <span>Note</span>
          </button>
          <button class="mk-btn" data-tool="blur" title="Blur Redact Tool">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          </button>
          <button class="mk-btn" data-tool="eraser" title="Eraser Tool">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/></svg>
          </button>
        </div>
        <div class="mk-sep"></div>

        <!-- Color & Size -->
        <div class="mk-picker-wrap">
          <input type="color" id="marker-ext-color" value="${state.color}" title="Stroke Color">
          <input type="range" id="marker-ext-size" min="1" max="30" value="${state.brushSize}" title="Stroke Size">
        </div>
        <div class="mk-sep"></div>

        <!-- Undo, Redo, Clear All, Devices & Exports -->
        <div class="mk-tool-group">
          <button class="mk-btn" id="mk-undo-btn" title="Undo (Ctrl+Z)" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>
          </button>
          <button class="mk-btn" id="mk-redo-btn" title="Redo (Ctrl+Y)" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13"/></svg>
          </button>
          <button class="mk-btn danger" id="mk-clear-btn" title="Clear All Annotations and Markers">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            <span>Clear All</span>
          </button>
          
          <button class="mk-btn" id="mk-log-btn" title="UAT Log Drawer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
          </button>
          
          <button class="mk-btn" id="mk-export-png" title="Screenshot PNG">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </button>
          <button class="mk-btn primary" id="mk-export-pdf" title="Export PDF Report">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>
          </button>
        </div>
      </div>

      <!-- Log Drawer -->
      <div id="marker-ext-log-drawer" class="hidden">
        <div class="mk-drawer-head">
          <div class="mk-drawer-title">📋 UAT Issue Tracker</div>
          <button class="mk-btn" id="mk-close-drawer">✕</button>
        </div>
        
        <div class="mk-bucket-filter-bar">
          <button class="mk-bfilter-btn active" data-bfilter="all">All</button>
          <button class="mk-bfilter-btn" data-bfilter="ui">UI Bug</button>
          <button class="mk-bfilter-btn" data-bfilter="functional">Functional</button>
          <button class="mk-bfilter-btn" data-bfilter="responsive">Responsive</button>
          <button class="mk-bfilter-btn" data-bfilter="content">Content</button>
          <button class="mk-bfilter-btn" data-bfilter="perf">Perf</button>
          <button class="mk-bfilter-btn" data-bfilter="a11y">A11y</button>
        </div>

        <div class="mk-drawer-body" id="mk-drawer-list">
          <div style="text-align:center; color:#94a3b8; padding:20px; font-size:12px; font-weight:500;">
            No UAT issues reported yet. Click <b>Note</b> or <b>Inspect</b> to drop feedback!
          </div>
        </div>

        <div class="mk-drawer-foot">
          <span>Scribble- UAT Extension v1.0</span>
        </div>
      </div>

      <!-- Note Modal -->
      <div id="marker-ext-modal-backdrop">
        <div class="mk-modal">
          <div class="mk-modal-title">📌 Drop Labeled UAT Feedback</div>
          
          <div id="mk-modal-element-info" style="display:none; font-family:monospace; font-size:10px; background:rgba(0,122,255,0.08); color:#007aff; padding:4px 8px; border-radius:6px; border:1px solid rgba(0,122,255,0.2);"></div>

          <div class="mk-form-group">
            <div class="mk-form-label">Category Bucket</div>
            <div class="mk-chip-grid" id="mk-bucket-grid"></div>
          </div>

          <div class="mk-form-group">
            <div class="mk-form-label">Severity Level</div>
            <div class="mk-chip-grid" id="mk-sev-grid">
              <div class="mk-chip" data-sev="critical">🔴 Critical</div>
              <div class="mk-chip selected" data-sev="high">🟠 High</div>
              <div class="mk-chip" data-sev="medium">🟡 Medium</div>
              <div class="mk-chip" data-sev="low">🟢 Low</div>
            </div>
          </div>

          <div class="mk-form-group">
            <div class="mk-form-label">Description Note</div>
            <textarea class="mk-textarea" id="mk-note-text" placeholder="Describe the UI bug or responsive feedback..."></textarea>
          </div>

          <div style="display:flex; gap:8px; justify-content:flex-end;">
            <button class="mk-btn" id="mk-modal-cancel">Cancel</button>
            <button class="mk-btn primary" id="mk-modal-confirm">Place Note</button>
          </div>
        </div>
      </div>

      <!-- Toast -->
      <div id="marker-ext-toast"></div>
    `;

    // References
    toolbar = container.querySelector('#marker-ext-toolbar');
    drawer = container.querySelector('#marker-ext-log-drawer');
    modalBackdrop = container.querySelector('#marker-ext-modal-backdrop');
    toastEl = container.querySelector('#marker-ext-toast');
    undoBtn = container.querySelector('#mk-undo-btn');
    redoBtn = container.querySelector('#mk-redo-btn');
    clearBtn = container.querySelector('#mk-clear-btn');

    setupEvents();
    renderBucketChips();
    updateUndoRedoState();
  }

  // ── 4. EVENT LISTENERS ───────────────────────────────────────
  function setupEvents() {
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('scroll', redrawCanvas);

    toolbar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tool]');
      if (!btn) return;
      const tool = btn.getAttribute('data-tool');
      setTool(tool);
    });

    clearBtn.addEventListener('click', clearAllAnnotations);

    container.querySelector('.mk-bucket-filter-bar').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-bfilter]');
      if (!btn) return;
      container.querySelectorAll('.mk-bfilter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeBucketFilter = btn.getAttribute('data-bfilter');
      updateLogDrawer();
    });

    container.querySelector('#marker-ext-color').addEventListener('input', (e) => state.color = e.target.value);
    container.querySelector('#marker-ext-size').addEventListener('input', (e) => state.brushSize = parseInt(e.target.value, 10));

    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    container.querySelector('#mk-log-btn').addEventListener('click', () => drawer.classList.toggle('hidden'));
    container.querySelector('#mk-close-drawer').addEventListener('click', () => drawer.classList.add('hidden'));

    container.querySelector('#mk-export-png').addEventListener('click', capturePNG);
    container.querySelector('#mk-export-pdf').addEventListener('click', exportPDF);

    container.querySelector('#mk-modal-cancel').addEventListener('click', closeModal);
    container.querySelector('#mk-modal-confirm').addEventListener('click', commitTextAnnotation);

    container.querySelector('#mk-sev-grid').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-sev]');
      if (!chip) return;
      container.querySelectorAll('#mk-sev-grid .mk-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      state.selectedSeverity = chip.getAttribute('data-sev');
    });

    container.querySelector('#mk-bucket-grid').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-bucket]');
      if (!chip) return;
      container.querySelectorAll('#mk-bucket-grid .mk-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      state.selectedBucket = chip.getAttribute('data-bucket');
    });

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);

    window.addEventListener('keydown', (e) => {
      if (!state.visible || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') setTool('select');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    });
  }

  function setTool(tool) {
    if (state.activeTool === tool && tool !== 'select') {
      state.activeTool = 'select';
    } else {
      state.activeTool = tool;
    }

    toolbar.querySelectorAll('[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === state.activeTool);
    });

    if (state.activeTool === 'inspect') {
      enableElementInspector();
    } else {
      disableElementInspector();
    }

    if (state.activeTool === 'select' || state.activeTool === 'inspect') {
      canvas.classList.remove('active');
    } else {
      canvas.classList.add('active');
    }
  }

  // ── 5. DOM ELEMENT INSPECTOR TOOL ────────────────────────────
  function enableElementInspector() {
    window.addEventListener('mousemove', onInspectorMouseMove, true);
    window.addEventListener('click', onInspectorClick, true);
  }

  function disableElementInspector() {
    window.removeEventListener('mousemove', onInspectorMouseMove, true);
    window.removeEventListener('click', onInspectorClick, true);
    if (elementHighlightBox) elementHighlightBox.style.display = 'none';
  }

  function onInspectorMouseMove(e) {
    if (state.activeTool !== 'inspect') return;
    const target = e.target;
    if (!target || target.closest('#marker-ext-container') || target.id === 'marker-ext-canvas') return;

    const rect = target.getBoundingClientRect();
    elementHighlightBox.style.top = rect.top + 'px';
    elementHighlightBox.style.left = rect.left + 'px';
    elementHighlightBox.style.width = rect.width + 'px';
    elementHighlightBox.style.height = rect.height + 'px';
    elementHighlightBox.style.display = 'block';

    const tag = target.tagName.toLowerCase();
    const id = target.id ? `#${target.id}` : '';
    const cls = target.className && typeof target.className === 'string' ? `.${target.className.trim().split(/\s+/).join('.')}` : '';
    const dim = `${Math.round(rect.width)}×${Math.round(rect.height)}px`;

    elementBadge.textContent = `<${tag}${id}${cls}> | ${dim}`;
  }

  function onInspectorClick(e) {
    if (state.activeTool !== 'inspect') return;
    const target = e.target;
    if (!target || target.closest('#marker-ext-container') || target.id === 'marker-ext-canvas') return;

    e.preventDefault();
    e.stopPropagation();

    const rect = target.getBoundingClientRect();
    const tag = target.tagName.toLowerCase();
    const id = target.id ? `#${target.id}` : '';
    const cls = target.className && typeof target.className === 'string' ? `.${target.className.trim().split(/\s+/).join('.')}` : '';

    state.pendingInspectedElement = `<${tag}${id}${cls}> (${Math.round(rect.width)}×${Math.round(rect.height)}px)`;
    state.pendingTextPos = { x: rect.left + rect.width / 2, y: rect.top };

    openModal();
    setTool('select');
  }

  function clearAllAnnotations() {
    if (state.annotations.length === 0) {
      showToast('No annotations to clear');
      return;
    }
    saveState();
    state.annotations = [];
    state.currentPath = [];
    redrawCanvas();
    updateLogDrawer();
    showToast('All annotations and markers cleared! (Ctrl+Z to undo)');
  }

  // ── 5.1 IN-PAGE RESPONSIVE VIEWPORT ENGINE (DEVTOOLS MODE) ─────
  function applyDeviceViewport(w, h) {
    let tagEl = document.getElementById('marker-ext-viewport-tag');
    let stageBg = document.getElementById('marker-ext-stage-bg');
    let styleOverride = document.getElementById('marker-ext-viewport-style');

    if (w === 'full' || h === 'full') {
      if (tagEl) tagEl.style.display = 'none';
      if (stageBg) stageBg.style.display = 'none';
      if (styleOverride) styleOverride.remove();
      document.documentElement.classList.remove('marker-ext-device-mode');
      document.body.classList.remove('marker-ext-device-mode');
      showToast('Resetting to full viewport view');
      resizeCanvas();
      window.dispatchEvent(new Event('resize'));
      return;
    }

    const width = typeof w === 'number' ? w : parseInt(w, 10);
    const height = typeof h === 'number' ? h : parseInt(h, 10);

    // Create dark DevTools stage background behind device frame
    if (!stageBg) {
      stageBg = document.createElement('div');
      stageBg.id = 'marker-ext-stage-bg';
      document.body.appendChild(stageBg);
    }
    stageBg.style.display = 'block';

    // Create or update viewport status badge
    if (!tagEl) {
      tagEl = document.createElement('div');
      tagEl.id = 'marker-ext-viewport-tag';
      document.body.appendChild(tagEl);
    }
    tagEl.style.display = 'block';
    tagEl.innerHTML = `<span class="mk-vp-tag">📱 In-Page Device Viewport: ${width}×${height}px</span>`;

    // Inject responsive layout override style block
    if (!styleOverride) {
      styleOverride = document.createElement('style');
      styleOverride.id = 'marker-ext-viewport-style';
      document.head.appendChild(styleOverride);
    }

    // Set centered device chassis on document element
    document.documentElement.classList.add('marker-ext-device-mode');
    document.body.classList.add('marker-ext-device-mode');

    styleOverride.textContent = `
      html.marker-ext-device-mode {
        width: ${width}px !important;
        max-width: ${width}px !important;
        min-width: ${width}px !important;
        height: ${height}px !important;
        max-height: ${height}px !important;
        margin: 68px auto 20px auto !important;
        border: 10px solid #1e293b !important;
        border-radius: 24px !important;
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.1) !important;
        position: relative !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        background: #ffffff !important;
        transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      body.marker-ext-device-mode {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 100% !important;
        margin: 0 !important;
        overflow-x: hidden !important;
        background: #ffffff !important;
      }
      body.marker-ext-device-mode > *:not(#marker-ext-container):not(#marker-ext-canvas):not(#marker-ext-element-highlight):not(#marker-ext-viewport-tag):not(#marker-ext-stage-bg) {
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
    `;

    // Dispatch synthetic resize event so canvas and site scripts adjust
    window.dispatchEvent(new Event('resize'));
    resizeCanvas();
  }

  // ── 6. CANVAS DRAWING ENGINE ─────────────────────────────────
  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    redrawCanvas();
  }

  function onMouseDown(e) {
    if (state.activeTool === 'select' || state.activeTool === 'inspect') return;
    state.isDrawing = true;
    state.startX = e.clientX;
    state.startY = e.clientY;

    if (state.activeTool === 'pen' || state.activeTool === 'highlighter') {
      state.currentPath = [{ x: state.startX, y: state.startY }];
    } else if (state.activeTool === 'text') {
      state.isDrawing = false;
      state.pendingTextPos = { x: e.clientX, y: e.clientY };
      state.pendingInspectedElement = null;
      openModal();
    }
  }

  function onMouseMove(e) {
    if (!state.isDrawing) return;
    const curX = e.clientX;
    const curY = e.clientY;

    if (state.activeTool === 'pen' || state.activeTool === 'highlighter') {
      state.currentPath.push({ x: curX, y: curY });
      redrawCanvas();
      drawStroke(state.currentPath, state.color, state.brushSize, state.activeTool === 'highlighter');
    } else if (state.activeTool === 'eraser') {
      eraseAt(curX, curY);
    } else {
      redrawCanvas();
      drawPreviewShape(state.activeTool, state.startX, state.startY, curX, curY);
    }
  }

  function onMouseUp(e) {
    if (!state.isDrawing) return;
    state.isDrawing = false;
    const endX = e.clientX;
    const endY = e.clientY;

    let op = null;
    if (state.activeTool === 'pen' || state.activeTool === 'highlighter') {
      if (state.currentPath.length > 1) {
        op = {
          type: 'path',
          points: [...state.currentPath],
          color: state.color,
          size: state.brushSize,
          isHighlight: state.activeTool === 'highlighter'
        };
      }
    } else if (['rect', 'circle', 'line', 'arrow', 'blur'].includes(state.activeTool)) {
      op = {
        type: state.activeTool,
        x1: state.startX, y1: state.startY,
        x2: endX, y2: endY,
        color: state.color,
        size: state.brushSize
      };
    }

    if (op) {
      saveState();
      state.annotations.push(op);
      redrawCanvas();
    }
  }

  function drawStroke(path, color, size, isHighlight) {
    if (path.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = size * (isHighlight ? 3.5 : 1);
    ctx.globalAlpha = isHighlight ? 0.35 : 1.0;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawPreviewShape(tool, x1, y1, x2, y2) {
    ctx.save();
    ctx.strokeStyle = state.color;
    ctx.lineWidth = state.brushSize;
    ctx.fillStyle = state.color + '22';

    if (tool === 'rect') {
      const w = x2 - x1, h = y2 - y1;
      ctx.fillRect(x1, y1, w, h);
      ctx.strokeRect(x1, y1, w, h);
    } else if (tool === 'circle') {
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.abs(y2 - y1) / 2;
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (tool === 'arrow') {
      drawArrow(x1, y1, x2, y2, state.color, state.brushSize);
    } else if (tool === 'blur') {
      ctx.fillStyle = 'rgba(100, 116, 139, 0.6)';
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
    }
    ctx.restore();
  }

  function drawArrow(x1, y1, x2, y2, color, size) {
    const headlen = 14 + size;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headlen * Math.cos(angle - Math.PI / 6), y2 - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headlen * Math.cos(angle + Math.PI / 6), y2 - headlen * Math.sin(angle + Math.PI / 6));
    ctx.fillStyle = color;
    ctx.fill();
  }

  function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    state.annotations.forEach(op => {
      if (op.type === 'path') {
        drawStroke(op.points, op.color, op.size, op.isHighlight);
      } else if (op.type === 'text_box') {
        drawLabelCard(op);
      } else {
        drawPreviewShape(op.type, op.x1, op.y1, op.x2, op.y2);
      }
    });
  }

  // ── 7. LABELED TEXT CARD DRAWING ─────────────────────────────
  function drawLabelCard(op) {
    const { x, y, text, bucketName, severity } = op;
    const cardW = 240;

    // Pin Dot
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = op.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Connector Line
    const cardX = x + 24;
    const cardY = y - 18;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(cardX, cardY + 15);
    ctx.strokeStyle = op.color;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // Glass Card Box
    const cardH = 76;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.14)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 8);
    ctx.fill();

    // Left Bar
    ctx.fillStyle = op.color;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, 5, cardH, [8, 0, 0, 8]);
    ctx.fill();

    // Text & Badges
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.fillText(`${severity.toUpperCase()} • ${bucketName}`, cardX + 14, cardY + 20);

    ctx.font = '400 12px -apple-system, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(text.slice(0, 32) + (text.length > 32 ? '...' : ''), cardX + 14, cardY + 44);

    ctx.restore();
  }

  // ── 8. MODAL & UAT ISSUE LOG DRAWER ──────────────────────────
  function renderBucketChips() {
    const grid = container.querySelector('#mk-bucket-grid');
    grid.innerHTML = state.buckets.map(b => `
      <div class="mk-chip ${state.selectedBucket === b.id ? 'selected' : ''}" data-bucket="${b.id}">
        ${b.name}
      </div>
    `).join('');
  }

  function openModal() {
    renderBucketChips();
    const elemBox = container.querySelector('#mk-modal-element-info');
    if (state.pendingInspectedElement) {
      elemBox.style.display = 'block';
      elemBox.textContent = `Target Element: ${state.pendingInspectedElement}`;
    } else {
      elemBox.style.display = 'none';
    }

    const textarea = container.querySelector('#mk-note-text');
    textarea.value = '';
    modalBackdrop.classList.add('show');
    setTimeout(() => textarea.focus(), 100);
  }

  function closeModal() {
    modalBackdrop.classList.remove('show');
    state.pendingTextPos = null;
    state.pendingInspectedElement = null;
  }

  function commitTextAnnotation() {
    const text = container.querySelector('#mk-note-text').value.trim();
    if (!text || !state.pendingTextPos) return;

    const bObj = state.buckets.find(b => b.id === state.selectedBucket) || state.buckets[0];

    const op = {
      id: 'ann_' + Date.now(),
      type: 'text_box',
      x: state.pendingTextPos.x,
      y: state.pendingTextPos.y,
      text: text,
      elementTag: state.pendingInspectedElement || null,
      bucketId: bObj.id,
      bucketName: bObj.name,
      severity: state.selectedSeverity,
      status: 'Open',
      color: bObj.color,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    saveState();
    state.annotations.push(op);
    closeModal();
    redrawCanvas();
    updateLogDrawer();
    showToast(`Note pinned under [${bObj.name}]!`);
  }

  function updateLogDrawer() {
    const list = container.querySelector('#mk-drawer-list');
    let textAnns = state.annotations.filter(a => a.type === 'text_box');

    if (state.activeBucketFilter !== 'all') {
      textAnns = textAnns.filter(a => a.bucketId === state.activeBucketFilter);
    }

    const totalTextAnns = state.annotations.filter(a => a.type === 'text_box').length;
    const logBtn = container.querySelector('#mk-log-btn');
    if (logBtn) {
      logBtn.title = `UAT Log Drawer (${totalTextAnns} issues)`;
    }

    if (textAnns.length === 0) {
      list.innerHTML = `<div style="text-align:center; color:#94a3b8; padding:20px; font-size:12px; font-weight:500;">No UAT issues reported yet. Click <b>Note</b> or <b>Inspect</b> to drop feedback!</div>`;
      return;
    }

    list.innerHTML = textAnns.map((a, i) => `
      <div class="mk-log-card" style="border-left-color:${a.color};" data-id="${a.id}">
        <div class="mk-log-top">
          <span class="mk-sev-badge mk-sev-${a.severity}">${a.severity}</span>
          <span>#${i + 1} • ${a.time}</span>
        </div>
        ${a.elementTag ? `<div class="mk-log-element-tag">${a.elementTag}</div>` : ''}
        <div class="mk-log-note">${a.text}</div>
        <div class="mk-log-foot">
          <select class="mk-status-select" data-id="${a.id}">
            <option value="Open" ${a.status === 'Open' ? 'selected' : ''}>Open</option>
            <option value="In Progress" ${a.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Resolved" ${a.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
            <option value="Won't Fix" ${a.status === "Won't Fix" ? 'selected' : ''}>Won't Fix</option>
          </select>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.mk-status-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-id');
        const item = state.annotations.find(a => a.id === id);
        if (item) {
          item.status = e.target.value;
          showToast(`Status updated to "${item.status}"`);
        }
      });
    });
  }

  // ── 9. UNDO / REDO STACK SYSTEM ──────────────────────────────
  function saveState() {
    state.history.push(JSON.stringify(state.annotations));
    state.redoStack = [];
    updateUndoRedoState();
  }

  function undo() {
    if (state.history.length === 0) return;
    state.redoStack.push(JSON.stringify(state.annotations));
    state.annotations = JSON.parse(state.history.pop());
    redrawCanvas();
    updateLogDrawer();
    updateUndoRedoState();
    showToast('Undo action');
  }

  function redo() {
    if (state.redoStack.length === 0) return;
    state.history.push(JSON.stringify(state.annotations));
    state.annotations = JSON.parse(state.redoStack.pop());
    redrawCanvas();
    updateLogDrawer();
    updateUndoRedoState();
    showToast('Redo action');
  }

  function updateUndoRedoState() {
    if (undoBtn) undoBtn.disabled = state.history.length === 0;
    if (redoBtn) redoBtn.disabled = state.redoStack.length === 0;
  }

  function eraseAt(x, y) {
    const countBefore = state.annotations.length;
    state.annotations = state.annotations.filter(op => {
      if (op.type === 'text_box') {
        return Math.hypot(op.x - x, op.y - y) > 35;
      }
      return true;
    });
    if (state.annotations.length !== countBefore) {
      saveState();
      redrawCanvas();
      updateLogDrawer();
    }
  }

  // ── 10. SCREENSHOT & PDF EXPORT ENGINE ────────────────────────
  async function capturePNG() {
    showToast('Capturing screenshot...');
    try {
      const res = await chrome.runtime.sendMessage({ action: 'CAPTURE_TAB' });
      if (!res || !res.success) throw new Error(res ? res.error : 'Tab capture failed');

      const pageImg = new Image();
      pageImg.src = res.dataUrl;
      await new Promise(r => pageImg.onload = r);

      const compCanvas = document.createElement('canvas');
      compCanvas.width = pageImg.width;
      compCanvas.height = pageImg.height;
      const compCtx = compCanvas.getContext('2d');

      compCtx.drawImage(pageImg, 0, 0);

      const scaleX = pageImg.width / window.innerWidth;
      const scaleY = pageImg.height / window.innerHeight;
      compCtx.scale(scaleX, scaleY);
      compCtx.drawImage(canvas, 0, 0);

      const pngDataUrl = compCanvas.toDataURL('image/png');

      chrome.runtime.sendMessage({
        action: 'DOWNLOAD_FILE',
        url: pngDataUrl,
        filename: `Scribble_UAT_Screenshot_${window.location.hostname}_${Date.now()}.png`,
        saveAs: true
      });

      showToast('Annotated Screenshot Downloaded!');
    } catch (err) {
      console.error(err);
      showToast('Screenshot failed: ' + err.message);
    }
  }

  async function exportPDF() {
    showToast('Generating PDF UAT Report...');
    try {
      const res = await chrome.runtime.sendMessage({ action: 'CAPTURE_TAB' });
      if (!res || !res.success) throw new Error(res ? res.error : 'Tab capture failed');

      const pageImg = new Image();
      pageImg.src = res.dataUrl;
      await new Promise(r => pageImg.onload = r);

      const compCanvas = document.createElement('canvas');
      compCanvas.width = pageImg.width;
      compCanvas.height = pageImg.height;
      const compCtx = compCanvas.getContext('2d');

      compCtx.drawImage(pageImg, 0, 0);

      const scaleX = pageImg.width / window.innerWidth;
      const scaleY = pageImg.height / window.innerHeight;
      compCtx.scale(scaleX, scaleY);
      compCtx.drawImage(canvas, 0, 0);

      const finalImgData = compCanvas.toDataURL('image/png');

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfW = 297, pdfH = 210;

      // Header Banner
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pdfW, 14, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`SCRIBBLE- UAT EXTENSION REPORT — ${window.location.hostname}`, 10, 9);
      pdf.setFontSize(8);
      pdf.text(`Viewport: ${window.innerWidth}×${window.innerHeight}px | ${new Date().toLocaleString()}`, pdfW - 80, 9);

      // Webpage Image
      pdf.addImage(finalImgData, 'PNG', 10, 18, pdfW - 20, pdfH - 25);

      // UAT Summary Appendix Page
      const textAnns = state.annotations.filter(a => a.type === 'text_box');
      if (textAnns.length > 0) {
        pdf.addPage();
        pdf.setFillColor(15, 23, 42);
        pdf.rect(0, 0, pdfW, 14, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('SCRIBBLE- UAT EXTENSION ISSUE LOG & TECHNICAL METADATA', 10, 9);

        let y = 25;
        textAnns.forEach((a, i) => {
          pdf.setFontSize(9);
          pdf.setTextColor(15, 23, 42);
          pdf.setFont('helvetica', 'bold');
          pdf.text(`#${i + 1} [${a.severity.toUpperCase()}] • Bucket: ${a.bucketName} • Status: ${a.status}`, 10, y);
          if (a.elementTag) {
            pdf.setFontSize(8);
            pdf.setFont('courier', 'normal');
            pdf.setTextColor(0, 122, 255);
            pdf.text(`Target Element: ${a.elementTag}`, 10, y + 4);
            y += 4;
          }
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(51, 65, 85);
          pdf.text(`Note: ${a.text}`, 10, y + 5);
          y += 14;
        });
      }

      const pdfDataUrl = pdf.output('datauristring');
      chrome.runtime.sendMessage({
        action: 'DOWNLOAD_FILE',
        url: pdfDataUrl,
        filename: `Scribble_UAT_Report_${window.location.hostname}_${Date.now()}.pdf`,
        saveAs: true
      });

      showToast('PDF Exported Successfully!');
    } catch (err) {
      console.error(err);
      showToast('PDF export failed: ' + err.message);
    }
  }

  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(() => toastEl.classList.remove('show'), 3000);
  }
})();
