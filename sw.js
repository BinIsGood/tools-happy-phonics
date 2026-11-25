/* Increase VERSION whenever publishing changes to the page, content or icons. */
const VERSION = '13';
const BASE = new URL('./', self.location.href);
const PREFIX = `little-sounds-shell:${BASE.pathname}:`;
const SHELL = `${PREFIX}${VERSION}`;
const AUDIO = `little-sounds-audio:${BASE.pathname}`;
const HOME = new URL('./index.html', BASE).href;
const MANIFEST = new URL('./audio/manifest.json', BASE).href;
const PAGES = new Set([HOME, ...['./phonics.html', './pinyin.html', './audio-sources.html'].map(path => new URL(path, BASE).href)]);
const FILES = [
  './THIRD_PARTY_NOTICES.txt', './manifest.webmanifest', './icons/icon.svg',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];
const VERSIONED_FILES = ['./styles.css', './navigation.js', './app.js', './content.js', './audio-library.js', './pinyin-content.js', './pinyin.js'];
const SHELL_URLS = new Set([
  ...PAGES, MANIFEST,
  ...FILES.map(path => new URL(path, BASE).href),
  ...VERSIONED_FILES.map(path => new URL(`${path}?v=${VERSION}`, BASE).href),
]);

// Safari may request only a byte range when loading an audio element, including offline.
async function savedAudioResponse(request, response) {
  const range = request.headers.get('range');
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  const headers = new Headers(response.headers);
  headers.set('Accept-Ranges', 'bytes');
  if (!match || (!match[1] && !match[2])) return new Response(response.body, {status: response.status, headers});
  const buffer = await response.arrayBuffer();
  const length = buffer.byteLength;
  const start = match[1] ? Number(match[1]) : Math.max(0, length - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= length || end < start || (!match[1] && Number(match[2]) === 0)) {
    headers.set('Content-Range', `bytes */${length}`);
    headers.delete('Content-Length');
    return new Response(null, {status: 416, headers});
  }
  headers.set('Content-Range', `bytes ${start}-${end}/${length}`);
  headers.set('Content-Length', String(end - start + 1));
  return new Response(buffer.slice(start, end + 1), {status: 206, headers});
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll([...SHELL_URLS].map(url => new Request(url, {cache: 'reload'})));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== SHELL).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  if (url.pathname.startsWith(`${BASE.pathname}audio/`) && url.pathname !== `${BASE.pathname}audio/manifest.json`) {
    event.respondWith((async () => {
      const cache = await caches.open(AUDIO);
      const saved = await cache.match(request);
      if (saved) return savedAudioResponse(request, saved);
      try { return await fetch(request); }
      catch { return new Response('', {status: 503, statusText: 'Audio not saved for offline use'}); }
    })());
    return;
  }
  const canonical = `${url.origin}${url.pathname}`;
  if (canonical === MANIFEST) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      let response;
      try {
        response = await fetch(request);
        if (response.ok && response.type !== 'opaque') {
          await cache.put(MANIFEST, response.clone());
          return response;
        }
      } catch {}
      return (await cache.match(MANIFEST)) || response || new Response('Audio list unavailable', {status: 503});
    })());
    return;
  }
  const page = url.pathname === BASE.pathname ? HOME : canonical;
  const cacheKey = PAGES.has(page) ? page : url.href;
  if (SHELL_URLS.has(cacheKey)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      return (await cache.match(cacheKey)) || fetch(request);
    })());
  }
});
