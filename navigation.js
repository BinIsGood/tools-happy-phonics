(() => {
  const base = new URL('./', document.currentScript.src);
  const recentKey = `little-sounds-recent-feature:${base.pathname}`;
  const menu = document.querySelector('#feature-menu');
  const defaultFeature = menu?.firstElementChild;
  const feature = document.body.dataset.feature;

  function rememberFeature(selected) {
    try {
      localStorage.setItem(recentKey, selected);
    } catch {}
  }

  function updateRecentFeature() {
    if (feature) rememberFeature(feature);
    if (!menu) return;
    try {
      const recent = localStorage.getItem(recentKey);
      const first = [...menu.children].find(link => link.dataset.feature === recent) ?? defaultFeature;
      if (first && first !== menu.firstElementChild) menu.prepend(first);
    } catch {}
  }

  menu?.addEventListener('click', event => {
    const link = event.target.closest('a[data-feature]');
    if (link) rememberFeature(link.dataset.feature);
  });

  updateRecentFeature();
  window.addEventListener('pageshow', event => {
    if (event.persisted) updateRecentFeature();
  });

  if (feature !== 'phonics' && 'serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register(new URL('./sw.js', base), {scope: base.pathname}).catch(() => {});
  }
})();
