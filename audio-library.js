export function resolveAudioClips(manifest, clipIds, base) {
  if (!manifest || typeof manifest.clips !== 'object' || manifest.clips === null || Array.isArray(manifest.clips)) {
    throw new Error('Invalid audio manifest');
  }
  const knownIds = new Set(clipIds);
  const root = new URL(base);
  const clips = new Map();
  for (const [id, entry] of Object.entries(manifest.clips)) {
    if (!knownIds.has(id) || !entry || typeof entry.path !== 'string') continue;
    let url;
    try { url = new URL(entry.path, root); } catch { continue; }
    if (url.origin !== root.origin || !url.pathname.startsWith(`${root.pathname}audio/`) || !/\.(mp3|wav|m4a|ogg)$/i.test(url.pathname)) continue;
    url.searchParams.set('v', String(manifest.version || '1'));
    clips.set(id, url.href);
  }
  return clips;
}

export function createAudioLibrary({base, clipIds, fetcher = globalThis.fetch}) {
  let clips = new Map();
  let pending;
  return {
    get clips() { return clips; },
    async refresh() {
      if (pending) return pending;
      pending = (async () => {
        const response = await fetcher(new URL('./audio/manifest.json', base), {cache: 'no-store'});
        if (!response.ok) throw new Error('Cannot load audio manifest');
        const next = resolveAudioClips(await response.json(), clipIds, base);
        clips = next;
        return clips;
      })();
      try { return await pending; }
      finally { pending = undefined; }
    },
  };
}
