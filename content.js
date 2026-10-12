/* YouTube Auto-Refresh (Brave Fix)
 * Detects the "player initialised but media never loaded" state — blinking
 * screen, 0:00 duration — and reloads the page until the video plays.
 *
 * How it decides a video is broken:
 *   A working video (even one you haven't pressed play on, even with autoplay
 *   blocked) reports a real `video.duration`. The broken state leaves duration
 *   at 0 / NaN. So: no valid duration after a grace period == broken.
 *
 * Safety: per-video reload counter kept in sessionStorage so a genuinely
 * unplayable video (premiere, region block, age gate) can't loop forever.
 */
(() => {
  'use strict';

  const DEFAULTS = {
    enabled: true,
    graceMs: 4000,     // wait at least this long before calling it broken
    maxWaitMs: 15000,  // safety net: stop watching after this
    maxRetries: 3,     // max auto-refreshes per video, per tab session
    showToast: true,   // show a small on-page notice when refreshing
  };

  let cfg = { ...DEFAULTS };
  try {
    chrome.storage?.local.get(DEFAULTS, (stored) => { cfg = { ...DEFAULTS, ...stored }; });
    chrome.storage?.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      for (const k of Object.keys(changes)) cfg[k] = changes[k].newValue;
    });
  } catch (_) { /* storage unavailable; defaults are fine */ }

  const log = (...a) => console.debug('[YT-AutoRefresh]', ...a);

  const getVideoId = () => {
    try { return new URL(location.href).searchParams.get('v'); } catch { return null; }
  };
  const isWatchPage = () => location.pathname === '/watch' && !!getVideoId();

  const RKEY = (id) => 'ytar:retries:' + id;
  const getRetries = (id) => parseInt(sessionStorage.getItem(RKEY(id)) || '0', 10) || 0;
  const setRetries = (id, n) => { try { sessionStorage.setItem(RKEY(id), String(n)); } catch {} };
  const clearRetries = (id) => { try { sessionStorage.removeItem(RKEY(id)); } catch {} };

  function toast(msg, ms = 3000) {
    if (!cfg.showToast) return;
    let el = document.getElementById('ytar-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ytar-toast';
      el.style.cssText = [
        'position:fixed', 'z-index:2147483647', 'left:50%', 'bottom:84px',
        'transform:translateX(-50%)', 'background:rgba(18,18,18,.94)', 'color:#fff',
        'padding:10px 16px', 'border-radius:8px', 'border-left:3px solid #ff0028',
        'font:500 13px/1.45 Roboto,Arial,sans-serif', 'box-shadow:0 6px 18px rgba(0,0,0,.45)',
        'pointer-events:none', 'max-width:80vw', 'text-align:center',
        'opacity:0', 'transition:opacity .25s',
      ].join(';');
      document.documentElement.appendChild(el);
    }
    el.textContent = msg;
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, ms);
  }

  // 'ok' (playing fine) | 'pending' (not ready yet) | 'broken' (explicit error)
  function evaluate() {
    const player = document.querySelector('.html5-video-player');
    const video = document.querySelector('video.video-stream, video.html5-main-video, video');

    // Explicit YouTube error overlay — a reload often clears transient ones.
    if (player && player.classList.contains('ytp-error')) return 'broken';

    // An ad is playing => the player is actually working.
    if (player && (player.classList.contains('ad-showing') ||
                   player.classList.contains('ad-interrupting'))) return 'ok';

    if (!player || !video) return 'pending';

    const d = video.duration;
    const durationValid = d === Infinity || (typeof d === 'number' && !isNaN(d) && d > 0);
    if (durationValid) return 'ok';

    if ((video.currentTime || 0) > 0) return 'ok';  // somehow progressed
    return 'pending';
  }

  let watchToken = 0; // bump to invalidate any in-flight watcher

  function reload(id) {
    const n = getRetries(id);
    if (n >= cfg.maxRetries) {
      toast(`Still broken after ${cfg.maxRetries} tries — leaving it for you.`, 5000);
      log('max retries reached for', id);
      return;
    }
    setRetries(id, n + 1);
    toast(`Broken player detected — refreshing (${n + 1}/${cfg.maxRetries})…`, 2500);
    log('reloading, attempt', n + 1, 'for', id);
    setTimeout(() => location.reload(), 350); // let the toast flash first
  }

  function watch() {
    if (!cfg.enabled || !isWatchPage()) return;

    const id = getVideoId();
    const myToken = ++watchToken;
    const start = Date.now();
    log('watching', id, '| prior retries:', getRetries(id));

    const tick = () => {
      if (myToken !== watchToken || !cfg.enabled) return; // navigated away / disabled
      if (getVideoId() !== id) return;                    // URL changed under us

      const state = evaluate();
      const elapsed = Date.now() - start;

      if (state === 'ok') { clearRetries(id); log('ok', id); return; }
      if (state === 'broken' && elapsed >= 1500) { reload(id); return; }
      if (state === 'pending' && elapsed >= cfg.graceMs) { reload(id); return; }
      if (elapsed >= cfg.maxWaitMs) { log('timeout watching', id); return; }

      setTimeout(tick, 1000);
    };

    setTimeout(tick, 1200);
  }

  function onNavigate() {
    watchToken++; // cancel any previous watcher
    if (isWatchPage()) setTimeout(watch, 300); // let YouTube settle after nav
  }

  // SPA navigations (clicking a thumbnail doesn't reload the page)
  document.addEventListener('yt-navigate-finish', onNavigate, true);
  window.addEventListener('yt-navigate-finish', onNavigate, true);

  // URL-change fallback in case the event is missed
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; onNavigate(); }
  }, 1000);

  // Initial hard load
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', onNavigate, { once: true });
  } else {
    onNavigate();
  }
})();
