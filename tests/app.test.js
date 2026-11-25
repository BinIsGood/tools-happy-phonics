import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {phonemes, clipIds} from '../content.js';
import {createAudioLibrary} from '../audio-library.js';

const html = await fs.readFile(new URL('../phonics.html', import.meta.url), 'utf8');
const source = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
const manifest = JSON.parse(await fs.readFile(new URL('../audio/manifest.json', import.meta.url), 'utf8'));
const base = 'https://example.test/family-english/';
const settle = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };

async function page(t, initialManifest) {
  const {document, Event} = parseHTML(html);
  const events = document.createElement('window');
  const played = [];
  const timers = new Set();
  let currentManifest = initialManifest;
  const fetcher = async () => currentManifest === null ? new Response(null, {status: 503}) : Response.json(currentManifest);
  const window = {isSecureContext: false, addEventListener: events.addEventListener.bind(events)};
  class Audio {
    addEventListener() {}
    pause() {}
    removeAttribute() { this.src = ''; }
    load() {}
    play() { played.push(this.src); return Promise.resolve(); }
  }
  const code = source.replace(/^import .+;$/gm, '').replaceAll('import.meta.url', JSON.stringify(`${base}app.js`));
  vm.runInNewContext(code, {
    document, window, navigator: {}, Audio, URL, phonemes, clipIds,
    createAudioLibrary: options => createAudioLibrary({...options, fetcher}),
    localStorage: {getItem: () => null, setItem() {}},
    setTimeout(callback, delay) { const timer = setTimeout(callback, delay); timers.add(timer); return timer; },
    clearTimeout,
  });
  t.after(() => { for (const timer of timers) clearTimeout(timer); });
  await settle();
  return {
    document, played,
    setManifest(value) { currentManifest = value; },
    failManifest() { currentManifest = null; },
    focus() { events.dispatchEvent(new Event('focus')); },
  };
}

test('every rendered sound and word button selects a real recording in the actual app code', async t => {
  const app = await page(t, manifest);
  const buttons = [...app.document.querySelectorAll('.phoneme-button, .word-button')];
  assert.equal(buttons.length, 44 + 44 * 3);
  assert.equal(app.document.querySelector('#audio-notice').hidden, true);
  for (const button of buttons) button.click();
  await settle();
  assert.equal(app.played.length, buttons.length);
  for (let i = 0; i < buttons.length; i++) {
    const id = buttons[i].dataset.clip;
    assert.equal(app.played[i], `${base}${manifest.clips[id].path}?v=${manifest.version}`, id);
  }
});

test('returning to an open empty page refreshes its audio list before clicking', async t => {
  const app = await page(t, {version: '1', clips: {}});
  assert.equal(app.document.querySelector('#audio-notice').hidden, false);
  app.setManifest(manifest);
  app.focus();
  await settle();
  app.document.querySelector('[data-clip="phoneme-ee"]').click();
  await settle();
  assert.equal(app.played.length, 1);
  assert.equal(app.document.querySelector('#audio-notice').hidden, true);
});

test('a missing clip triggers a fresh lookup and works on the next tap', async t => {
  const app = await page(t, {version: '1', clips: {}});
  const button = app.document.querySelector('[data-clip="word-bee"]');
  app.setManifest(manifest);
  button.click();
  await settle();
  assert.match(app.document.querySelector('#toast').textContent, /发音已准备好/);
  button.click();
  await settle();
  assert.equal(app.played.length, 1);
  assert.equal(app.played[0], `${base}${manifest.clips['word-bee'].path}?v=${manifest.version}`);
});

test('a failed refresh keeps the notice consistent with complete or partial audio', async t => {
  for (const clips of [manifest.clips, {'phoneme-ee': manifest.clips['phoneme-ee']}]) {
    const app = await page(t, {...manifest, clips});
    const notice = app.document.querySelector('#audio-notice');
    const before = [notice.hidden, notice.textContent];
    app.failManifest();
    app.focus();
    await settle();
    assert.deepEqual([notice.hidden, notice.textContent], before);
    app.document.querySelector('[data-clip="phoneme-ee"]').click();
    assert.equal(app.played.length, 1);
  }
});

test('a first load failure shows an error until the manifest is available', async t => {
  const app = await page(t, null);
  const notice = app.document.querySelector('#audio-notice');
  assert.equal(notice.hidden, false);
  assert.match(notice.textContent, /暂时没有读到发音列表/);
  app.setManifest({clips: {}});
  app.focus();
  await settle();
  assert.match(notice.textContent, /发音素材准备中/);
});
