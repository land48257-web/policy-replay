import { appAsset, recognize } from './ocr';
import {
  CASES,
  LABELS,
  acceptEvidence,
  acceptResult,
  compare,
  parsePolicy,
  toOverlay,
  type Case,
  type Evidence,
  type Outcome,
  type SlotId,
} from './policy';

type SlotStatus = 'empty' | 'busy' | 'ready' | 'unreadable';
type SlotState = {
  rev: number;
  status: SlotStatus;
  outcomes?: Record<Case, Outcome>;
  url?: string;
  label: string;
};

const SLOTS: SlotId[] = ['V1', 'V2'];
const CASE_TITLE: Record<Case, string> = {
  'with-photo': 'Damaged return with photo',
  'no-photo': 'Damaged return without photo',
};

const state: {
  slots: Record<SlotId, SlotState>;
  view: SlotId;
  case: Case;
  shown?: Evidence;
} = {
  slots: {
    V1: { rev: 0, status: 'empty', label: '' },
    V2: { rev: 0, status: 'empty', label: '' },
  },
  view: 'V1',
  case: 'with-photo',
};

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`Missing #${id}`);
  return e as T;
}

const messageEl = el<HTMLParagraphElement>('message');
const compareEl = el<HTMLDivElement>('compare');
const showBtn = el<HTMLButtonElement>('show-on-scan');
const noteEl = el<HTMLParagraphElement>('evidence-note');
const quoteRegion = el<HTMLDivElement>('quote-region');
const stage = el<HTMLDivElement>('stage');
const img = el<HTMLImageElement>('scan-img');
const emptyEl = el<HTMLParagraphElement>('viewer-empty');
const captionEl = el<HTMLElement>('viewer-caption');
const loadBtn = el<HTMLButtonElement>('load-examples');

// Comparison cards are built once, then updated in place so focus is never lost.
const cardRefs = {} as Record<Case, { card: HTMLElement; out: Record<SlotId, HTMLElement>; cmp: HTMLElement }>;
for (const c of CASES) {
  const card = document.createElement('article');
  card.className = 'case-card';
  const h = document.createElement('h3');
  h.textContent = CASE_TITLE[c];
  card.append(h);
  const out = {} as Record<SlotId, HTMLElement>;
  for (const s of SLOTS) {
    const p = document.createElement('p');
    p.className = 'outcome pending';
    p.dataset.testid = `status-${c}-${s}`;
    out[s] = p;
    card.append(p);
  }
  const cmp = document.createElement('p');
  cmp.className = 'compare-status na';
  cmp.dataset.testid = `compare-${c}`;
  card.append(cmp);
  compareEl.append(card);
  cardRefs[c] = { card, out, cmp };
}

function setMessage(text: string): void {
  messageEl.textContent = text;
}

function clearShown(): void {
  state.shown = undefined;
}

function describe(slot: SlotId, o: Outcome | undefined): { cls: string; tag: string; text: string } {
  const s = state.slots[slot];
  if (s.status === 'busy') return { cls: 'pending', tag: `${slot} · Pending`, text: 'Recognizing…' };
  if (!o) return { cls: 'pending', tag: `${slot} · Pending`, text: 'No scan loaded' };
  if (o.kind === 'routed') return { cls: 'routed', tag: `${slot} · Routed`, text: o.route };
  if (o.kind === 'omitted') return { cls: 'omitted', tag: `${slot} · Omitted`, text: LABELS.omitted };
  return { cls: 'unreadable', tag: `${slot} · Unreadable`, text: LABELS.unreadable };
}

function comparison(c: Case): { cls: string; text: string } {
  const [a, b] = SLOTS.map((s) => (state.slots[s].status === 'busy' ? undefined : state.slots[s].outcomes?.[c]));
  if (!a || !b || a.kind === 'unreadable' || b.kind === 'unreadable') {
    return { cls: 'na', text: 'Comparison: not comparable (scan unreadable or pending)' };
  }
  const r = compare(a, b);
  return { cls: r, text: `Comparison: ${r}` };
}

const SLOT_STATUS_TEXT: Record<SlotStatus, string> = {
  empty: 'No scan loaded',
  busy: 'Recognizing…',
  ready: 'Ready',
  unreadable: 'Unreadable',
};

function render(): void {
  // Slot status
  for (const s of SLOTS) {
    const e = el<HTMLElement>(`scan-status-${s}`);
    const st = state.slots[s];
    e.textContent = `${SLOT_STATUS_TEXT[st.status]}${st.label && st.status !== 'empty' ? ` (${st.label})` : ''}`;
    e.setAttribute('aria-busy', String(st.status === 'busy'));
  }
  // Comparison
  for (const c of CASES) {
    const ref = cardRefs[c];
    ref.card.classList.toggle('selected', c === state.case);
    for (const s of SLOTS) {
      const d = describe(s, state.slots[s].outcomes?.[c]);
      const p = ref.out[s];
      p.className = `outcome ${d.cls}`;
      p.replaceChildren();
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = d.tag;
      p.append(tag, document.createTextNode(d.text));
    }
    const cmp = comparison(c);
    ref.cmp.className = `compare-status ${cmp.cls}`;
    ref.cmp.textContent = cmp.text;
  }
  // Viewer
  const view = state.slots[state.view];
  if (view.url) {
    if (img.src !== view.url) img.src = view.url;
    img.alt = `Scan of policy ${state.view}`;
    stage.hidden = false;
    emptyEl.hidden = true;
  } else {
    img.removeAttribute('src');
    stage.hidden = true;
    emptyEl.hidden = false;
  }
  captionEl.textContent = `Viewing source scan ${state.view}${view.label ? `: ${view.label}` : ''}. Review the original text yourself.`;

  // Show on scan button: routed outcome of the viewed slot and selected case only
  const outcome = view.status === 'ready' ? view.outcomes?.[state.case] : undefined;
  if (outcome && outcome.kind === 'routed') {
    showBtn.hidden = false;
    showBtn.setAttribute('aria-label', `Show on scan: ${CASE_TITLE[state.case]}, ${state.view}`);
    showBtn.textContent = 'Show on scan';
    noteEl.textContent = `${CASE_TITLE[state.case]} in ${state.view} routes to ${outcome.route}.`;
  } else {
    showBtn.hidden = true;
    noteEl.textContent = `No route for ${CASE_TITLE[state.case].toLowerCase()} in ${state.view}, so there is nothing to show.`;
  }

  renderEvidence();
}

function renderEvidence(): void {
  const e = state.shown;
  quoteRegion.replaceChildren();
  stage.querySelector('svg')?.remove();
  if (!e) return;
  const bq = document.createElement('blockquote');
  bq.dataset.testid = 'quote';
  bq.textContent = e.quote;
  quoteRegion.append(bq);

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.dataset.testid = 'overlay';
  svg.setAttribute('viewBox', `0 0 ${e.imgW} ${e.imgH}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const rect = (b: Evidence['line'], cls: string, fill: string, stroke: string, sw: number) => {
    const o = toOverlay(b, e.imgW, e.imgH);
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('class', cls);
    r.setAttribute('x', String(o.x));
    r.setAttribute('y', String(o.y));
    r.setAttribute('width', String(o.w));
    r.setAttribute('height', String(o.h));
    r.setAttribute('fill', fill);
    r.setAttribute('stroke', stroke);
    r.setAttribute('stroke-width', String(sw));
    r.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(r);
  };
  rect(e.line, 'line-box', 'rgba(255, 193, 7, 0.22)', '#d9480f', 3);
  for (const w of e.words) rect(w, 'word-box', 'none', '#1d4ed8', 1);
  stage.append(svg);
}

async function loadScan(slot: SlotId, blob: Blob, label: string): Promise<void> {
  const s = state.slots[slot];
  s.rev += 1;
  const myRev = s.rev;
  if (s.url) URL.revokeObjectURL(s.url);
  s.url = URL.createObjectURL(blob);
  s.label = label;
  s.outcomes = undefined;
  s.status = 'busy';
  clearShown();
  render();
  const result = await recognize(blob);
  if (!acceptResult(s.rev, myRev)) return;
  s.outcomes = parsePolicy(result, slot, myRev);
  s.status = result.ok ? 'ready' : 'unreadable';
  render();
}

function isImageFile(f: File): boolean {
  return f.type === 'image/png' || f.type === 'image/jpeg';
}

for (const s of SLOTS) {
  const input = el<HTMLInputElement>(`file-${s}`);
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (!f) return;
    if (!isImageFile(f)) {
      setMessage(`${s}: only PNG or JPEG scans are supported. The current ${s} scan was kept.`);
      input.value = '';
      return;
    }
    setMessage('');
    void loadScan(s, f, 'uploaded file');
  });
}

loadBtn.addEventListener('click', async () => {
  setMessage('');
  loadBtn.disabled = true;
  try {
    for (const [s, path] of [['V1', 'v1.png'], ['V2', 'v2.png']] as const) {
      try {
        const res = await fetch(appAsset(path));
        if (!res.ok) throw new Error(String(res.status));
        await loadScan(s, await res.blob(), 'built-in example');
      } catch {
        setMessage(`Could not load the built-in ${s} scan.`);
      }
    }
  } finally {
    loadBtn.disabled = false;
  }
});

for (const r of document.querySelectorAll<HTMLInputElement>('input[name="case"]')) {
  r.addEventListener('change', () => {
    if (!r.checked) return;
    state.case = r.value as Case;
    clearShown();
    render();
  });
}
for (const r of document.querySelectorAll<HTMLInputElement>('input[name="view"]')) {
  r.addEventListener('change', () => {
    if (!r.checked) return;
    state.view = r.value as SlotId;
    clearShown();
    render();
  });
}

showBtn.addEventListener('click', () => {
  const o = state.slots[state.view].outcomes?.[state.case];
  if (!o || o.kind !== 'routed') return;
  if (!acceptEvidence(o.evidence, state.view, state.slots[state.view].rev)) {
    clearShown();
    render();
    return;
  }
  state.shown = o.evidence;
  renderEvidence();
});

// Minimal read-only hook for the smoke test.
(window as unknown as { __policyReplay: unknown }).__policyReplay = {
  snapshot: () => ({
    view: state.view,
    case: state.case,
    shown: state.shown ? { slot: state.shown.slot, rev: state.shown.rev, quote: state.shown.quote } : null,
    slots: {
      V1: { rev: state.slots.V1.rev, status: state.slots.V1.status },
      V2: { rev: state.slots.V2.rev, status: state.slots.V2.status },
    },
  }),
};

render();
