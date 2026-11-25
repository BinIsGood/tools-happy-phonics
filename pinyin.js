(() => {
  const lessons = globalThis.pinyinLessons;
  const base = new URL('./', document.currentScript.src);
  const local = base.protocol === 'file:';
  const progressKey = `little-sounds-pinyin-heard:${base.pathname}`;
  const cacheName = `little-sounds-audio:${base.pathname}`;
  const $ = selector => document.querySelector(selector);
  const audio = new Audio();
  audio.preload = 'none';
  const ids = new Set(lessons.map(lesson => lesson.id));
  const clipIds = new Set(lessons.flatMap(lesson => [lesson.demoClip, lesson.exampleClip]));
  const clips = new Map([...clipIds].map(id => [id, new URL(`audio/pinyin/${id}.mp3${local ? '' : '?v=1'}`, base).href]));
  const filters = $('#pinyin-filters');
  const search = $('#search-input');
  const progress = $('#learning-progress');
  const saveButton = $('#offline-button');
  const cacheStatus = $('#cache-status');
  const saveLabel = saveButton.querySelector('span');
  let group = 'all';
  let playing;
  let playbackSequence = 0;
  let toastTimer;
  let saving = false;
  let allSaved = false;
  let heard = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(progressKey) || '[]');
    if (Array.isArray(saved)) heard = new Set(saved.filter(id => ids.has(id)));
  } catch {}

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function soundIcon() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS(svg.namespaceURI, 'use');
    use.setAttribute('href', '#sound');
    svg.append(use);
    return svg;
  }

  function toast(text) {
    const message = $('#toast');
    clearTimeout(toastTimer);
    message.textContent = text;
    message.hidden = false;
    toastTimer = setTimeout(() => { message.hidden = true; }, 4200);
  }

  function updateProgress() {
    progress.textContent = heard.size
      ? `已经听过 ${heard.size} / ${lessons.length} 项拼音`
      : '今天，从一个新声音开始';
  }

  function stopHighlight() {
    playing?.classList.remove('playing');
    playing = undefined;
  }

  audio.addEventListener('ended', stopHighlight);
  audio.addEventListener('error', () => {
    if (!playing || !audio.error) return;
    stopHighlight();
    toast('这段发音暂时无法播放，请重试。');
  });

  function playClip(id, button, lessonId) {
    const sequence = ++playbackSequence;
    audio.pause();
    stopHighlight();
    playing = button;
    button.classList.add('playing');
    audio.src = clips.get(id);
    audio.play().then(() => {
      if (sequence !== playbackSequence) return;
      heard.add(lessonId);
      try { localStorage.setItem(progressKey, JSON.stringify([...heard])); } catch {}
      updateProgress();
    }).catch(error => {
      if (sequence !== playbackSequence) return;
      stopHighlight();
      if (error.name !== 'AbortError') toast('这段发音暂时无法播放，请重试。');
    });
  }

  function playButton(className, label, lesson, clip) {
    const button = element('button', className);
    button.type = 'button';
    button.dataset.clip = clip;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => playClip(clip, button, lesson.id));
    return button;
  }

  function renderCard(lesson) {
    const card = element('article', 'phoneme-card');
    card.dataset.group = lesson.group;
    card.dataset.lesson = lesson.id;
    const header = element('div', 'card-header');
    const demoKind = lesson.group === 'syllable' ? '一声示范' : '示范音节';
    const demoNote = lesson.demoSpelling ? `${demoKind} ${lesson.demoSpelling}` : '';
    const label = demoNote ? `播放 ${lesson.symbol} 的${demoNote}` : `播放 ${lesson.symbol}`;
    const button = playButton('phoneme-button', label, lesson, lesson.demoClip);
    const symbol = element('span', 'ipa', lesson.symbol);
    symbol.lang = 'zh-Latn-pinyin';
    const speaker = element('span', 'phoneme-speaker');
    speaker.append(soundIcon());
    button.append(symbol, speaker);
    header.append(button, element('span', 'kind-label', lesson.detail || lesson.label));

    const list = element('div', 'word-list pinyin-example');
    const example = playButton('word-button', `播放例字 ${lesson.example}，${lesson.spelling}`, lesson, lesson.exampleClip);
    const copy = element('span', 'word-copy');
    const spelling = element('span', 'word-meaning', lesson.spelling);
    spelling.lang = 'zh-Latn-pinyin';
    copy.append(element('span', 'word-spelling', lesson.example), spelling);
    example.append(copy, soundIcon());
    list.append(example);
    if (demoNote) list.append(element('span', 'pinyin-demo-note', demoNote));
    card.append(header, list);
    return card;
  }

  function withoutTones(value) {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300\u0301\u0304\u030c]/g, '').normalize('NFC');
  }

  function render() {
    const query = search.value.trim().toLowerCase().normalize('NFC').replace(/(?:u:|v)/g, 'ü');
    const hasTone = withoutTones(query) !== query;
    const visible = lessons.filter(lesson => {
      if (group !== 'all' && group !== lesson.group) return false;
      const text = `${lesson.symbol} ${lesson.spelling} ${lesson.example} ${lesson.label} ${lesson.detail || ''} ${lesson.demoSpelling || ''} ${lesson.exampleClip}`;
      return (hasTone ? text : withoutTones(text)).includes(query);
    });
    const fragment = document.createDocumentFragment();
    visible.forEach(lesson => fragment.append(renderCard(lesson)));
    $('#pinyin-grid').replaceChildren(fragment);
    $('#result-count').textContent = `共 ${visible.length} 项拼音`;
    $('#empty-state').hidden = visible.length > 0;
  }

  const groups = new Map([['all', '全部'], ...lessons.map(lesson => [lesson.group, lesson.label])]);
  for (const [value, label] of groups) {
    const button = element('button', 'filter', `${label} `);
    const count = value === 'all' ? lessons.length : lessons.filter(lesson => lesson.group === value).length;
    button.type = 'button';
    button.dataset.filter = value;
    button.setAttribute('aria-pressed', String(value === group));
    button.classList.toggle('active', value === group);
    button.append(element('span', '', String(count)));
    button.addEventListener('click', () => {
      group = value;
      for (const option of filters.children) {
        const active = option === button;
        option.classList.toggle('active', active);
        option.setAttribute('aria-pressed', String(active));
      }
      render();
    });
    filters.append(button);
  }

  async function updateOfflineStatus() {
    if (saving) return;
    if (local) {
      cacheStatus.textContent = '当前使用本地录音，可直接离线点读';
      saveLabel.textContent = '录音已在本机';
      return;
    }
    if (!window.isSecureContext || !navigator.serviceWorker || !('caches' in window)) {
      cacheStatus.textContent = '请通过 HTTPS 或本地服务器打开以保存录音';
      return;
    }
    if (!navigator.serviceWorker.controller) {
      cacheStatus.textContent = '正在准备离线页面…';
      return;
    }
    try {
      const cache = await caches.open(cacheName);
      const saved = new Set((await cache.keys()).map(request => request.url));
      const count = [...clips.values()].filter(url => saved.has(url)).length;
      allSaved = count === clips.size;
      cacheStatus.textContent = allSaved ? '全部发音已保存，断网也能学' : `页面已保存 · ${count} / ${clips.size} 段录音已保存`;
      saveLabel.textContent = allSaved ? '已保存到本机' : '保存到本机';
      saveButton.disabled = allSaved;
    } catch {
      cacheStatus.textContent = '无法读取离线存储，请检查浏览器设置';
    }
  }

  saveButton.addEventListener('click', async () => {
    if (saving || allSaved) return;
    saving = true;
    saveButton.disabled = true;
    let finished = 0;
    let failed = 0;
    cacheStatus.textContent = `正在保存录音 0 / ${clips.size}…`;
    try {
      const cache = await caches.open(cacheName);
      const queue = [...clips.values()];
      const download = async () => {
        while (queue.length) {
          const url = queue.shift();
          try {
            if (!await cache.match(url)) {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 30000);
              try {
                const response = await fetch(url, {signal: controller.signal});
                const type = response.headers.get('content-type') || '';
                if (!response.ok || !/^(audio\/|application\/octet-stream)/i.test(type)) throw new Error('Invalid audio response');
                const bytes = await response.arrayBuffer();
                if (!bytes.byteLength) throw new Error('Empty audio response');
                await cache.put(url, new Response(bytes, {headers: {'Content-Type': 'audio/mpeg'}}));
              } finally { clearTimeout(timer); }
            }
          } catch { failed++; }
          cacheStatus.textContent = `正在保存录音 ${++finished} / ${clips.size}…`;
        }
      };
      await Promise.all(Array.from({length: 3}, download));
      toast(failed ? `还有 ${failed} 段未保存，请联网后重试。` : '拼音录音已全部保存。');
    } catch { toast('暂时无法保存，请检查浏览器存储后重试。'); }
    finally {
      saving = false;
      saveButton.disabled = false;
      await updateOfflineStatus();
    }
  });

  search.addEventListener('input', render);
  $('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
  navigator.serviceWorker?.addEventListener('controllerchange', updateOfflineStatus);
  window.addEventListener('online', updateOfflineStatus);
  render();
  updateProgress();
  updateOfflineStatus();
})();
