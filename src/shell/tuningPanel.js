// Shell (developer tooling + customization): a centered modal dialog over the
// play area with tabs. Never drawn on the Canvas and never advances/alters the
// simulation on its own. Settings edits route through config.js (which clamps).
//
// Tabs are the extensible home for customization:
//   - Color:       Ghosty color selection (Req 11; live).
//   - Environment: full scene palette / theme selection (Req 16; live).
//   - Flair:       Ghosty flair selection (Req 12; scaffolded, wired later).
//   - Settings:    the freely-tunable config parameters (live).
//
// Design "Configuration and Tuning > Tuning panel behavior".
import {
  COLOR_PALETTE,
  ENVIRONMENTS,
  FLAIR_SLOTS,
  flairForSlot,
  resolveAppearance,
} from '../core/theme.js';

// Freely-tunable fields and their allowed ranges (for labels). Ranges mirror
// RANGES in shell/config.js; config.js clamps authoritatively.
const TUNABLE = [
  { key: 'GRAVITY', label: 'Gravity', min: 800, max: 2400, step: 10 },
  { key: 'FLAP_IMPULSE', label: 'Flap impulse', min: 300, max: 700, step: 10 },
  { key: 'MAX_FALL_SPEED', label: 'Max fall speed', min: 600, max: 1800, step: 10 },
  { key: 'PIPE_SPEED_FACTOR', label: 'Pipe speed', min: 0.1, max: 0.8, step: 0.01 },
  { key: 'PIPE_SPACING_FACTOR', label: 'Pipe spacing', min: 0.3, max: 1.0, step: 0.01 },
  { key: 'PIPE_GAP_GHOSTY_MULTIPLE', label: 'Gap size', min: 1.5, max: 3.5, step: 0.1 },
  { key: 'PIPE_GAP_MARGIN_FACTOR', label: 'Gap margin', min: 0.05, max: 0.15, step: 0.01 },
  { key: 'GROUND_HEIGHT_FACTOR', label: 'Ground height', min: 0.05, max: 0.18, step: 0.01 },
  { key: 'GHOSTY_HEIGHT_FACTOR', label: 'Ghosty height', min: 0.05, max: 0.12, step: 0.01 },
  { key: 'CLOUD_MIN_SPEED', label: 'Cloud min speed', min: 1, max: 200, step: 1 },
];

// Tabs shown in the dialog. 'id' is used to show/hide the matching content.
const TABS = [
  { id: 'color', label: 'Color' },
  { id: 'environment', label: 'Environment' },
  { id: 'flair', label: 'Flair' },
  { id: 'settings', label: 'Settings' },
];
const DEFAULT_TAB = 'color';

/** Small helper: set inline styles from an object (works with the test stub). */
function style(el, styles) {
  for (const [k, v] of Object.entries(styles)) el.style[k] = v;
}

/**
 * @param {object} opts
 * @param {(raw: object) => object} opts.onChange  returns the clamped effective config
 * @param {object} opts.defaults  the default config (constants.js shape)
 * @param {{ colorId?: string, environmentId?: string }} [opts.appearance]  current selection
 * @param {(sel: { colorId: string, environmentId: string }) => void} [opts.onAppearanceChange]
 *        called with the full selection whenever the player picks a color or environment
 * @param {Document} [opts.doc]   injectable for tests
 * @param {EventTarget} [opts.keyTarget]  injectable for tests (defaults to window)
 * @returns {{ toggle, destroy, isVisible, show, hide, selectTab, activeTab }}
 */
export function createTuningPanel(opts) {
  const { onChange, defaults } = opts;
  const onAppearanceChange = opts.onAppearanceChange || (() => {});
  // Current selection, resolved to valid ids (defaults fill any gaps).
  let appearance = resolveAppearance(opts.appearance);
  // The raw selection (ids + flair) behind the current resolved appearance, so
  // re-resolving after a single-field change preserves the other fields.
  const appearanceSelection = () => ({
    colorId: appearance.colorId,
    environmentId: appearance.environmentId,
    flair: { ...appearance.flairIds },
  });
  // Emit the full current appearance (color + environment + flair ids) so a
  // change on any one tab preserves the others.
  const emitAppearance = () => onAppearanceChange(appearanceSelection());
  const doc = opts.doc || (typeof document !== 'undefined' ? document : undefined);
  const keyTarget = opts.keyTarget || (typeof window !== 'undefined' ? window : undefined);
  if (!doc) throw new Error('tuningPanel requires a document');
  // Mount target: the positioned stage wrapper in the browser so the overlay
  // centers over the play area; defaults to body (used by tests).
  const mount = opts.mount || doc.body;

  const live = {}; // accumulated raw live overrides (Settings tab)
  let visible = false;
  let activeTab = DEFAULT_TAB;

  // --- Overlay + centered card -------------------------------------------
  const overlay = doc.createElement('div');
  overlay.id = 'tuning-panel';
  style(overlay, {
    display: 'none',
    position: 'absolute',
    inset: '0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: '1100',
    background: 'rgba(0,0,0,0.4)',
  });

  const card = doc.createElement('div');
  style(card, {
    background: 'rgba(255,255,255,0.97)',
    color: '#243',
    borderRadius: '12px',
    boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
    width: '340px',
    maxWidth: '86%',
    fontFamily: 'sans-serif',
    overflow: 'hidden',
  });
  overlay.appendChild(card);

  // --- Header (title + close) --------------------------------------------
  const header = doc.createElement('div');
  style(header, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid #e5eae7',
  });
  const title = doc.createElement('h2');
  title.textContent = 'Options';
  style(title, { margin: '0', fontSize: '18px', color: '#2e7d22' });
  const closeBtn = doc.createElement('button');
  closeBtn.textContent = '\u2715'; // ✕
  style(closeBtn, {
    border: 'none', background: 'transparent', cursor: 'pointer',
    fontSize: '16px', color: '#566', lineHeight: '1',
  });
  closeBtn.addEventListener('click', () => setVisible(false));
  header.appendChild(title);
  header.appendChild(closeBtn);
  card.appendChild(header);

  // --- Tab strip ----------------------------------------------------------
  const tabStrip = doc.createElement('div');
  style(tabStrip, { display: 'flex', gap: '4px', padding: '10px 16px 0' });
  const tabButtons = new Map();
  const tabPanels = new Map();

  const selectTab = (id) => {
    activeTab = id;
    for (const [tid, btn] of tabButtons) {
      const on = tid === id;
      style(btn, {
        background: on ? '#4caf3e' : '#f1f5f3',
        color: on ? '#fff' : '#345',
        fontWeight: on ? 'bold' : 'normal',
        borderColor: on ? '#4caf3e' : '#cbd5d0',
      });
    }
    for (const [tid, p] of tabPanels) {
      style(p, { display: tid === id ? 'block' : 'none' });
    }
  };

  for (const tab of TABS) {
    const btn = doc.createElement('button');
    btn.textContent = tab.label;
    style(btn, {
      cursor: 'pointer', fontSize: '13px', padding: '6px 14px',
      border: '1px solid #cbd5d0', borderRadius: '6px 6px 0 0',
      background: '#f1f5f3', color: '#345',
    });
    btn.addEventListener('click', () => selectTab(tab.id));
    tabButtons.set(tab.id, btn);
    tabStrip.appendChild(btn);
  }
  card.appendChild(tabStrip);

  // --- Tab content container ---------------------------------------------
  const body = doc.createElement('div');
  style(body, { padding: '16px', maxHeight: '320px', overflowY: 'auto' });
  card.appendChild(body);

  const makePanel = (id) => {
    const p = doc.createElement('div');
    style(p, { display: 'none' });
    tabPanels.set(id, p);
    body.appendChild(p);
    return p;
  };

  // --- Swatch grid helper: a row of selectable color/theme chips ----------
  // `getSwatch(option) -> cssColor` picks the chip's display color; `onPick`
  // receives the chosen option's id. Returns a function to refresh the active
  // highlight when the selection changes elsewhere.
  const makeSwatchGrid = (panel, options, getSwatch, isActive, onPick) => {
    const grid = doc.createElement('div');
    style(grid, { display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '4px 0' });
    const chips = [];
    for (const option of options) {
      const chip = doc.createElement('button');
      chip.type = 'button';
      chip.title = option.label;
      // Tag the chip with its option id. Use setAttribute in the browser
      // (element.dataset is a read-only accessor and cannot be reassigned);
      // fall back to a plain property for the test DOM stub.
      if (typeof chip.setAttribute === 'function') {
        chip.setAttribute('aria-label', option.label);
        chip.setAttribute('data-option-id', option.id);
      } else {
        chip.optionId = option.id;
      }
      style(chip, {
        width: '44px', height: '44px', cursor: 'pointer', borderRadius: '8px',
        background: getSwatch(option), padding: '0',
      });
      chip.addEventListener('click', () => onPick(option.id));
      chips.push({ chip, option });
      grid.appendChild(chip);
    }
    panel.appendChild(grid);
    const refresh = () => {
      for (const { chip, option } of chips) {
        const on = isActive(option.id);
        style(chip, {
          border: on ? '3px solid #243' : '2px solid rgba(0,0,0,0.25)',
          boxShadow: on ? '0 0 0 2px #fff inset' : 'none',
        });
      }
    };
    refresh();
    return refresh;
  };

  // Color tab: Ghosty color palette (Req 11).
  const colorPanel = makePanel('color');
  const colorHint = doc.createElement('p');
  colorHint.textContent = "Pick Ghosty's color.";
  style(colorHint, { margin: '4px 0 10px', color: '#789', fontSize: '13px' });
  colorPanel.appendChild(colorHint);
  let refreshColors = () => {};
  refreshColors = makeSwatchGrid(
    colorPanel,
    COLOR_PALETTE,
    (opt) => opt.color,
    (id) => id === appearance.colorId,
    (id) => {
      appearance = resolveAppearance({ ...appearanceSelection(), colorId: id });
      refreshColors();
      emitAppearance();
    }
  );

  // Environment tab: full scene theme (Req 16). Each chip previews sky over
  // pipe color so themes are recognizable at a glance.
  const envPanel = makePanel('environment');
  const envHint = doc.createElement('p');
  envHint.textContent = 'Choose the scene.';
  style(envHint, { margin: '4px 0 10px', color: '#789', fontSize: '13px' });
  envPanel.appendChild(envHint);
  let refreshEnvs = () => {};
  refreshEnvs = makeSwatchGrid(
    envPanel,
    ENVIRONMENTS,
    (opt) => `linear-gradient(${opt.sky} 0 60%, ${opt.pipe} 60% 100%)`,
    (id) => id === appearance.environmentId,
    (id) => {
      appearance = resolveAppearance({ ...appearanceSelection(), environmentId: id });
      refreshEnvs();
      emitAppearance();
    }
  );

  // Flair tab: one picker per slot (hat, neck). Each row offers "None" plus the
  // items in that slot; at most one item per slot (Req 12.2, 12.3, 12.8).
  const flairPanel = makePanel('flair');
  const flairHint = doc.createElement('p');
  flairHint.textContent = 'Dress up Ghosty. One item per slot.';
  style(flairHint, { margin: '4px 0 16px', color: '#789', fontSize: '13px' });
  flairPanel.appendChild(flairHint);

  const SLOT_LABELS = { hat: 'Hat', neck: 'Neck' };
  const flairRefreshers = [];
  FLAIR_SLOTS.forEach((slot, slotIndex) => {
    const slotLabel = doc.createElement('div');
    slotLabel.textContent = SLOT_LABELS[slot] || slot;
    style(slotLabel, {
      fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em',
      color: '#789', fontWeight: 'bold',
      // Extra top space to separate this slot's label from the previous row
      // (the hint already provides spacing above the first slot).
      margin: `${slotIndex === 0 ? 0 : 18}px 0 8px`,
    });
    flairPanel.appendChild(slotLabel);

    const row = doc.createElement('div');
    style(row, { display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '2px' });
    // "None" + the slot's items. `id: null` clears the slot.
    const options = [{ id: null, label: 'None' }, ...flairForSlot(slot)];
    const buttons = [];
    for (const option of options) {
      const btn = doc.createElement('button');
      btn.type = 'button';
      btn.textContent = option.label;
      if (typeof btn.setAttribute === 'function') {
        btn.setAttribute('data-flair-slot', slot);
        btn.setAttribute('data-flair-id', option.id == null ? '' : option.id);
      } else {
        btn.flairSlot = slot;
        btn.flairId = option.id;
      }
      style(btn, {
        cursor: 'pointer', fontSize: '12px', padding: '6px 10px',
        border: '1px solid #cbd5d0', borderRadius: '6px', background: '#f1f5f3', color: '#345',
      });
      btn.addEventListener('click', () => {
        appearance = resolveAppearance({
          ...appearanceSelection(),
          flair: { ...appearance.flairIds, [slot]: option.id },
        });
        for (const fr of flairRefreshers) fr();
        emitAppearance();
      });
      buttons.push({ btn, option });
      row.appendChild(btn);
    }
    flairPanel.appendChild(row);

    const refresh = () => {
      for (const { btn, option } of buttons) {
        const on = (appearance.flairIds[slot] || null) === option.id;
        style(btn, {
          background: on ? '#4caf3e' : '#f1f5f3',
          color: on ? '#fff' : '#345',
          fontWeight: on ? 'bold' : 'normal',
          borderColor: on ? '#4caf3e' : '#cbd5d0',
        });
      }
    };
    refresh();
    flairRefreshers.push(refresh);
  });

  // Settings tab (the live-tunable parameters). Each field is a slider: a top
  // line shows the label on the left and the live value on the right (a bare
  // slider hides its number), then the slider with its min/max as small, light
  // endpoint captions. The readout updates while dragging; the clamped value is
  // reflected when the drag settles.
  const settingsPanel = makePanel('settings');
  const inputs = new Map();
  const valueReadouts = new Map();
  for (const field of TUNABLE) {
    const block = doc.createElement('div');
    style(block, { margin: '12px 0' });

    // Top line: label (left) + live value (right).
    const head = doc.createElement('div');
    style(head, {
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      fontSize: '13px',
    });
    const label = doc.createElement('label');
    label.textContent = field.label;
    style(label, { color: '#345' });
    const valueEl = doc.createElement('span');
    valueEl.textContent = String(defaults[field.key]);
    style(valueEl, { color: '#2e7d22', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums' });
    head.appendChild(label);
    head.appendChild(valueEl);

    // Slider line: min caption, range slider, max caption.
    const sliderRow = doc.createElement('div');
    style(sliderRow, { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' });
    const minCap = doc.createElement('span');
    minCap.textContent = String(field.min);
    const maxCap = doc.createElement('span');
    maxCap.textContent = String(field.max);
    for (const cap of [minCap, maxCap]) {
      style(cap, { fontSize: '10px', color: '#9aa7a0', flex: '0 0 auto' });
    }

    const inputEl = doc.createElement('input');
    inputEl.type = 'range';
    inputEl.min = String(field.min);
    inputEl.max = String(field.max);
    inputEl.step = String(field.step);
    inputEl.value = String(defaults[field.key]);
    style(inputEl, { flex: '1 1 auto', cursor: 'pointer', accentColor: '#4caf3e' });
    if (typeof inputEl.setAttribute === 'function') {
      inputEl.setAttribute('aria-label', `${field.label} (${field.min} to ${field.max})`);
    }

    // Live readout while dragging (no clamping needed: the slider is bounded).
    inputEl.addEventListener('input', () => {
      valueEl.textContent = inputEl.value;
    });
    // On settle, route through config.js and reflect the clamped value.
    inputEl.addEventListener('change', () => {
      live[field.key] = Number(inputEl.value);
      const effective = onChange({ ...live });
      inputEl.value = String(effective[field.key]);
      valueEl.textContent = String(effective[field.key]);
    });

    inputs.set(field.key, inputEl);
    valueReadouts.set(field.key, valueEl);
    sliderRow.appendChild(minCap);
    sliderRow.appendChild(inputEl);
    sliderRow.appendChild(maxCap);
    block.appendChild(head);
    block.appendChild(sliderRow);
    settingsPanel.appendChild(block);
  }

  const resetBtn = doc.createElement('button');
  resetBtn.textContent = 'Reset to defaults';
  style(resetBtn, {
    marginTop: '10px', cursor: 'pointer', fontSize: '13px', padding: '6px 12px',
    border: '1px solid #cbd5d0', borderRadius: '6px', background: '#f1f5f3', color: '#345',
  });
  resetBtn.addEventListener('click', () => {
    for (const key of Object.keys(live)) delete live[key];
    const effective = onChange({});
    for (const [key, el] of inputs) el.value = String(effective[key]);
    for (const [key, el] of valueReadouts) el.textContent = String(effective[key]);
  });
  settingsPanel.appendChild(resetBtn);

  if (mount) mount.appendChild(overlay);
  selectTab(activeTab);

  // --- Visibility & keys --------------------------------------------------
  function setVisible(v) {
    visible = v;
    overlay.style.display = v ? 'flex' : 'none';
  }

  const onKey = (event) => {
    if (event.key === '`' || event.code === 'Backquote') setVisible(!visible);
    else if (visible && (event.key === 'Escape' || event.code === 'Escape')) setVisible(false);
  };
  if (keyTarget && keyTarget.addEventListener) keyTarget.addEventListener('keydown', onKey);

  return {
    toggle() { setVisible(!visible); },
    show() { setVisible(true); },
    hide() { setVisible(false); },
    isVisible() { return visible; },
    selectTab,
    activeTab() { return activeTab; },
    appearance() {
      return {
        colorId: appearance.colorId,
        environmentId: appearance.environmentId,
        flair: { ...appearance.flairIds },
      };
    },
    destroy() {
      if (keyTarget && keyTarget.removeEventListener) keyTarget.removeEventListener('keydown', onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    },
  };
}
