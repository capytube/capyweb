'use strict';
// Capy Roast home hero (nic order #4097): the capy.life family morph gallery, edge to edge, headline on the picture.
// The site is a frozen Next.js export. This script never changes a node React rendered: the gallery is its own layer,
// a child of <body> placed exactly under the hero card (React's wrapper sits above it, with the card see-through),
// which React 19 leaves alone. It follows the card on resize, and is rebuilt or removed when in-site navigation shows
// or leaves the home page. roast.css gives the card its fixed height and first picture, so nothing moves (CLS 0);
// without JavaScript that CSS picture stays.
(() => {
  const PICS = /*PICS*/[];   // [name, alt] pairs, filled in by redesign-roast.sh from pictures.txt; the first is the hero
  const DIR = '/roast-family/';
  const LABEL = 'Capy Roast concept: ';
  const el = (tag, attrs = {}, kids = []) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    for (const k of kids) e.append(k);
    return e;
  };
  const arrow = (step, label, points) => {
    const b = el('button', { type: 'button', class: `morph-arrow ${step < 0 ? 'morph-prev' : 'morph-next'}`, 'data-morph-step': String(step), 'aria-label': label });
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="${points}"/></svg>`;
    return b;
  };
  const findCard = () => {
    const h1 = document.getElementById('order') && document.querySelector('main h1');
    return h1 && h1.closest('div.relative.isolate');
  };

  const build = () => {
    const slides = PICS.map(([name, alt], i) => i === 0
      ? el('img', { class: 'morph-slide is-active', src: `${DIR}${name}-768.webp`, srcset: `${DIR}${name}-768.webp 768w, ${DIR}${name}.webp 1536w`, sizes: '100vw', alt: `${LABEL}${alt}; generated concept imagery`, width: '1536', height: '1024', fetchpriority: 'high' })
      : el('img', { class: 'morph-slide', 'data-src': `${DIR}${name}`, alt: `${LABEL}${alt}; generated concept imagery`, width: '1536', height: '1024', decoding: 'async', 'aria-hidden': 'true' }));
    const stage = el('div', { class: 'morph-stage', role: 'group', 'aria-roledescription': 'carousel', 'aria-label': 'Capy Roast concept pictures', tabindex: '0' },
      [...slides, el('canvas', { class: 'morph-canvas', 'aria-hidden': 'true' })]);
    const thumbs = el('ul', { class: 'morph-thumbs' }, PICS.map(([name, alt], i) => el('li', {}, [
      el('button', { type: 'button', 'data-morph-go': String(i), 'aria-label': `Show ${LABEL}${alt}`, 'aria-current': String(i === 0) },
        [el('img', { 'data-thumb': `${DIR}${name}-768.webp`, alt: '', width: '80', height: '50' })])])));
    const label = el('span', { class: 'render-label hero-render-label' }); label.textContent = 'GENERATED CONCEPT IMAGE';
    return el('section', { class: 'morph-hero rr-gallery', 'aria-label': 'Capy Roast concept pictures' }, [
      stage, el('div', { class: 'morph-shade', 'aria-hidden': 'true' }), label,
      arrow(-1, 'Previous picture', '15 18 9 12 15 6'), arrow(1, 'Next picture', '9 18 15 12 9 6'), thumbs,
      el('p', { class: 'sr-only morph-status', 'aria-live': 'polite' })]);
  };

  let card = null, layer = null, sizer = null;
  const place = () => {
    if (!card || !layer) return;
    const r = card.getBoundingClientRect();
    layer.style.cssText = `top:${r.top + scrollY}px;left:${r.left + scrollX}px;width:${r.width}px;height:${r.height}px`;
  };
  const sync = () => {
    const now = findCard();
    if (now === card && (layer || !now)) return;
    if (layer) { layer.remove(); layer = null; sizer?.disconnect(); }
    card = now;
    if (!card || !window.capyMorph || !PICS.length) return;
    layer = build();
    document.body.append(layer);
    place();
    sizer = new ResizeObserver(place); sizer.observe(card); sizer.observe(document.body);
    window.capyMorph(layer);
  };

  let queued = false;
  const later = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; sync(); }); } };
  const start = () => {
    sync();
    // Changes inside our own layer (the gallery's slides and thumbnails) are not page changes.
    new MutationObserver((rs) => { if (rs.some((r) => !layer || !layer.contains(r.target))) later(); })
      .observe(document.body, { childList: true, subtree: true });
    addEventListener('resize', place, { passive: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
