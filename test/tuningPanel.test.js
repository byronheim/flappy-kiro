// Smoke test for the tuning panel with a synthetic DOM.
// Design "Testing Strategy > Integration and smoke tests" (tuning panel).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG as DEFAULTS } from '../src/core/constants.js';
import { withLiveOverrides } from '../src/shell/config.js';
import { createTuningPanel } from '../src/shell/tuningPanel.js';

// Minimal synthetic DOM sufficient for the panel.
function makeDom() {
  function makeEl(tag) {
    const listeners = new Map();
    return {
      tagName: tag,
      style: {},
      children: [],
      parentNode: null,
      value: '',
      textContent: '',
      type: '',
      min: '',
      max: '',
      step: '',
      id: '',
      // Mirror the browser: dataset is a read-only accessor populated via
      // setAttribute('data-*'); the panel must never reassign it directly.
      dataset: {},
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
        const m = /^data-(.+)$/.exec(name);
        if (m) {
          const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          this.dataset[key] = value;
        }
      },
      getAttribute(name) {
        return name in this.attributes ? this.attributes[name] : null;
      },
      appendChild(child) {
        this.children.push(child);
        child.parentNode = this;
      },
      removeChild(child) {
        this.children = this.children.filter((c) => c !== child);
        child.parentNode = null;
      },
      addEventListener(type, fn) {
        const arr = listeners.get(type) || [];
        arr.push(fn);
        listeners.set(type, arr);
      },
      removeEventListener(type, fn) {
        const arr = listeners.get(type) || [];
        listeners.set(type, arr.filter((f) => f !== fn));
      },
      dispatch(type, event) {
        for (const fn of listeners.get(type) || []) fn(event || {});
      },
    };
  }
  const body = makeEl('body');
  const doc = {
    body,
    createElement: (tag) => makeEl(tag),
  };
  return { doc };
}

function makeKeyTarget() {
  const listeners = new Map();
  return {
    addEventListener: (t, fn) => {
      const arr = listeners.get(t) || [];
      arr.push(fn);
      listeners.set(t, arr);
    },
    removeEventListener: (t, fn) => {
      const arr = listeners.get(t) || [];
      listeners.set(t, arr.filter((f) => f !== fn));
    },
    dispatch: (t, e) => {
      for (const fn of listeners.get(t) || []) fn(e);
    },
  };
}

function findInput(panelRoot, predicate) {
  // Walk the tree to find the number input matching predicate.
  const stack = [panelRoot];
  while (stack.length) {
    const el = stack.pop();
    if (el.type === 'number' && predicate(el)) return el;
    for (const c of el.children || []) stack.push(c);
  }
  return null;
}

test('panel is hidden on mount and toggles open on the backtick key', () => {
  const { doc } = makeDom();
  const keyTarget = makeKeyTarget();
  const panel = createTuningPanel({
    onChange: (raw) => withLiveOverrides(raw, { global: {}, search: '' }),
    defaults: DEFAULTS,
    doc,
    keyTarget,
  });
  assert.equal(panel.isVisible(), false);
  keyTarget.dispatch('keydown', { key: '`', code: 'Backquote' });
  assert.equal(panel.isVisible(), true);
  keyTarget.dispatch('keydown', { key: '`', code: 'Backquote' });
  assert.equal(panel.isVisible(), false);
  panel.destroy();
});

test('dialog has Color, Flair, and Settings tabs and can switch between them', () => {
  const { doc } = makeDom();
  const keyTarget = makeKeyTarget();
  const panel = createTuningPanel({
    onChange: (raw) => withLiveOverrides(raw, { global: {}, search: '' }),
    defaults: DEFAULTS,
    doc,
    keyTarget,
  });

  // Collect tab button labels present in the tree.
  const labels = [];
  const stack = [doc.body.children[0]];
  while (stack.length) {
    const el = stack.pop();
    if (el.tagName === 'button') labels.push(el.textContent);
    for (const c of el.children || []) stack.push(c);
  }
  assert.ok(labels.includes('Color'));
  assert.ok(labels.includes('Environment'));
  assert.ok(labels.includes('Flair'));
  assert.ok(labels.includes('Settings'));

  // Default tab is Color; switching updates the active tab.
  assert.equal(panel.activeTab(), 'color');
  panel.selectTab('settings');
  assert.equal(panel.activeTab(), 'settings');
  panel.selectTab('environment');
  assert.equal(panel.activeTab(), 'environment');
  panel.destroy();
});

test('picking a color swatch fires onAppearanceChange and updates the panel selection', () => {
  const { doc } = makeDom();
  const keyTarget = makeKeyTarget();
  const changes = [];
  const panel = createTuningPanel({
    onChange: (raw) => withLiveOverrides(raw, { global: {}, search: '' }),
    defaults: DEFAULTS,
    appearance: { colorId: 'ghost', environmentId: 'sky' },
    onAppearanceChange: (sel) => changes.push(sel),
    doc,
    keyTarget,
  });

  // Find a color chip by its data-option-id and click it.
  const panelRoot = doc.body.children[0];
  const stack = [panelRoot];
  let blueChip = null;
  while (stack.length) {
    const el = stack.pop();
    if (el.tagName === 'button' && el.dataset && el.dataset.optionId === 'blue') blueChip = el;
    for (const c of el.children || []) stack.push(c);
  }
  assert.ok(blueChip, 'expected a blue color swatch');
  blueChip.dispatch('click');

  assert.equal(changes.length, 1);
  assert.equal(changes[0].colorId, 'blue');
  assert.equal(changes[0].environmentId, 'sky');
  assert.equal(panel.appearance().colorId, 'blue');
  panel.destroy();
});

test('picking an environment swatch fires onAppearanceChange with the full selection', () => {
  const { doc } = makeDom();
  const keyTarget = makeKeyTarget();
  const changes = [];
  const panel = createTuningPanel({
    onChange: (raw) => withLiveOverrides(raw, { global: {}, search: '' }),
    defaults: DEFAULTS,
    appearance: { colorId: 'gold', environmentId: 'sky' },
    onAppearanceChange: (sel) => changes.push(sel),
    doc,
    keyTarget,
  });

  const panelRoot = doc.body.children[0];
  const stack = [panelRoot];
  let forestChip = null;
  while (stack.length) {
    const el = stack.pop();
    if (el.tagName === 'button' && el.dataset && el.dataset.optionId === 'forest') forestChip = el;
    for (const c of el.children || []) stack.push(c);
  }
  assert.ok(forestChip, 'expected a forest environment swatch');
  forestChip.dispatch('click');

  assert.equal(changes.length, 1);
  assert.equal(changes[0].colorId, 'gold'); // preserved
  assert.equal(changes[0].environmentId, 'forest');
  assert.equal(panel.appearance().environmentId, 'forest');
  panel.destroy();
});

test('an invalid persisted appearance resolves to defaults in the panel', () => {
  const { doc } = makeDom();
  const keyTarget = makeKeyTarget();
  const panel = createTuningPanel({
    onChange: (raw) => withLiveOverrides(raw, { global: {}, search: '' }),
    defaults: DEFAULTS,
    appearance: { colorId: 'bogus', environmentId: 'nope' },
    doc,
    keyTarget,
  });
  assert.equal(panel.appearance().colorId, 'ghost');
  assert.equal(panel.appearance().environmentId, 'sky');
  panel.destroy();
});

test('editing a field routes through config.js and reflects the clamped value', () => {
  const { doc } = makeDom();
  const keyTarget = makeKeyTarget();
  let lastEffective = null;
  createTuningPanel({
    onChange: (raw) => {
      lastEffective = withLiveOverrides(raw, { global: {}, search: '' });
      return lastEffective;
    },
    defaults: DEFAULTS,
    doc,
    keyTarget,
  });

  const panelRoot = doc.body.children[0];
  const gravityInput = findInput(panelRoot, (el) => el.max === '2400');
  assert.ok(gravityInput, 'gravity input exists');

  // Type an out-of-range value; it must clamp to 2400 on screen.
  gravityInput.value = '99999';
  gravityInput.dispatch('change');
  assert.equal(lastEffective.GRAVITY, 2400);
  assert.equal(gravityInput.value, '2400');
});

test('reset to defaults restores default values', () => {
  const { doc } = makeDom();
  const keyTarget = makeKeyTarget();
  createTuningPanel({
    onChange: (raw) => withLiveOverrides(raw, { global: {}, search: '' }),
    defaults: DEFAULTS,
    doc,
    keyTarget,
  });

  const panelRoot = doc.body.children[0];
  const gravityInput = findInput(panelRoot, (el) => el.max === '2400');
  gravityInput.value = '2000';
  gravityInput.dispatch('change');
  assert.equal(gravityInput.value, '2000');

  // Find and click the reset button by its label text (robust to added tabs).
  const stack = [panelRoot];
  let resetBtn = null;
  while (stack.length) {
    const el = stack.pop();
    if (el.tagName === 'button' && el.textContent === 'Reset to defaults') resetBtn = el;
    for (const c of el.children || []) stack.push(c);
  }
  assert.ok(resetBtn);
  resetBtn.dispatch('click');
  assert.equal(gravityInput.value, String(DEFAULTS.GRAVITY));
});
