import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {phonemes, clipIds} from '../content.js';
import '../pinyin-content.js';

const workerCode = await fs.readFile(new URL('../sw.js', import.meta.url), 'utf8');

function worker({fetcher = async () => { throw new TypeError('offline'); }, failInstall = false} = {}) {
  const handlers = new Map();
  const stores = new Map();
  const deleted = [];
  let skipped = false;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      const key = request => typeof request === 'string' ? request : request.url;
      return {
        async addAll(requests) {
          if (failInstall) throw new Error('Download interrupted');
          for (const request of requests) {
            const url = key(request);
            const filename = new URL(url).pathname.split('/').at(-1);
            store.set(url, new Response(filename.endsWith('.html') ? `<html>saved ${filename}</html>` : 'asset'));
          }
        },
        async match(request) { return store.get(key(request))?.clone(); },
        async put(request, response) { store.set(key(request), response); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { deleted.push(name); return stores.delete(name); },
  };
  vm.runInNewContext(workerCode, {URL, Request, Response, Headers, caches, fetch: fetcher, self: {
    location: {href: 'https://example.test/family-english/sw.js'},
    addEventListener(name, handler) { handlers.set(name, handler); },
    async skipWaiting() { skipped = true; }, clients: {async claim() {}},
  }});
  return {
    stores, deleted, get skipped() { return skipped; },
    async lifecycle(name) {
      let pending;
      handlers.get(name)({waitUntil(promise) { pending = promise; }});
      return pending;
    },
    request(path, method = 'GET', headers = {}) {
      let result;
      handlers.get('fetch')({request: new Request(new URL(path, 'https://example.test'), {method, headers}), respondWith(promise) { result = promise; }});
      return result;
    },
  };
}

test('content uses 44 distinct sounds and 3–5 words each; repeated words share clip IDs', () => {
  assert.equal(phonemes.length, 44);
  assert.equal(phonemes.filter(p => p.group === 'vowel').length, 20);
  assert.equal(phonemes.filter(p => p.group === 'consonant').length, 24);
  assert.equal(new Set(phonemes.map(p => p.ipa)).size, 44);
  for (const phoneme of phonemes) {
    assert.ok(phoneme.words.length >= 3 && phoneme.words.length <= 5);
    for (const word of phoneme.words) {
      assert.ok(word.meaning);
      assert.equal(word.marked.replace(/[\[\]]/g, ''), word.word);
      assert.match(word.id, /^word-[a-z]+$/);
    }
  }
  assert.equal(new Set(clipIds).size, clipIds.length);
});

test('the offline shell includes only files that exist, including home-screen PNGs', async () => {
  const w = worker();
  await w.lifecycle('install');
  for (const url of [...w.stores.values()][0].keys()) {
    const relative = new URL(url).pathname.replace('/family-english/', '');
    if (relative) assert.ok((await fs.stat(new URL(`../${relative}`, import.meta.url))).isFile(), relative);
  }
  assert.equal(w.skipped, false);
});

test('pinyin groups, tone examples, and all referenced audio match the packaged files', async () => {
  const lessons = globalThis.pinyinLessons;
  const counts = lessons.reduce((groups, lesson) => groups.set(lesson.group, (groups.get(lesson.group) || 0) + 1), new Map());
  assert.deepEqual([...counts], [['initial', 23], ['final', 24], ['syllable', 16], ['tone', 4]]);
  assert.equal(new Set(lessons.map(lesson => lesson.id)).size, lessons.length);
  assert.deepEqual(lessons.filter(lesson => lesson.group === 'tone').map(lesson => lesson.demoClip), ['ma1', 'ma2', 'ma3', 'ma4']);
  for (const lesson of lessons) {
    assert.ok(lesson.demoClip && lesson.exampleClip, lesson.id);
    if (lesson.group === 'syllable') {
      assert.equal(lesson.demoClip, `${lesson.symbol}1`, lesson.id);
      assert.match(lesson.demoSpelling.normalize('NFD'), /\u0304/, lesson.id);
    }
    if (lesson.demoClip === lesson.exampleClip && lesson.group !== 'tone') {
      assert.equal(lesson.demoSpelling, lesson.spelling, lesson.id);
    }
  }
  for (const [id, demoClip, exampleClip, demoSpelling] of [
    ['initial-s', 'bop-21', 'san1', undefined],
    ['final-ui', 'wei1', 'shui3', 'wēi'],
    ['final-iu', 'you1', 'niu2', 'yōu'],
    ['final-ie', 'ye1', 'ye4', 'yē'],
    ['final-üe', 'yue1', 'yue4', 'yuē'],
    ['final-un', 'wen1', 'lun2', 'wēn'],
    ['final-ün', 'yun1', 'yun2', 'yūn'],
    ['final-ing', 'ying1', 'xing1', 'yīng'],
    ['final-ong', 'final-ong', 'dong1', undefined],
    ['syllable-chi', 'chi1', 'chi3', 'chī'],
    ['syllable-shi', 'shi1', 'shi2', 'shī'],
    ['syllable-ri', 'ri1', 'ri4', 'rī'],
  ]) {
    const lesson = lessons.find(lesson => lesson.id === id);
    assert.deepEqual([lesson.demoClip, lesson.exampleClip, lesson.demoSpelling], [demoClip, exampleClip, demoSpelling], id);
  }
  const expected = [...new Set(lessons.flatMap(lesson => [lesson.demoClip, lesson.exampleClip]))].sort();
  const directory = new URL('../audio/pinyin/', import.meta.url);
  const {clips} = JSON.parse(await fs.readFile(new URL('manifest.json', directory), 'utf8'));
  assert.deepEqual(Object.keys(clips).sort(), expected);
  assert.equal(clips['final-ong'].sourceFile, 'cmn-song1.mp3');
  assert.deepEqual(clips['final-ong'].trimSeconds, [0.53, 0.93]);
  for (const id of expected) {
    const bytes = await fs.readFile(new URL(`${id}.mp3`, directory));
    assert.ok(bytes.length > 0, id);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), clips[id].sha256, id);
  }
});

test('interrupted shell installation rejects before activating a broken offline page', async () => {
  const w = worker({failInstall: true});
  await assert.rejects(w.lifecycle('install'), /interrupted/);
  assert.equal(w.skipped, false);
});

test('HTML and module dependencies use the current release URLs and are all cached offline', async () => {
  const w = worker();
  await w.lifecycle('install');
  const [name, entries] = [...w.stores.entries()][0];
  const version = name.split(':').at(-1);
  const pages = ['index.html', 'phonics.html', 'pinyin.html', 'audio-sources.html'];
  const html = (await Promise.all(pages.map(page => fs.readFile(new URL(`../${page}`, import.meta.url), 'utf8')))).join('\n');
  const app = await fs.readFile(new URL('../app.js', import.meta.url), 'utf8');
  const dependencies = new Set([
    ...[...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css)\?v=[^"]+)"/g)].map(match => match[1]),
    ...[...app.matchAll(/^import .+ from '([^']+)'/gm)].map(match => match[1]),
  ]);
  assert.equal(dependencies.size, 7);
  for (const dependency of dependencies) {
    const url = new URL(dependency, 'https://example.test/family-english/');
    assert.equal(url.searchParams.get('v'), version, dependency);
    assert.ok(entries.has(url.href), dependency);
  }
});

test('offline navigation works under a GitHub Pages repository subdirectory', async () => {
  const w = worker();
  await w.lifecycle('install');
  for (const [path, filename] of [['', 'index.html'], ['index.html', 'index.html'], ['phonics.html', 'phonics.html'], ['pinyin.html', 'pinyin.html']]) {
    const response = await w.request(`/family-english/${path}?from=homescreen`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), `<html>saved ${filename}</html>`);
  }
});

test('an active worker keeps serving its installed pages when newer HTML is available', async () => {
  let requests = 0;
  const w = worker({fetcher: async () => { requests++; return new Response('<script src="app.js?v=new"></script>'); }});
  await w.lifecycle('install');
  for (const path of ['/family-english/', '/family-english/phonics.html']) {
    const response = await w.request(path);
    assert.match(await response.text(), /saved (index|phonics)\.html/);
  }
  assert.equal(requests, 0);
});

test('saved audio plays offline and an audio version change does not return stale audio', async () => {
  const w = worker();
  const store = new Map([['https://example.test/family-english/audio/cat.mp3?v=1', new Response('MP3DATA')]]);
  w.stores.set('little-sounds-audio:/family-english/', store);
  const saved = await w.request('/family-english/audio/cat.mp3?v=1');
  assert.equal(await saved.text(), 'MP3DATA');
  const missing = await w.request('/family-english/audio/cat.mp3?v=2');
  assert.equal(missing.status, 503);
  assert.doesNotMatch(await missing.text(), /html/i);
});

test('missing JS files, third-party URLs, sibling apps and POST requests are not intercepted', () => {
  const w = worker();
  for (const path of ['/family-english/missing.js', '/other-app/', 'https://other.test/family-english/', '/family-english-2/']) {
    assert.equal(w.request(path), undefined, path);
  }
  assert.equal(w.request('/family-english/', 'POST'), undefined);
});

test('offline audio supports the byte probes and suffix requests used by mobile browsers', async () => {
  const w = worker();
  w.stores.set('little-sounds-audio:/family-english/', new Map([
    ['https://example.test/family-english/audio/cat.mp3?v=2', new Response('0123456789', {headers: {'Content-Type': 'audio/mpeg'}})],
  ]));
  for (const [range, expected, contentRange] of [
    ['bytes=0-1', '01', 'bytes 0-1/10'],
    ['bytes=5-', '56789', 'bytes 5-9/10'],
    ['bytes=-3', '789', 'bytes 7-9/10'],
    ['bytes=8-100', '89', 'bytes 8-9/10'],
  ]) {
    const response = await w.request('/family-english/audio/cat.mp3?v=2', 'GET', {Range: range});
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), contentRange);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.equal(await response.text(), expected);
  }
  for (const range of ['bytes=20-', 'bytes=8-2', 'bytes=-0']) {
    const response = await w.request('/family-english/audio/cat.mp3?v=2', 'GET', {Range: range});
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('content-range'), 'bytes */10');
  }
});

test('every displayed phoneme and word has a distinct local audio mapping with matching content hash', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('../audio/manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(manifest.clips).sort(), [...clipIds].sort());
  assert.equal(new Set(Object.values(manifest.clips).map(clip => clip.path)).size, clipIds.length);
  for (const id of clipIds) {
    const clip = manifest.clips[id];
    const bytes = await fs.readFile(new URL(`../${clip.path}`, import.meta.url));
    assert.equal(bytes.length, clip.bytes, id);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), clip.sha256, id);
    if (id.startsWith('word-')) assert.equal(clip.sourceFile.toLowerCase(), `${id}.mp3`, id);
  }
});

test('upstream lessons distinguish the j glide from the dzh affricate and exclude recording IDs from words', async () => {
  const manifest = JSON.parse(await fs.readFile(new URL('../audio/manifest.json', import.meta.url), 'utf8'));
  const lessons = JSON.parse(await fs.readFile(new URL('../audio/lesson-mapping.json', import.meta.url), 'utf8'));
  assert.equal(manifest.clips['phoneme-y'].sourceFile, 'word-consonant_j.mp3');
  assert.equal(manifest.clips['phoneme-j'].sourceFile, 'word-consonant_7.mp3');
  assert.equal(new Set(lessons.map(lesson => lesson.sourceLessonId)).size, 44);
  for (const phoneme of phonemes) {
    const lesson = lessons.find(lesson => lesson.id === phoneme.id);
    assert.ok(lesson, phoneme.id);
    assert.equal(lesson.ipa, phoneme.ipa);
    assert.deepEqual(lesson.selectedExamples, phoneme.words.map(word => word.word));
    assert.ok(lesson.sourceExamples.every(word => !word.includes('_')));
  }
});

test('worker activation preserves other sites and downloaded audio', async () => {
  const w = worker();
  for (const name of ['little-sounds-shell:/family-english/:0', 'little-sounds-shell:/other-app/:0', 'other-site-cache', 'little-sounds-audio:/family-english/']) w.stores.set(name, new Map());
  await w.lifecycle('activate');
  assert.deepEqual(w.deleted, ['little-sounds-shell:/family-english/:0']);
  assert.ok(w.stores.has('little-sounds-audio:/family-english/'));
});

test('online manifest refresh is cached and remains available after network and server failures', async () => {
  let status = 200;
  const w = worker({fetcher: async () => {
    if (status === 0) throw new TypeError('offline');
    return Response.json({version: status === 200 ? '2' : 'error', clips: {}}, {status});
  }});
  const fresh = await w.request('/family-english/audio/manifest.json');
  assert.equal((await fresh.json()).version, '2');
  for (const failedStatus of [503, 0]) {
    status = failedStatus;
    const cached = await w.request('/family-english/audio/manifest.json');
    assert.equal(cached.status, 200);
    assert.equal((await cached.json()).version, '2');
  }
});
