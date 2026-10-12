const DEFAULTS = { enabled: true, graceMs: 4000, maxWaitMs: 15000, maxRetries: 3, showToast: true };
const fields = ['enabled', 'graceMs', 'maxRetries', 'showToast'];

chrome.storage.local.get(DEFAULTS, (cfg) => {
  document.getElementById('enabled').checked = cfg.enabled;
  document.getElementById('graceMs').value = cfg.graceMs;
  document.getElementById('maxRetries').value = cfg.maxRetries;
  document.getElementById('showToast').checked = cfg.showToast;
});

function save() {
  const data = {
    enabled: document.getElementById('enabled').checked,
    graceMs: clampInt(document.getElementById('graceMs').value, 1000, 20000, 4000),
    maxRetries: clampInt(document.getElementById('maxRetries').value, 1, 10, 3),
    showToast: document.getElementById('showToast').checked,
  };
  chrome.storage.local.set(data);
}

function clampInt(v, lo, hi, def) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return def;
  return Math.min(hi, Math.max(lo, n));
}

fields.forEach((id) => {
  const el = document.getElementById(id);
  el.addEventListener('change', save);
});
