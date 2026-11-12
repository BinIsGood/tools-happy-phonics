/* Increase VERSION whenever publishing changes to the page, content or icons. */
const VERSION = '6';
const BASE = new URL('./', self.location.href);
const PREFIX = `little-sounds-shell:${BASE.pathname}:`;
const SHELL = `${PREFIX}${VERSION}`;
const AUDIO = `little-sounds-audio:${BASE.pathname}`;
const FILES = ['./', './index.html', './audio-sources.html', './THIRD_PARTY_NOTICES.txt', './styles.css?v=6', './app.js?v=6', './content.js?v=6', './audio-library.js?v=6', './manifest.webmanifest', './audio/manifest.json', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const SHELL_URLS = new Set(FILES.map(path => new URL(path, BASE).href));

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
    await cache.addAll([...SHELL_URLS]);
    await self.skipWaiting();
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
  // Limit navigation fallback to our own entry points, never mask missing files with HTML.
  const isEntry = url.pathname === BASE.pathname || url.pathname === `${BASE.pathname}index.html`;
  const isManifest = url.pathname === `${BASE.pathname}audio/manifest.json`;
  if (isEntry || isManifest) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const key = isManifest ? new URL('./audio/manifest.json', BASE).href : new URL('./index.html', BASE).href;
      try {
        const response = await fetch(request);
        if (response.ok && response.type !== 'opaque') await cache.put(key, response.clone());
        return response;
      } catch { return (await cache.match(key)) || new Response('Please connect once to prepare offline learning.', {status: 503}); }
    })());
    return;
  }
  if (SHELL_URLS.has(url.href)) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      return (await cache.match(request)) || fetch(request);
    })());
  }
});
