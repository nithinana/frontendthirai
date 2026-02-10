/**
 * Thirai TV focus + D-pad navigation
 * Works on Android TV WebView / browsers.
 */
(function () {
  const FOCUS_SELECTOR = [
    '.desktop-sidebar .side-item',
    '.nav-link', '.nav-item',
    'input', 'button', 'a[href]',
    '.card'
  ].join(',');

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && r.width > 0 && r.height > 0;
  }

  function makeFocusable(root=document) {
    // Make cards focusable for D-pad navigation
    root.querySelectorAll('.card').forEach(card => {
      if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
    });
    // Make nav items focusable if needed
    root.querySelectorAll('.nav-item').forEach(n => {
      if (!n.hasAttribute('tabindex')) n.setAttribute('tabindex', '0');
      n.setAttribute('role', 'button');
    });
  }

  function focusFirst() {
    const first = Array.from(document.querySelectorAll(FOCUS_SELECTOR)).find(isVisible);
    if (first) first.focus();
  }

  function centerIntoView(el) {
    try { el.scrollIntoView({behavior:'smooth', block:'center', inline:'center'}); } catch(e) {}
  }

  function getFocusable() {
    return Array.from(document.querySelectorAll(FOCUS_SELECTOR)).filter(isVisible);
  }

  function scoreCandidate(fromRect, toRect, dir) {
    const fx = fromRect.left + fromRect.width/2;
    const fy = fromRect.top + fromRect.height/2;
    const tx = toRect.left + toRect.width/2;
    const ty = toRect.top + toRect.height/2;
    const dx = tx - fx;
    const dy = ty - fy;

    // Directional gating
    if (dir === 'left'  && dx >= -5) return Infinity;
    if (dir === 'right' && dx <= 5)  return Infinity;
    if (dir === 'up'    && dy >= -5) return Infinity;
    if (dir === 'down'  && dy <= 5)  return Infinity;

    // Prefer candidates more aligned on the perpendicular axis
    const primary = (dir === 'left' || dir === 'right') ? Math.abs(dx) : Math.abs(dy);
    const secondary = (dir === 'left' || dir === 'right') ? Math.abs(dy) : Math.abs(dx);

    return primary * 1.0 + secondary * 2.0; // weight alignment
  }

  function moveFocus(dir) {
    const active = document.activeElement;
    const focusables = getFocusable();
    if (!active || focusables.length === 0) return;

    const fromRect = active.getBoundingClientRect();
    let best = null;
    let bestScore = Infinity;

    for (const el of focusables) {
      if (el === active) continue;
      const toRect = el.getBoundingClientRect();
      const s = scoreCandidate(fromRect, toRect, dir);
      if (s < bestScore) {
        bestScore = s;
        best = el;
      }
    }

    if (best) {
      best.focus();
      centerIntoView(best);
    }
  }

  function clickActive() {
    const el = document.activeElement;
    if (!el) return;
    // If it's a card/nav item, it likely has onclick
    el.click?.();
  }

  function goBackSmart() {
    // If there is a visible back button in the UI, click it
    const backBtn = document.getElementById('back-button');
    if (backBtn && isVisible(backBtn)) {
      backBtn.click();
      return;
    }
    // Otherwise use history
    if (history.length > 1) history.back();
  }

  // Patch focusability on load + on dynamic content changes
  makeFocusable(document);
  const obs = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes && m.addedNodes.length) {
        m.addedNodes.forEach(n => {
          if (n.nodeType === 1) makeFocusable(n);
        });
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  // D-pad key handler
  window.addEventListener('keydown', (e) => {
    const key = e.key;
    // Let typing work inside inputs
    const isTyping = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');
    if (isTyping && (key.length === 1 || key === 'Backspace' || key === 'Delete')) return;

    if (key === 'ArrowLeft')  { e.preventDefault(); moveFocus('left'); }
    if (key === 'ArrowRight') { e.preventDefault(); moveFocus('right'); }
    if (key === 'ArrowUp')    { e.preventDefault(); moveFocus('up'); }
    if (key === 'ArrowDown')  { e.preventDefault(); moveFocus('down'); }
    if (key === 'Enter' || key === ' ') { e.preventDefault(); clickActive(); }
    if (key === 'Backspace' || key === 'Escape') { e.preventDefault(); goBackSmart(); }
  }, {passive:false});

  // Initial focus after your rows render
  window.addEventListener('load', () => setTimeout(focusFirst, 700));
})();
