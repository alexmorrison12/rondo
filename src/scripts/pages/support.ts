/**
 * Support: instant, forgiving search over the answers (typos welcome), topic filters,
 * shareable links to single answers, and three self-serve desks (track, return, write).
 * Everything is local: the forms are demos and nothing leaves the page.
 */
import { COLORWAYS, DATES, ORDER_NUMBER, PHASES, PRODUCT } from '@/data/site';
import { ICONS } from '@/lib/icons';
import { currentPhase } from '../core/phase';
import { copyText } from '../core/share';
import { toast } from '../core/toast';

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [
  ...root.querySelectorAll<T>(sel),
];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Text helpers ────────────────────────────────────────────────── */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const STOP = new Set(
  'a an and are be can do does for from get how i if in is it me my of on or so that the there this to what when where which why will with you your'.split(
    ' ',
  ),
);

function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}
const tolerance = (term: string) => (term.length >= 7 ? 2 : term.length >= 4 ? 1 : 0);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ── Index ───────────────────────────────────────────────────────── */
interface Item {
  el: HTMLDetailsElement;
  topic: string;
  q: string;
  a: string;
  keys: string;
  words: Set<string>;
}

const items: Item[] = $$<HTMLDetailsElement>('details[data-faq]').map((el) => {
  const q = norm($('[data-question]', el)?.textContent ?? '');
  const a = norm($('[data-answer]', el)?.textContent ?? '');
  const keys = norm(el.dataset.keys ?? '');
  return {
    el,
    topic: el.closest<HTMLElement>('[data-topic]')?.dataset.topic ?? '',
    q,
    a,
    keys,
    words: new Set(`${q} ${a} ${keys}`.split(' ').filter((w) => w.length > 2)),
  };
});
const vocabulary = new Set(items.flatMap((i) => [...i.words]));

interface Match {
  item: Item;
  score: number;
  hits: string[];
}

function matchTerm(item: Item, term: string): { score: number; hit: string } | null {
  if (item.q.includes(term)) return { score: 3, hit: term };
  if (item.keys.includes(term)) return { score: 2, hit: term };
  if (item.a.includes(term)) return { score: 1, hit: term };
  const tol = tolerance(term);
  if (!tol) return null;
  for (const w of item.words) if (distance(term, w) <= tol) return { score: 0.5, hit: w };
  return null;
}

function search(query: string): { matches: Match[]; partial: boolean; terms: string[] } {
  const raw = norm(query).split(' ').filter(Boolean);
  const terms = raw.filter((t) => !STOP.has(t));
  const use = terms.length ? terms : raw;
  if (!use.length) return { matches: items.map((item) => ({ item, score: 0, hits: [] })), partial: false, terms: [] };
  const run = (every: boolean) =>
    items.flatMap((item) => {
      let score = 0;
      const hits: string[] = [];
      let found = 0;
      for (const t of use) {
        const m = matchTerm(item, t);
        if (m) {
          found++;
          score += m.score;
          hits.push(m.hit);
        } else if (every) return [];
      }
      return found ? [{ item, score, hits }] : [];
    });
  const all = run(true);
  if (all.length || use.length === 1) return { matches: all, partial: false, terms: use };
  return { matches: run(false), partial: true, terms: use };
}

function suggestion(terms: string[]): string | null {
  for (const t of terms) {
    let best: string | null = null;
    let bestD = 3;
    for (const w of vocabulary) {
      const d = distance(t, w);
      if (d < bestD && d <= Math.max(1, tolerance(t) + 1)) {
        best = w;
        bestD = d;
      }
    }
    if (best && best !== t) return best;
  }
  return null;
}

/* ── Highlighting (walks text nodes, so links and phase spans survive) ── */
function unmark(root: Element) {
  root.querySelectorAll('mark').forEach((m) => m.replaceWith(document.createTextNode(m.textContent ?? '')));
  root.normalize();
}

function mark(root: Element, words: string[]) {
  if (!words.length) return;
  const re = new RegExp(`(${[...new Set(words)].sort((a, b) => b.length - a.length).map(escapeRe).join('|')})`, 'gi');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const text = node.data;
    re.lastIndex = 0;
    if (!re.test(text)) continue;
    re.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0;
    for (const m of text.matchAll(re)) {
      const at = m.index ?? 0;
      if (at > last) frag.append(text.slice(last, at));
      const el = document.createElement('mark');
      el.textContent = m[0];
      frag.append(el);
      last = at + m[0].length;
    }
    if (last < text.length) frag.append(text.slice(last));
    node.replaceWith(frag);
  }
}

/* ── State & rendering ───────────────────────────────────────────── */
const input = $<HTMLInputElement>('[data-q]');
const clearBtn = $<HTMLButtonElement>('[data-clear]');
const kbd = $('[data-kbd]');
const count = $('[data-help-count]');
const empty = $('[data-empty]');
const chips = $$<HTMLButtonElement>('[data-topic-chip]');
const sections = $$<HTMLElement>('section[data-topic]');
const topicName = (id: string) => sections.find((s) => s.dataset.topic === id)?.querySelector('h2')?.textContent?.trim() ?? '';

const params = new URLSearchParams(location.search);
let topic = chips.some((c) => c.dataset.topicChip === params.get('topic')) ? params.get('topic')! : 'all';
let query = params.get('q') ?? '';
const autoOpened = new Set<HTMLDetailsElement>();

function render() {
  const typed = query.trim();
  const { matches, partial, terms } = search(typed);
  const byItem = new Map(matches.map((m) => [m.item, m]));
  const visible = matches.filter((m) => topic === 'all' || m.item.topic === topic);

  // Chip counts reflect the search, so you can see where the answers are.
  chips.forEach((c) => {
    const id = c.dataset.topicChip!;
    const n = id === 'all' ? matches.length : matches.filter((m) => m.item.topic === id).length;
    const out = $('[data-n]', c);
    if (out) out.textContent = String(n);
    c.toggleAttribute('data-none', n === 0);
    c.setAttribute('aria-pressed', String(id === topic));
  });

  const openNow = new Set<HTMLDetailsElement>(typed && visible.length <= 3 ? visible.map((m) => m.item.el) : []);
  for (const item of items) {
    const m = byItem.get(item);
    const show = Boolean(m) && (topic === 'all' || item.topic === topic);
    item.el.hidden = !show;
    const q = $('[data-question]', item.el);
    const a = $('[data-answer]', item.el);
    if (q) unmark(q);
    if (a) unmark(a);
    if (show && m && typed) {
      const words = [...terms.filter((t) => t.length > 1), ...m.hits];
      if (q) mark(q, words);
      if (a) mark(a, words);
    }
    if (openNow.has(item.el)) {
      if (!item.el.open) {
        item.el.open = true;
        autoOpened.add(item.el);
      }
    } else if (autoOpened.has(item.el)) {
      item.el.open = false;
      autoOpened.delete(item.el);
    }
  }
  sections.forEach((s) => {
    s.hidden = !items.some((i) => i.topic === s.dataset.topic && !i.el.hidden);
  });

  const n = visible.length;
  const where = topic === 'all' ? '' : ` in ${topicName(topic)}`;
  if (count) {
    count.textContent = typed
      ? `${n} ${n === 1 ? 'answer' : 'answers'} for “${typed}”${where}${partial && n ? ', matching some of your words' : ''}`
      : `${n} ${n === 1 ? 'answer' : 'answers'}${where}`;
  }

  if (empty) {
    empty.hidden = n > 0;
    if (!n) {
      const title = $('[data-empty-title]', empty);
      if (title)
        title.textContent = typed
          ? `Nothing about “${typed}”${where} yet.`
          : `Nothing${where} yet.`;
      const suggest = $('[data-suggest]', empty);
      const word = suggestion(terms);
      if (suggest) {
        suggest.hidden = !word;
        const btn = $('[data-suggest-word]', suggest);
        if (btn && word) btn.textContent = word;
      }
    }
  }

  const has = query.length > 0;
  if (clearBtn) clearBtn.hidden = !has;
  if (kbd) kbd.hidden = has;
  syncUrl();
}

let urlTimer = 0;
function syncUrl() {
  window.clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set('q', query.trim());
    if (topic !== 'all') p.set('topic', topic);
    const qs = p.toString();
    history.replaceState(history.state, '', `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`);
  }, 300);
}

function setQuery(q: string, focus = false) {
  query = q;
  if (input) {
    input.value = q;
    if (focus) input.focus();
  }
  render();
}

/* ── Wiring: search, chips, shortcuts ────────────────────────────── */
if (input) {
  input.value = query;
  input.addEventListener('input', () => {
    query = input.value;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) {
      e.preventDefault();
      setQuery('');
    }
  });
  input.form?.addEventListener('submit', (e) => {
    e.preventDefault();
    // Enter jumps to the first answer, which is usually what you were after.
    const first = items.find((i) => !i.el.hidden);
    if (first && query) {
      first.el.open = true;
      $('summary', first.el)?.focus();
    }
  });
}
clearBtn?.addEventListener('click', () => setQuery('', true));
chips.forEach((c) =>
  c.addEventListener('click', () => {
    topic = c.dataset.topicChip === topic && topic !== 'all' ? 'all' : (c.dataset.topicChip ?? 'all');
    render();
  }),
);
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement;
  if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
  e.preventDefault();
  input?.focus();
  input?.select();
});
$$<HTMLButtonElement>('[data-try]').forEach((b) => b.addEventListener('click', () => setQuery(b.dataset.try ?? '', true)));
$('[data-suggest-word]')?.addEventListener('click', (e) => setQuery((e.currentTarget as HTMLElement).textContent ?? '', true));

/* Copy a link to one answer */
document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('[data-copy-link]');
  if (!btn) return;
  const details = btn.closest('details');
  if (!details) return;
  const link = `${location.origin}${location.pathname}#${details.id}`;
  void copyText(link).then((ok) =>
    toast(ok ? 'Link copied. It opens straight to this answer.' : 'Copy failed. The address bar has it too.', {
      icon: ok ? 'link' : 'x',
    }),
  );
  history.replaceState(history.state, '', `#${details.id}`);
});

/* ── Tabs: track / return / contact ──────────────────────────────── */
const tabs = $$<HTMLButtonElement>('[role="tab"][data-tab]');
const TAB_IDS = tabs.map((t) => t.dataset.tab!);

function selectTab(id: string, opts: { focusTab?: boolean; scroll?: boolean; focusField?: boolean } = {}) {
  const tab = tabs.find((t) => t.dataset.tab === id);
  if (!tab) return;
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    const pane = document.getElementById(t.getAttribute('aria-controls') ?? '');
    if (pane) pane.hidden = !on;
  });
  if (opts.focusTab) tab.focus();
  if (opts.scroll) {
    $('.desk')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
  if (opts.focusField) {
    const pane = document.getElementById(tab.getAttribute('aria-controls') ?? '');
    const field = pane?.querySelector<HTMLElement>('form:not([hidden]) input, form:not([hidden]) select');
    window.setTimeout(() => field?.focus({ preventScroll: true }), reduceMotion ? 0 : 450);
  }
}

tabs.forEach((t, i) => {
  t.addEventListener('click', () => {
    selectTab(t.dataset.tab!);
    history.replaceState(history.state, '', `${location.pathname}${location.search}#${t.dataset.tab}`);
  });
  t.addEventListener('keydown', (e) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    let next: HTMLButtonElement | undefined;
    if (dir) next = tabs[(i + dir + tabs.length) % tabs.length];
    if (e.key === 'Home') next = tabs[0];
    if (e.key === 'End') next = tabs[tabs.length - 1];
    if (!next) return;
    e.preventDefault();
    selectTab(next.dataset.tab!, { focusTab: true });
  });
});

/* In-page links to a desk (#track, #return, #contact) open the right tab. */
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href')!.slice(1);
  if (!TAB_IDS.includes(id)) return;
  e.preventDefault();
  if (a.hasAttribute('data-ask') && query.trim()) {
    const msg = $<HTMLTextAreaElement>('#contact-message');
    if (msg && !msg.value) msg.value = `I searched the help page for “${query.trim()}” and couldn’t find an answer.\n\n`;
    const sel = $<HTMLSelectElement>('#contact-topic');
    if (sel && !sel.value && topic !== 'all') sel.value = topic;
    updateChars();
  }
  selectTab(id, { scroll: true, focusField: true });
  history.replaceState(history.state, '', `${location.pathname}${location.search}#${id}`);
});

/* ── Forms ───────────────────────────────────────────────────────── */
const ORDER_RE = ORDER_NUMBER.pattern;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function nightsSince(value: string): number | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  const then = new Date(y, m - 1, d);
  return Math.round((startOfDay(new Date()).getTime() - then.getTime()) / 86_400_000);
}

function check(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string | null {
  const v = el.value.trim();
  switch (el.dataset.validate) {
    case 'name':
      return v ? null : 'Add your name so we know who to reply to.';
    case 'email':
      if (!v) return 'We need an email to reply to.';
      return EMAIL_RE.test(v) ? null : 'That email looks incomplete. It needs an @ and a domain, like you@example.com.';
    case 'order':
      if (!v) return 'Add your order number. It starts with RDO.';
      return ORDER_RE.test(v) ? null : `Order numbers look like ${ORDER_NUMBER.example}.`;
    case 'order-optional':
      return !v || ORDER_RE.test(v) ? null : `Order numbers look like ${ORDER_NUMBER.example}.`;
    case 'topic':
      return v ? null : 'Pick a topic so the right person reads it.';
    case 'message':
      return v.length >= 10 ? null : 'Tell us a little more: at least 10 characters.';
    case 'date': {
      const n = nightsSince(v);
      if (n === null) return null;
      return n < 0 ? 'That date hasn’t happened yet.' : null;
    }
    default:
      return null;
  }
}

function show(el: HTMLElement, msg: string | null) {
  const errId = (el.getAttribute('aria-describedby') ?? '').split(' ').find((id) => id.endsWith('-err'));
  const err = errId ? document.getElementById(errId) : null;
  el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (err) {
    err.textContent = msg ?? '';
    err.hidden = !msg;
  }
}

const fields = (form: HTMLFormElement) =>
  $$<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-validate]', form);

$$<HTMLFormElement>('form[data-form]').forEach((form) => {
  for (const el of fields(form)) {
    // Quiet until you've had a go; then errors update as you fix them.
    el.addEventListener('blur', () => {
      if (el.value.trim() || el.dataset.touched) {
        el.dataset.touched = '1';
        show(el, check(el));
      }
    });
    el.addEventListener('input', () => {
      if (el.getAttribute('aria-invalid') === 'true') show(el, check(el));
    });
    el.addEventListener('change', () => {
      if (el.tagName === 'SELECT' && el.dataset.touched) show(el, check(el));
    });
  }
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let first: HTMLElement | null = null;
    for (const el of fields(form)) {
      el.dataset.touched = '1';
      const msg = check(el);
      show(el, msg);
      if (msg && !first) first = el;
    }
    if (first) {
      first.focus();
      return;
    }
    void submit(form);
  });
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const orderNo = (v: string) => {
  const digits = v.replace(/\D/g, '');
  return ORDER_NUMBER.make(2026, Number(digits.slice(-5)));
};

async function submit(form: HTMLFormElement) {
  const kind = form.dataset.form!;
  const btn = $<HTMLButtonElement>('[data-submit]', form);
  const label = $('[data-submit-label]', form);
  const idle = label?.textContent ?? '';
  btn?.setAttribute('aria-busy', 'true');
  if (label) label.textContent = kind === 'track' ? 'Looking…' : kind === 'return' ? 'Starting…' : 'Sending…';
  await sleep(reduceMotion ? 150 : 650);
  btn?.removeAttribute('aria-busy');
  if (label) label.textContent = idle;

  const data = new FormData(form);
  const result = $(`[data-result="${kind}"]`);
  if (!result) return;
  if (kind === 'track') result.innerHTML = trackResult(String(data.get('order')));
  if (kind === 'return') result.innerHTML = returnResult(String(data.get('order')), String(data.get('email')), String(data.get('arrived') ?? ''), String(data.get('reason') ?? ''));
  if (kind === 'contact') result.innerHTML = contactResult(String(data.get('name')), String(data.get('email')));
  form.hidden = true;
  result.hidden = false;
  result.focus();
  $('[data-again]', result)?.addEventListener('click', () => {
    result.hidden = true;
    result.innerHTML = '';
    form.hidden = false;
    if (kind === 'contact') form.reset();
    fields(form).forEach((el) => {
      delete el.dataset.touched;
      show(el, null);
    });
    updateChars();
    updateNights();
    $<HTMLElement>('input, select, textarea', form)?.focus();
  });
}

/** Demo orders were placed the day after launch. */
const ORDERED = new Date(new Date(DATES.launch).getTime() + 86_400_000);
const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(ORDERED);
const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(ORDERED);

function trackResult(order: string): string {
  const no = orderNo(order);
  const digits = no.replace(/\D/g, '');
  const sum = [...digits].reduce((n, d) => n + Number(d), 0);
  const finishes = COLORWAYS.filter((c) => !c.foundersOnly);
  const finish = finishes[sum % finishes.length]!;
  const shipping = PHASES[currentPhase()].shipping;
  return `
    <p class="result__title">${esc(no)} · Rondo in ${esc(finish.name)}</p>
    <p class="result__meta">Pre-ordered on ${longDate}.</p>
    <ol class="journey">
      <li data-state="done">Ordered<small>${shortDate}</small></li>
      <li data-state="current" aria-current="step">Being made<small>In the workshop</small></li>
      <li>On its way<small>Tracking link by email</small></li>
      <li>With you<small>${PRODUCT.trialNights} nights start</small></li>
    </ol>
    <p class="result__note"><strong>${esc(shipping)}.</strong> We’ll email a tracking link the day it leaves us.</p>
    <div class="result__actions">
      <button class="btn btn--ghost btn--sm" type="button" data-again>Track another order</button>
      <p class="demo-note">A demo order: nothing was looked up.</p>
    </div>`;
}

function returnResult(order: string, email: string, arrived: string, reason: string): string {
  const no = orderNo(order);
  const n = nightsSince(arrived);
  const left = n === null ? null : PRODUCT.trialNights - n;
  const ago = left !== null && left < 0 ? -left : 0;
  const outOfTrial = ago > 0;
  const title = outOfTrial ? `We’ll treat ${no} as a repair.` : `Return started for ${no}.`;
  const body = outOfTrial
    ? `Your trial ended ${ago} ${ago === 1 ? 'night' : 'nights'} ago, but the ${PRODUCT.warrantyYears}-year warranty has you covered if something is wrong. We’d email ${esc(email)} a prepaid label and fix or replace it, free.`
    : reason === 'damaged' || reason === 'faulty'
      ? `Sorry about that. We’d email a prepaid label to ${esc(email)} and send a replacement the moment the return is scanned, so you’re not left without one.`
      : `We’d email a prepaid label to ${esc(email)}. Pack Rondo in any box, drop it off, and your refund lands within five working days of it reaching us.`;
  return `
    <span class="result__check" aria-hidden="true">${ICONS.check}</span>
    <p class="result__title">${esc(title)}</p>
    <p class="result__meta">${body}</p>
    <div class="result__actions">
      <button class="btn btn--ghost btn--sm" type="button" data-again>Start another</button>
      <p class="demo-note">A demo: no label was created.</p>
    </div>`;
}

function contactResult(name: string, email: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return `
    <span class="result__check" aria-hidden="true">${ICONS.check}</span>
    <p class="result__title">Thanks, ${esc(first)}. Message received.</p>
    <p class="result__meta">We reply within one working day, to ${esc(email)}. If it’s about a repair, a photo helps; just reply to our email with one.</p>
    <div class="result__actions">
      <button class="btn btn--ghost btn--sm" type="button" data-again>Write another</button>
      <p class="demo-note">A demo: nothing was sent anywhere.</p>
    </div>`;
}

/* Live helpers: character count, nights left in the trial */
const message = $<HTMLTextAreaElement>('#contact-message');
const chars = $('[data-chars]');
function updateChars() {
  if (!message || !chars) return;
  const n = message.value.trim().length;
  chars.textContent =
    n === 0 ? 'At least 10 characters.' : n < 10 ? `${10 - n} more to go.` : `${message.value.length} of 2,000 characters.`;
}
message?.addEventListener('input', updateChars);

const arrived = $<HTMLInputElement>('#return-date');
const nightsOut = $('[data-nights]');
function updateNights() {
  if (!arrived || !nightsOut) return;
  const n = nightsSince(arrived.value);
  const trial = PRODUCT.trialNights;
  if (n === null || n < 0) {
    nightsOut.textContent = 'We’ll work out how many nights you have left.';
    return;
  }
  const left = trial - n;
  nightsOut.textContent =
    left > 1
      ? `You have ${left} nights left in your trial.`
      : left === 1
        ? 'One night left in your trial.'
        : left === 0
          ? 'Tonight is the last night of your trial.'
          : `Your trial ended ${-left} ${left === -1 ? 'night' : 'nights'} ago. The warranty still covers faults.`;
}
if (arrived) {
  // Set at runtime so a static build never goes stale.
  const t = new Date();
  arrived.max = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  arrived.addEventListener('input', updateNights);
}

/* Topic chip → preselect the contact topic (only if you haven't picked one). */
$('#tab-contact')?.addEventListener('click', () => {
  const sel = $<HTMLSelectElement>('#contact-topic');
  if (sel && !sel.value && topic !== 'all') sel.value = topic;
});

/* ── Boot: filters from the URL, then any #answer or #desk in the hash ── */
function handleHash() {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (TAB_IDS.includes(hash)) {
    selectTab(hash);
    requestAnimationFrame(() => $('.desk')?.scrollIntoView({ block: 'start' }));
    return;
  }
  const target = hash ? document.getElementById(hash) : null;
  if (!(target instanceof HTMLDetailsElement) || !target.hasAttribute('data-faq')) return;
  if (target.hidden) {
    topic = 'all';
    setQuery('');
  }
  target.open = true;
  target.dataset.flash = '';
  requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }));
  window.setTimeout(() => delete target.dataset.flash, 1800);
}

render();
handleHash();
window.addEventListener('hashchange', handleHash);
updateChars();
