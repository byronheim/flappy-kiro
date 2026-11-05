// Shell (developer tooling): a hidden DOM overlay exposing the freely-tunable
// config parameters. Never drawn on the Canvas and never advances/alters the
// simulation on its own. Edits route through config.js (which clamps).
//
// Design "Configuration and Tuning > Tuning panel behavior".

// Freely-tunable fields and their allowed ranges (for labels).
const TUNABLE = [
  { key: 'GRAVITY', label: 'Gravity', min: 800, max: 2400, step: 10 },
  { key: 'FLAP_IMPULSE', label: 'Flap impulse', min: 300, max: 700, step: 10 },
  { key: 'GROUND_HEIGHT_FACTOR', label: 'Ground height', min: 0.05, max: 0.2, step: 0.01 },
  { key: 'GHOSTY_HEIGHT_FACTOR', label: 'Ghosty height', min: 0.05, max: 0.15, step: 0.01 },
  { key: 'CLOUD_MIN_SPEED', label: 'Cloud min speed', min: 1, max: 200, step: 1 },
];

/**
 * @param {object} opts
 * @param {(raw: object) => object} opts.onChange  returns the clamped effective config
 * @param {object} opts.defaults  the default config (constants.js shape)
 * @param {Document} [opts.doc]   injectable for tests
 * @param {EventTarget} [opts.keyTarget]  injectable for tests (defaults to window)
 * @returns {{ toggle: () => void, destroy: () => void, isVisible: () => boolean }}
 */
export function createTuningPanel(opts) {
  const { onChange, defaults } = opts;
  const doc = opts.doc || (typeof document !== 'undefined' ? document : undefined);
  const keyTarget = opts.keyTarget || (typeof window !== 'undefined' ? window : undefined);
  if (!doc) throw new Error('tuningPanel requires a document');

  const live = {}; // accumulated raw live overrides
  let visible = false;

  const panel = doc.createElement('div');
  panel.id = 'tuning-panel';
  panel.style.display = 'none';
  panel.style.position = 'fixed';
  panel.style.top = '8px';
  panel.style.right = '8px';
  panel.style.zIndex = '1000';
  panel.style.background = 'rgba(0,0,0,0.75)';
  panel.style.color = '#fff';
  panel.style.font = '12px monospace';
  panel.style.padding = '8px';

  const inputs = new Map();

  for (const field of TUNABLE) {
    const row = doc.createElement('div');
    const label = doc.createElement('label');
    label.textContent = `${field.label} [${field.min}-${field.max}] `;
    const inputEl = doc.createElement('input');
    inputEl.type = 'number';
    inputEl.min = String(field.min);
    inputEl.max = String(field.max);
    inputEl.step = String(field.step);
    inputEl.value = String(defaults[field.key]);

    inputEl.addEventListener('change', () => {
      live[field.key] = Number(inputEl.value);
      const effective = onChange({ ...live });
      // Reflect the clamped effective value so it can never escape its range.
      inputEl.value = String(effective[field.key]);
    });

    inputs.set(field.key, inputEl);
    label.appendChild(inputEl);
    row.appendChild(label);
    panel.appendChild(row);
  }

  const resetBtn = doc.createElement('button');
  resetBtn.textContent = 'Reset to defaults';
  resetBtn.addEventListener('click', () => {
    for (const key of Object.keys(live)) delete live[key];
    const effective = onChange({});
    for (const [key, el] of inputs) el.value = String(effective[key]);
  });
  panel.appendChild(resetBtn);

  if (doc.body) doc.body.appendChild(panel);

  const setVisible = (v) => {
    visible = v;
    panel.style.display = v ? 'block' : 'none';
  };

  const onKey = (event) => {
    // Toggle on the backtick key.
    if (event.key === '`' || event.code === 'Backquote') setVisible(!visible);
  };
  if (keyTarget && keyTarget.addEventListener) keyTarget.addEventListener('keydown', onKey);

  return {
    toggle() {
      setVisible(!visible);
    },
    isVisible() {
      return visible;
    },
    destroy() {
      if (keyTarget && keyTarget.removeEventListener) keyTarget.removeEventListener('keydown', onKey);
      if (panel.parentNode) panel.parentNode.removeChild(panel);
    },
  };
}
