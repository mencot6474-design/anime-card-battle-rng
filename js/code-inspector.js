/* ==========================================================================
   IN-GAME CLICK-TO-SOURCE CODE INSPECTOR TOOL
   Hold [Alt] OR Toggle Badge -> Click any element in game
   -> Editor cursor jumps directly to the source code line!
   -> Copies markdown link [file:line](file://...) to clipboard for chat!
   ========================================================================== */

(function () {
  'use strict';

  let isInspectorActive = false;
  let isAltPressed = false;
  let hoveredElement = null;
  let cacheMap = new Map();

  // Create UI Overlay Container
  const hudContainer = document.createElement('div');
  hudContainer.id = 'codeInspectorContainer';
  hudContainer.innerHTML = `
    <!-- Highlight Reticle -->
    <div id="codeInspectorBox" class="ci-box">
      <div class="ci-corner tl"></div>
      <div class="ci-corner tr"></div>
      <div class="ci-corner bl"></div>
      <div class="ci-corner br"></div>
    </div>

    <!-- Floating HUD Tooltip -->
    <div id="codeInspectorTooltip" class="ci-tooltip">
      <div class="ci-tt-header">
        <span class="ci-live-dot"></span>
        <span class="ci-tt-title">CODE INSPECTOR</span>
        <span class="ci-tt-key">[ALT + CLICK]</span>
      </div>
      <div class="ci-tt-body">
        <div class="ci-tt-tag" id="ciTag">&lt;div&gt;</div>
        <div class="ci-tt-loc" id="ciLoc">
          <span class="ci-spinner"></span> Mencari baris kode...
        </div>
      </div>
      <div class="ci-tt-hint">KLIK ELEMEN UNTUK BUKA BARIS KODE DI EDITOR</div>
    </div>

    <!-- Bottom-Left Floating Toggle Badge -->
    <button type="button" id="codeInspectorBadge" class="ci-badge" title="Klik untuk mengaktifkan Code Inspector (atau tahan Alt)">
      <span class="ci-badge-icon">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="22" y1="12" x2="18" y2="12"></line>
          <line x1="6" y1="12" x2="2" y2="12"></line>
          <line x1="12" y1="6" x2="12" y2="2"></line>
          <line x1="12" y1="22" x2="12" y2="18"></line>
        </svg>
      </span>
      <span class="ci-badge-label" id="ciBadgeLabel">CODE INSPECT: OFF</span>
      <span class="ci-badge-pill">ALT</span>
    </button>

    <!-- Success Toast Notification -->
    <div id="codeInspectorToast" class="ci-toast">
      <div class="ci-toast-icon">✓</div>
      <div class="ci-toast-content">
        <div class="ci-toast-title">KURSOR MENUJU BARIS KODE!</div>
        <div class="ci-toast-file" id="ciToastFile">js/tower-lobby.js:1520</div>
        <div class="ci-toast-sub">Link disalin ke clipboard (Tinggal Ctrl+V di chat)</div>
      </div>
    </div>
  `;

  // Inject Styles
  const style = document.createElement('style');
  style.id = 'codeInspectorStyles';
  style.textContent = `
    #codeInspectorContainer {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 9999999;
      font-family: 'JetBrains Mono', 'Rajdhani', monospace, sans-serif;
    }

    /* Target Reticle */
    .ci-box {
      position: fixed;
      display: none;
      pointer-events: none;
      border: 1.5px solid #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.45), inset 0 0 15px rgba(56, 189, 248, 0.2);
      transition: all 0.08s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 9999999;
    }
    .ci-corner {
      position: absolute;
      width: 7px;
      height: 7px;
      border: 2.5px solid #7dd3fc;
    }
    .ci-corner.tl { top: -2px; left: -2px; border-right: none; border-bottom: none; }
    .ci-corner.tr { top: -2px; right: -2px; border-left: none; border-bottom: none; }
    .ci-corner.bl { bottom: -2px; left: -2px; border-right: none; border-top: none; }
    .ci-corner.br { bottom: -2px; right: -2px; border-left: none; border-top: none; }

    /* Tooltip */
    .ci-tooltip {
      position: fixed;
      display: none;
      pointer-events: none;
      background: rgba(8, 14, 26, 0.94);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(56, 189, 248, 0.4);
      border-radius: 8px;
      padding: 10px 14px;
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.75), 0 0 15px rgba(56, 189, 248, 0.3);
      z-index: 10000000;
      color: #f8fafc;
      min-width: 240px;
      max-width: 380px;
      transform: translate(-50%, -100%);
      margin-top: -12px;
      transition: opacity 0.15s ease;
    }
    .ci-tt-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 4px;
    }
    .ci-live-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #34d399;
      box-shadow: 0 0 8px #34d399;
      animation: pulseGreen 1.5s infinite;
    }
    .ci-tt-title {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.12em;
      color: #38bdf8;
    }
    .ci-tt-key {
      font-size: 9.5px;
      color: #fbbf24;
      font-weight: 700;
      background: rgba(251, 191, 36, 0.15);
      padding: 1px 6px;
      border-radius: 4px;
    }
    .ci-tt-tag {
      font-size: 11px;
      color: #94a3b8;
      font-family: 'JetBrains Mono', monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 3px;
    }
    .ci-tt-loc {
      font-size: 12.5px;
      font-weight: 700;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 6px;
      word-break: break-all;
    }
    .ci-tt-hint {
      font-size: 9px;
      color: #38bdf8;
      letter-spacing: 0.08em;
      margin-top: 6px;
      font-weight: 600;
      text-transform: uppercase;
    }

    /* Floating Badge */
    .ci-badge {
      position: fixed;
      left: 16px;
      bottom: 16px;
      pointer-events: auto;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 14px;
      background: rgba(10, 16, 30, 0.85);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 20px;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6);
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 10000001;
    }
    .ci-badge:hover {
      background: rgba(14, 24, 48, 0.95);
      color: #ffffff;
      border-color: #38bdf8;
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(56, 189, 248, 0.35);
    }
    .ci-badge.active {
      background: rgba(14, 34, 60, 0.95);
      border-color: #38bdf8;
      color: #38bdf8;
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.5);
    }
    .ci-badge-icon {
      display: flex;
      align-items: center;
      color: #38bdf8;
    }
    .ci-badge-pill {
      font-size: 9px;
      background: rgba(255, 255, 255, 0.1);
      padding: 1px 6px;
      border-radius: 10px;
      color: #cbd5e1;
    }

    /* Toast */
    .ci-toast {
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(-30px);
      opacity: 0;
      pointer-events: none;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 20px;
      background: rgba(8, 14, 28, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid #34d399;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(52, 211, 153, 0.4);
      border-radius: 10px;
      color: #ffffff;
      z-index: 10000005;
      transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ci-toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    .ci-toast-icon {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(52, 211, 153, 0.2);
      border: 1.5px solid #34d399;
      color: #34d399;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 16px;
    }
    .ci-toast-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #34d399;
    }
    .ci-toast-file {
      font-size: 13.5px;
      font-weight: 700;
      color: #f8fafc;
      font-family: 'JetBrains Mono', monospace;
    }
    .ci-toast-sub {
      font-size: 10px;
      color: #94a3b8;
    }

    .ci-spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid rgba(56, 189, 248, 0.3);
      border-top-color: #38bdf8;
      border-radius: 50%;
      animation: ciSpin 0.7s linear infinite;
    }
    @keyframes ciSpin {
      to { transform: rotate(360deg); }
    }
  `;

  // Wait for document ready
  function initInspector() {
    if (document.getElementById('codeInspectorContainer')) return;
    document.head.appendChild(style);
    document.body.appendChild(hudContainer);

    const box = document.getElementById('codeInspectorBox');
    const tt = document.getElementById('codeInspectorTooltip');
    const badge = document.getElementById('codeInspectorBadge');
    const badgeLabel = document.getElementById('ciBadgeLabel');
    const toast = document.getElementById('codeInspectorToast');
    const toastFile = document.getElementById('ciToastFile');
    const ciTag = document.getElementById('ciTag');
    const ciLoc = document.getElementById('ciLoc');

    // Toggle Badge Click
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      setInspectorActive(!isInspectorActive);
    });

    function setInspectorActive(active) {
      isInspectorActive = active;
      if (active) {
        badge.classList.add('active');
        badgeLabel.textContent = 'KLIK ELEMEN KODE';
        if (window.sfx && typeof sfx.hit === 'function') sfx.hit();
      } else {
        badge.classList.remove('active');
        badgeLabel.textContent = 'CODE INSPECT: OFF';
        hideHUD();
      }
    }

    // Keyboard Shortcuts (Hold Alt or press Ctrl+Shift+X)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Alt') {
        isAltPressed = true;
        badge.classList.add('active');
        badgeLabel.textContent = 'HOLDING ALT [KLIK ELEMEN]';
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'X' || e.key === 'x')) {
        setInspectorActive(!isInspectorActive);
      } else if (e.key === 'Escape') {
        if (isInspectorActive) setInspectorActive(false);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Alt') {
        isAltPressed = false;
        if (!isInspectorActive) {
          badge.classList.remove('active');
          badgeLabel.textContent = 'CODE INSPECT: OFF';
          hideHUD();
        }
      }
    });

    function getMeaningfulTarget(el) {
      if (!el || el === document.body || el === document.documentElement) return null;
      if (el.closest('#codeInspectorContainer')) return null;

      // Climb up to find element with ID, button, link, or major class
      const candidate = el.closest(
        '[id], button, a, .hero-banner-card, .op-card, .mod-pod, .cmd-trigger-btn, .foot-profile, .foot-main, .currency-pill, .tb-avatar-pod, .stage-hint-pill, .telemetry-feed, #heroStandeeWrap, #heroCardPlate, #heroTacticalBadge'
      );
      return candidate || el;
    }

    // Mouse Move Inspector
    window.addEventListener('mousemove', (e) => {
      if (!isInspectorActive && !isAltPressed) {
        hideHUD();
        return;
      }

      const target = getMeaningfulTarget(e.target);
      if (!target) {
        hideHUD();
        return;
      }

      hoveredElement = target;
      updateReticle(target);
      updateTooltip(target, e.clientX, e.clientY);
    }, { passive: true });

    function hideHUD() {
      box.style.display = 'none';
      tt.style.display = 'none';
    }

    function updateReticle(el) {
      const rect = el.getBoundingClientRect();
      box.style.display = 'block';
      box.style.top = rect.top + 'px';
      box.style.left = rect.left + 'px';
      box.style.width = rect.width + 'px';
      box.style.height = rect.height + 'px';
    }

    async function updateTooltip(el, mouseX, mouseY) {
      tt.style.display = 'block';

      // Clamp tooltip inside screen
      let top = mouseY - 14;
      let left = mouseX;
      if (top < 90) top = mouseY + 40;
      if (left < 160) left = 160;
      if (left > window.innerWidth - 180) left = window.innerWidth - 180;

      tt.style.top = top + 'px';
      tt.style.left = left + 'px';

      const tagDesc = el.tagName.toLowerCase() + (el.id ? ('#' + el.id) : (el.className ? ('.' + String(el.className).split(' ')[0]) : ''));
      ciTag.textContent = tagDesc;

      const cacheKey = el.id || el.className || tagDesc;
      if (cacheMap.has(cacheKey)) {
        renderLocation(cacheMap.get(cacheKey));
        return;
      }

      ciLoc.innerHTML = '<span class="ci-spinner"></span> Mencari baris kode...';

      // Query server for exact line
      try {
        const queryParams = new URLSearchParams({
          id: el.id || '',
          className: el.className || '',
          tag: el.tagName || '',
          text: (el.innerText || '').slice(0, 30)
        });
        const resp = await fetch('/api/locate-code?' + queryParams.toString());
        const data = await resp.json();
        if (data && data.success && data.file) {
          cacheMap.set(cacheKey, data);
          renderLocation(data);
        } else {
          ciLoc.textContent = 'Elemen DOM: ' + tagDesc;
        }
      } catch (err) {
        ciLoc.textContent = tagDesc;
      }
    }

    function renderLocation(data) {
      ciLoc.innerHTML = `📍 <span style="color:#38bdf8;font-weight:800;">${data.file}:${data.line}</span>`;
    }

    // Intercept Click to Jump to Code!
    window.addEventListener('click', async (e) => {
      if (!isInspectorActive && !isAltPressed) return;

      const target = getMeaningfulTarget(e.target);
      if (!target) return;

      // STOP Game click action!
      e.stopPropagation();
      e.preventDefault();

      const queryParams = new URLSearchParams({
        id: target.id || '',
        className: target.className || '',
        tag: target.tagName || '',
        text: (target.innerText || '').slice(0, 30)
      });

      try {
        // 1. Locate Code
        const resp = await fetch('/api/locate-code?' + queryParams.toString());
        const data = await resp.json();

        if (data && data.success && data.file) {
          // 2. Open in Editor (Antigravity / Cursor / VS Code)
          await fetch('/api/open-in-editor?file=' + encodeURIComponent(data.fullPath) + '&line=' + data.line);

          // 3. Fallback client protocol trigger
          const clientLink = document.createElement('a');
          clientLink.href = `antigravity://file/${data.fullPath.replace(/\\\\/g, '/')}:${data.line}`;
          clientLink.click();

          // 4. Copy Markdown Link to Clipboard for Chat
          const mdLink = `[${data.file}:${data.line}](file:///${data.fullPath.replace(/\\\\/g, '/')}#L${data.line})`;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(mdLink);
          }

          // 5. Show Cyber Toast Notification
          toastFile.textContent = `${data.file}:${data.line}`;
          toast.classList.add('show');
          if (window.sfx && typeof sfx.open === 'function') sfx.open();

          setTimeout(() => {
            toast.classList.remove('show');
          }, 3500);

          console.log('%c[CODE INSPECTOR]%c Jumped to:', 'background:#38bdf8;color:#000;font-weight:bold;padding:2px 6px;border-radius:4px;', '', mdLink);
        }
      } catch (err) {
        console.error('Inspector error:', err);
      }

      // Turn off inspector if it was toggled
      if (isInspectorActive) {
        setInspectorActive(false);
      }
    }, true); // Capture phase to intercept before game handlers!
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInspector);
  } else {
    initInspector();
  }
})();
