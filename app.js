import {phonemes, clipIds} from './content.js?v=4';
import {createAudioLibrary} from './audio-library.js?v=4';

const $ = selector => document.querySelector(selector);
const base = new URL('./', import.meta.url);
const audioCacheName = `little-sounds-audio:${base.pathname}`;
const audio = new Audio();
audio.preload = 'none';
const library = createAudioLibrary({base, clipIds});
let clips = new Map();
let manifestLoaded = false;
let filter = 'all';
let query = '';
let playSequence = 0;
let activeButton;
let toastTimer;
let offlineReady = false;
let saving = false;
let heard = new Set();
try {
  const saved = JSON.parse(localStorage.getItem('little-sounds-heard') || '[]');
  if (Array.isArray(saved)) heard = new Set(saved.filter(id => phonemes.some(p => p.id === id)));
} catch { /* Listening works even when browser storage is unavailable. */ }

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4200);
}

function soundIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(svg.namespaceURI, 'use');
  use.setAttribute('href', '#sound');
  svg.append(use);
  return svg;
}

function stopHighlight() {
  activeButton?.classList.remove('playing');
  activeButton = undefined;
}
audio.addEventListener('ended', stopHighlight);

function updateProgress() {
  $('#learning-progress').textContent = heard.size ? `已经听过 ${heard.size} 个音标，继续探索吧！` : '今天，从一个新声音开始';
}

function playClip(id, button, phonemeId) {
  const sequence = ++playSequence;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  stopHighlight();
  if (!manifestLoaded) return toast('正在准备发音列表，请稍等一下。');
  const url = clips.get(id);
  if (!url) {
    toast('正在更新发音列表…');
    loadManifest().then(() => {
      if (sequence !== playSequence) return;
      toast(clips.has(id) ? '发音已准备好，请再点一下试听。' : '暂时没有读到这段发音，请联网刷新页面后再试。');
    });
    return;
  }
  activeButton = button;
  button.classList.add('playing');
  audio.src = url;
  // Call play directly inside the tap handler: required by mobile Safari.
  audio.play().then(() => {
    if (sequence !== playSequence) return;
    if (phonemeId) {
      heard.add(phonemeId);
      try { localStorage.setItem('little-sounds-heard', JSON.stringify([...heard])); } catch {}
      updateProgress();
    }
  }).catch(error => {
    if (sequence !== playSequence || error.name === 'AbortError') return;
    stopHighlight();
    toast(error.name === 'NotAllowedError' ? '请再点一下播放，并检查手机是否允许播放声音。' : '这段发音暂时无法播放，请联网后重试并保存到本机。');
  });
}

function markedWord(marked) {
  const fragment = document.createDocumentFragment();
  for (const part of marked.split(/(\[[^\]]+\])/)) {
    if (part.startsWith('[') && part.endsWith(']')) {
      const mark = document.createElement('mark');
      mark.textContent = part.slice(1, -1);
      fragment.append(mark);
    } else fragment.append(document.createTextNode(part));
  }
  return fragment;
}

function render() {
  const visible = phonemes.filter(item => (filter === 'all' || item.group === filter) &&
    `${item.ipa} ${item.kind} ${item.words.map(w => `${w.word} ${w.meaning}`).join(' ')}`.toLowerCase().includes(query));
  const fragment = document.createDocumentFragment();
  for (const item of visible) {
    const card = document.createElement('article');
    card.className = 'phoneme-card';
    card.dataset.group = item.group;
    const header = document.createElement('div');
    header.className = 'card-header';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'phoneme-button';
    button.dataset.clip = item.id;
    button.setAttribute('aria-label', `播放音标 /${item.ipa}/`);
    const ipa = document.createElement('span');
    ipa.className = 'ipa';
    ipa.lang = 'en';
    ipa.textContent = `/${item.ipa}/`;
    const speaker = document.createElement('span');
    speaker.className = 'phoneme-speaker';
    speaker.append(soundIcon());
    button.append(ipa, speaker);
    button.addEventListener('click', () => playClip(item.id, button, item.id));
    const label = document.createElement('span');
    label.className = 'kind-label';
    label.textContent = item.kind;
    header.append(button, label);
    const list = document.createElement('div');
    list.className = 'word-list';
    for (const word of item.words) {
      const wordButton = document.createElement('button');
      wordButton.type = 'button';
      wordButton.className = 'word-button';
      wordButton.dataset.clip = word.id;
      wordButton.setAttribute('aria-label', `播放单词 ${word.word}，${word.meaning}`);
      const copy = document.createElement('span');
      copy.className = 'word-copy';
      const spelling = document.createElement('span');
      spelling.className = 'word-spelling';
      spelling.lang = 'en';
      spelling.append(markedWord(word.marked));
      const meaning = document.createElement('span');
      meaning.className = 'word-meaning';
      meaning.textContent = word.meaning;
      copy.append(spelling, meaning);
      wordButton.append(copy, soundIcon());
      wordButton.addEventListener('click', () => playClip(word.id, wordButton));
      list.append(wordButton);
    }
    card.append(header, list);
    fragment.append(card);
  }
  $('#phoneme-grid').replaceChildren(fragment);
  $('#empty-state').hidden = visible.length !== 0;
  $('#result-count').textContent = `共 ${visible.length} 个声音 · 不用着急，慢慢听`;
}

document.querySelectorAll('[data-filter]').forEach(button => {
  button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(other => {
      const active = other === button;
      other.classList.toggle('active', active);
      other.setAttribute('aria-pressed', String(active));
    });
    render();
  });
});
$('#search-input').addEventListener('input', event => {
  query = event.target.value.trim().toLowerCase().replace(/^\/|\/$/g, '');
  render();
});
$('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
$('#close-help').addEventListener('click', () => $('#help-dialog').close());
$('#help-dialog').addEventListener('click', event => {
  if (event.target === event.currentTarget) {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close();
  }
});

async function updateOfflineStatus() {
  if (saving) return;
  const label = $('#cache-status');
  let savedCount = 0;
  if ('caches' in window && clips.size) {
    try {
      const cache = await caches.open(audioCacheName);
      const keys = new Set((await cache.keys()).map(request => request.url));
      savedCount = [...clips.values()].filter(url => keys.has(url)).length;
    } catch { /* Browsing remains available if storage is denied. */ }
  }
  if (offlineReady && savedCount === clipIds.length) label.textContent = '全部发音已保存，断网也能学';
  else if (offlineReady && savedCount > 0) label.textContent = `页面已保存 · ${savedCount} 段发音已保存到本机`;
  else if (offlineReady) label.textContent = clips.size ? '页面已保存 · 点击右侧按钮保存发音' : '页面已保存 · 发音素材待补充';
  else label.textContent = '当前可在线使用 · 离线保存需要受支持的浏览器';
}

async function loadManifest() {
  try {
    clips = await library.refresh();
    manifestLoaded = true;
    const notice = $('#audio-notice');
    notice.hidden = clips.size === clipIds.length;
    if (clips.size > 0 && clips.size < clipIds.length) {
      notice.querySelector('strong').textContent = '部分发音还在准备';
      notice.querySelector('span').textContent = `已接入 ${clips.size} 段发音，其余内容会继续补充。`;
    }
  } catch {
    manifestLoaded = true;
    $('#audio-notice').hidden = false;
    $('#audio-notice strong').textContent = '暂时没有读到发音列表';
    $('#audio-notice span').textContent = '你可以先浏览例词，联网刷新后再试试。';
  }
  await updateOfflineStatus();
}

async function prepareOfflinePage() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return updateOfflineStatus();
  let timer;
  try {
    await navigator.serviceWorker.register(new URL('./sw.js', base), {scope: base.pathname});
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Offline setup timeout')), 15000); }),
    ]);
    offlineReady = true;
  } catch { offlineReady = false; }
  finally { clearTimeout(timer); }
  await updateOfflineStatus();
}

$('#offline-button').addEventListener('click', async () => {
  if (!manifestLoaded) return toast('正在准备发音列表，请稍等一下。');
  if (!clips.size) return toast(offlineReady ? '页面已保存。发音素材接入后，就可以一起保存到本机啦。' : '发音素材还在准备；请通过 HTTPS 网页打开，以便保存离线内容。');
  if (!offlineReady || !('caches' in window)) return toast('请通过 HTTPS 网页打开，并允许浏览器保存数据后重试。');
  if (saving) return;
  saving = true;
  const button = $('#offline-button');
  button.disabled = true;
  const queue = [...new Set(clips.values())];
  let complete = 0;
  let failed = 0;
  try {
    const cache = await caches.open(audioCacheName);
    async function download() {
      while (queue.length) {
        const url = queue.shift();
        try {
          if (!(await cache.match(url))) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30000);
            try {
              const response = await fetch(url, {signal: controller.signal});
              const type = response.headers.get('content-type') || '';
              if (!response.ok || !/^(audio\/|application\/octet-stream)/i.test(type)) throw new Error('Invalid audio response');
              const bytes = await response.arrayBuffer();
              if (!bytes.byteLength) throw new Error('Empty audio response');
              await cache.put(url, new Response(bytes, {headers: {'Content-Type': type}}));
            } finally { clearTimeout(timer); }
          }
          complete++;
        } catch { failed++; }
        $('#cache-status').textContent = `正在保存发音 ${complete + failed} / ${clips.size}…`;
      }
    }
    await Promise.all(Array.from({length: Math.min(3, queue.length)}, download));
    toast(failed ? `保存了 ${complete} 段发音，还有 ${failed} 段未完成。稍后可以继续保存。` : clips.size === clipIds.length ? '全部保存好啦，断网也可以听！' : `已保存现有的 ${complete} 段发音，其余素材仍在准备。`);
  } catch { toast('暂时无法保存，请检查设备剩余空间或浏览器设置后重试。'); }
  finally {
    saving = false;
    button.disabled = false;
    await updateOfflineStatus();
  }
});

render();
updateProgress();
loadManifest();
prepareOfflinePage();
window.addEventListener('online', loadManifest);
window.addEventListener('focus', loadManifest);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') loadManifest();
});
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', loadManifest);
window.addEventListener('offline', updateOfflineStatus);
