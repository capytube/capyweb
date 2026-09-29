// Chat panel for pages/watch_room.rs. The DOM is built here so the wasm stays small.
// Names and text are other people's words: textContent only, never HTML.
// `read` / `post` / `react` return "status\ncode\nbody" (body may contain newlines).

const NAMES = ['capylove', 'capylike', 'capywow', 'capyangry', 'capyfire'];
const WORDS = ['Love', 'Like', 'Wow', 'Angry', 'Fire'];

const el = (tag, cls) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  return n;
};
const units = (s) => Array.from(s).length;
const clip = (s, n) => Array.from(s).slice(0, n).join('');
const split = (raw) => {
  const a = raw.indexOf('\n');
  const b = raw.indexOf('\n', a + 1);
  return { status: Number(raw.slice(0, a)), code: raw.slice(a + 1, b), body: raw.slice(b + 1) };
};
const num = (r, k) => (r && r[k]) || 0;
const polls = new Map();
const lastPoll = new Map();

function chatUrl(base, id, cursor) {
  if (base === 'fixtures') {
    return '/fixtures/streams/' + id + '/chat.json' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : '');
  }
  const root = base.replace(/\/$/, '');
  return root + '/streams/' + id + '/chat?limit=50' + (cursor ? '&cursor=' + encodeURIComponent(cursor) : '');
}

export function attach(root, id, base, exchange, signIn) {
  const previous = polls.get(id);
  if (previous) previous.destroy();
  const read = async (cursor) => {
    if (!cursor) lastPoll.set(id, Date.now());
    try {
      const res = await fetch(chatUrl(base, id, cursor), { headers: { accept: 'application/json' } });
      if ((res.status === 404 || res.status === 0) && base === 'fixtures') {
        return '200\n\n{"items":[],"count":0}';
      }
      return res.status + '\n\n' + await res.text();
    } catch {
      return '0\n\n';
    }
  };
  const post = (t) => exchange(1, t);
  const react = (n) => exchange(2, n);
  let alive = true;
  let timer = 0;
  let delay = 5000;
  let primed = false;
  let cursor = '';
  let signed = false;
  let ready = false;
  let mode = '';
  let counts = {};
  const seen = new Set();
  const lines = [];

  const live = el('p', 'sr-only');
  live.setAttribute('aria-live', 'polite');
  live.dataset.testid = 'chat-announce';
  const reacts = el('div', 'reacts');
  // A label on a plain div is ignored; as a group it names the reaction buttons.
  reacts.setAttribute('role', 'group');
  reacts.setAttribute('aria-label', 'Reactions');
  const signBtn = el('button', 'btn btn-small');
  signBtn.type = 'button';
  signBtn.dataset.testid = 'watch-sign-in';
  signBtn.textContent = 'Sign in to react and chat';
  signBtn.onclick = () => signIn();
  const note = el('p');
  // "Could not send that." and the slow-mode note appear after Send: say them.
  note.setAttribute('role', 'status');
  note.dataset.testid = 'chat-notice';
  note.hidden = true;
  const empty = el('p');
  empty.dataset.testid = 'chat-empty';
  empty.textContent = 'No messages yet';
  const log = el('ul', 'chat-log');
  log.dataset.testid = 'chat-log';
  const earlier = el('button', 'btn btn-ghost btn-small');
  earlier.type = 'button';
  earlier.dataset.testid = 'chat-earlier';
  earlier.textContent = 'Load earlier';
  earlier.hidden = true;
  const form = el('form', 'chat-form');
  form.dataset.testid = 'chat-form';
  const label = el('label', 'sr-only');
  label.htmlFor = 'chat-input';
  label.textContent = 'Message';
  const input = el('input');
  input.id = 'chat-input';
  input.maxLength = 280;
  input.placeholder = 'Say hello';
  const count = el('span', 'chat-count');
  count.dataset.testid = 'chat-count';
  count.textContent = '0/280';
  const send = el('button', 'btn btn-small');
  send.type = 'submit';
  send.textContent = 'Send';
  form.append(label, input, count, send);
  root.append(live, reacts, note, empty, log, earlier);

  const say = (m) => {
    const name = clip((m.display_name || 'Someone'), 32);
    const text = clip(m.text || '', 280);
    live.textContent = name + ': ' + text;
  };
  const row = (m) => {
    const li = el('li', 'chat-line');
    li.dataset.testid = 'chat-line';
    const name = el('span', 'chat-name');
    name.textContent = clip(m.display_name || 'Someone', 32);
    const text = el('span', 'chat-text');
    text.textContent = clip(m.text || '', 280);
    li.append(name, text);
    return li;
  };
  const render = () => {
    log.replaceChildren(...lines.map(row));
    empty.hidden = lines.length > 0;
  };
  const paintCounts = () => {
    if (signed) {
      for (const b of reacts.querySelectorAll('[data-reaction]')) {
        const i = NAMES.indexOf(b.dataset.reaction);
        b.textContent = WORDS[i] + ' ' + num(counts, b.dataset.reaction);
      }
    } else {
      const p = reacts.querySelector('p');
      if (p) p.textContent = NAMES.map((k, i) => WORDS[i] + ' ' + num(counts, k)).join(' · ');
    }
  };
  const paintAuth = () => {
    const next = signed ? 'in' : ready ? 'out' : 'none';
    if (next !== mode) {
      mode = next;
      reacts.replaceChildren();
      if (signed) {
        NAMES.forEach((name, i) => {
          const b = el('button', 'btn btn-ghost btn-small');
          b.type = 'button';
          b.dataset.testid = 'react';
          b.dataset.reaction = name;
          b.textContent = WORDS[i] + ' ' + num(counts, name);
          reacts.append(b);
        });
        signBtn.remove();
        if (!form.parentNode) root.append(form);
      } else {
        const p = el('p');
        p.textContent = NAMES.map((k, i) => WORDS[i] + ' ' + num(counts, k)).join(' · ');
        reacts.append(p);
        form.remove();
        if (ready) note.before(signBtn);
        else signBtn.remove();
      }
    }
    paintCounts();
  };
  const showNote = (kind) => {
    note.hidden = false;
    note.replaceChildren();
    if (kind === 'slow') note.textContent = 'One message every 2 seconds.';
    else if (kind === 'name') {
      note.append('Set a display name first. ');
      const a = el('a');
      a.href = '/profile';
      a.textContent = 'Your account';
      note.append(a);
    } else if (kind === 'denied') note.textContent = 'Chat is for public cameras.';
    else note.textContent = 'Could not send that.';
  };
  const take = (items, older) => {
    const fresh = [];
    for (const m of items || []) {
      if (!m || !m.id || seen.has(m.id)) continue;
      seen.add(m.id);
      fresh.push(m);
    }
    if (older) lines.push(...fresh);
    else if (fresh.length) lines.unshift(...fresh);
    return fresh;
  };
  const apply = (page, announce, older) => {
    const fresh = take(page.items, older);
    if (page.reactions) counts = page.reactions;
    if (!primed) cursor = page.cursor || '';
    else if (older) cursor = page.cursor || '';
    primed = true;
    earlier.hidden = !cursor;
    render();
    paintCounts();
    if (announce && fresh.length) {
      live.textContent = fresh.slice(0, 3).map((m) => (
        clip(m.display_name || 'Someone', 32) + ': ' + clip(m.text || '', 280)
      )).join(' ');
    }
  };
  async function pull(cur, older) {
    let raw;
    try { raw = await read(cur || ''); } catch { raw = '0\n\n'; }
    if (!alive) return;
    const msg = split(raw);
    if (msg.status < 200 || msg.status >= 300) {
      delay = 30000;
      if (!primed) {
        note.hidden = false;
        note.textContent = 'Could not load chat. Trying again.';
      }
      return;
    }
    delay = 5000;
    let page = {};
    try { page = JSON.parse(msg.body); } catch { page = {}; }
    const first = !primed;
    apply(page, !first && !older, older);
    if (first && !lines.length) note.hidden = true;
  }
  function arm(ms) {
    clearTimeout(timer);
    if (alive) timer = setTimeout(tick, ms);
  }
  function tick() {
    if (!alive) return;
    if (document.hidden) { arm(delay); return; }
    pull('', false).then(() => arm(delay));
  }
  reacts.onclick = async (ev) => {
    const name = ev.target && ev.target.dataset && ev.target.dataset.reaction;
    if (!name || !signed) return;
    let raw;
    try { raw = await react(name); } catch { return; }
    if (!alive) return;
    const msg = split(raw);
    if (msg.status < 200 || msg.status >= 300) { showNote(kind(msg)); return; }
    try { counts = JSON.parse(msg.body).reactions || counts; } catch { /* keep */ }
    paintCounts();
  };
  earlier.onclick = () => { if (cursor) pull(cursor, true); };
  input.oninput = () => { count.textContent = units(input.value) + '/280'; };
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const text = input.value;
    if (!text.trim() || units(text) > 280) return;
    let raw;
    try { raw = await post(text); } catch { return; }
    if (!alive) return;
    const msg = split(raw);
    if (msg.status < 200 || msg.status >= 300) { showNote(kind(msg)); return; }
    let message = null;
    try { message = JSON.parse(msg.body).message; } catch { message = null; }
    if (message && message.id) {
      take([message], false);
      render();
      say(message);
    }
    input.value = '';
    count.textContent = '0/280';
    note.hidden = true;
    note.replaceChildren();
  };
  function kind(msg) {
    if (msg.code === 'slow_down' || msg.status === 429) return 'slow';
    if (msg.code === 'display_name_required' || msg.status === 409) return 'name';
    if (msg.code === 'private_stream' || msg.status === 403) return 'denied';
    return 'fail';
  }
  paintAuth();
  const ago = Date.now() - (lastPoll.get(id) || 0);
  if (ago > 4000) {
    lastPoll.set(id, Date.now());
    arm(0);
  } else {
    arm(Math.max(0, 5000 - ago));
  }
  const handle = {
    destroy() {
      alive = false;
      clearTimeout(timer);
      if (polls.get(id) === handle) polls.delete(id);
    },
    setAuth(s, r) { signed = !!s; ready = !!r; paintAuth(); },
  };
  polls.set(id, handle);
  return handle;
}
