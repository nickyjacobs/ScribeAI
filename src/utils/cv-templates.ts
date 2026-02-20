// src/utils/cv-templates.ts
/**
 * Drie professionele CV-templates voor ScribeAI.
 *
 * "donker"   — donkere sidebar, blauwe header-kaart (zweeft in dark area)
 * "klassiek" — lichte sidebar, volledige navy header-balk
 * "strak"    — gekleurde sidebar met naam/contact links, open rechterkolom
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SidebarItem { label: string; level: number; }

export interface SidebarSection {
  title:   string;
  items:   SidebarItem[];
  isHobby: boolean;
}

export interface MainSection { title: string; html: string; }

export interface ContactItem { icon: string; text: string; href?: string; }

export interface TemplateInput {
  name:    string;
  jobTitle: string;
  contact: ContactItem[];
  sidebar: SidebarSection[];
  main:    MainSection[];
  accent:  string; // primaire accentkleur
  dark:    string; // donkere kleur (voor Donker-template)
}

export type TemplateName = 'donker' | 'klassiek' | 'strak';

// ── Sectie-routing constanten (geëxporteerd voor gebruik in workflows) ─────────

export const HOBBY_TITLES = new Set([
  "hobby's en interesses", "hobby's", 'hobbies', 'interesses',
  "hobby's & interesses", 'interessen',
]);

export const ALWAYS_SIDEBAR = new Set([
  'talen', 'persoonlijke eigenschappen', 'personal traits', 'persoonlijk', 'vrijwilligerswerk',
  ...HOBBY_TITLES,
]);

export const SMART_SIDEBAR = new Set(['vaardigheden', 'skills', 'competenties']);

// Namen van secties die via het sidebar-commando bewerkt kunnen worden
export const EDITABLE_SIDEBAR = new Set([
  'talen', 'vaardigheden', 'persoonlijke eigenschappen', ...HOBBY_TITLES,
]);

export function isHobbyTitle(title: string): boolean {
  return HOBBY_TITLES.has(title.toLowerCase().trim());
}

// ── Template dispatcher ────────────────────────────────────────────────────────

export function buildTemplate(name: TemplateName, input: TemplateInput): string {
  switch (name) {
    case 'klassiek': return buildKlassiek(input);
    case 'strak':    return buildStrak(input);
    default:         return buildDonker(input);
  }
}

// ── Gedeelde HTML-renderers ────────────────────────────────────────────────────

function renderSidebar(sections: SidebarSection[]): string {
  return sections.map(({ title, items, isHobby }) => {
    const hdr = `<div class="sb-title">${esc(title.toUpperCase())}</div>`;

    if (isHobby) {
      const rows = items.map(({ label }) => `
        <div class="hobby-item">
          <div class="hobby-sq"></div>
          <span class="hobby-label">${esc(label)}</span>
        </div>`).join('');
      return `<div class="sb-section">${hdr}${rows}</div>`;
    }

    const rows = items.map(({ label, level }) => `
      <div class="sb-item">
        <span class="sb-label">${esc(label)}</span>
        <div class="sb-track"><div class="sb-fill" style="width:${level}%"></div></div>
      </div>`).join('');
    return `<div class="sb-section">${hdr}${rows}</div>`;
  }).join('\n');
}

function renderMain(sections: MainSection[], headerStyle: 'badge' | 'underline' | 'leftbar'): string {
  return sections.map(({ title, html }, i) => {
    const cls = `section-header${i === 0 ? ' first' : ''}`;
    return `
    <div class="main-section">
      <div class="${cls}">${esc(title.toUpperCase())}</div>
      <div class="section-body">${html}</div>
    </div>`;
  }).join('\n');
}

function renderContact(items: ContactItem[], linkClass: string): string {
  return items.map(({ icon, text, href }) => {
    const inner = href
      ? `<a href="${esc(href)}" class="${linkClass}">${esc(text)}</a>`
      : `<span>${esc(text)}</span>`;
    return `<div class="ci"><span class="ci-icon">${icon}</span>${inner}</div>`;
  }).join('\n');
}

// ── Gedeelde body-stijlen ──────────────────────────────────────────────────────

const SHARED = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Liberation Sans','DejaVu Sans',Arial,Helvetica,sans-serif;
    font-size: 9.5pt; color: #1a1a1a; width: 210mm; min-height: 297mm;
  }
  /* Geen bulletpoints in de hoofdkolom */
  .section-body ul { list-style:none; padding-left:0; }
  .section-body h3 { font-size:9.5pt; font-weight:700; color:#111; margin-top:9px; margin-bottom:1px; }
  .section-body h3:first-child { margin-top:0; }
  .section-body h3 + p { font-size:8.5pt; color:#666; margin-bottom:4px; }
  .section-body p { font-size:8.5pt; color:#333; line-height:1.55; margin-bottom:5px; }
  .section-body li { font-size:8.5pt; color:#333; line-height:1.5; margin-bottom:2px; }
  .section-body strong { font-weight:700; color:#111; }
  .section-body em { font-style:italic; }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .main-section { page-break-inside:avoid; }
    h3 { page-break-after:avoid; }
  }`;

// ── Template 1: Donker ─────────────────────────────────────────────────────────
// Donkere achtergrond, blauwe kaart die zweeft in de dark area, donkere sidebar.

function buildDonker({ name, jobTitle, contact, sidebar, main, accent, dark }: TemplateInput): string {
  const css = `${SHARED}
    body { background:${dark}; }
    .header-wrapper { background:${dark}; padding:9mm 9mm 0 9mm; }
    .header-card { background:${accent}; padding:13mm 14mm 12mm; }
    .cv-name { font-size:26pt; font-weight:700; color:#fff; letter-spacing:1px; text-transform:uppercase; line-height:1.1; word-break:break-word; }
    .cv-title { font-size:11pt; font-weight:400; color:rgba(255,255,255,.9); margin-top:4px; margin-bottom:12px; }
    .ci { display:flex; align-items:flex-start; gap:7px; margin-bottom:4px; font-size:7.5pt; color:rgba(255,255,255,.85); line-height:1.4; word-break:break-all; }
    .ci-icon { flex-shrink:0; width:14px; text-align:center; font-size:8pt; opacity:.9; }
    .ci-link { color:rgba(255,255,255,.85); text-decoration:none; }
    .columns { display:flex; min-height:calc(297mm - 75mm); }
    .sidebar { width:58mm; background:${dark}; flex-shrink:0; padding:8mm 7mm 8mm 9mm; }
    .main-content { flex:1; background:#fff; padding:9mm 11mm 9mm 9mm; }
    .sb-section { margin-bottom:8mm; }
    .sb-title { font-size:6.5pt; font-weight:700; letter-spacing:2px; color:rgba(255,255,255,.38); margin-bottom:8px; }
    .sb-item { margin-bottom:8px; }
    .sb-label { display:block; font-size:8.5pt; color:rgba(255,255,255,.85); margin-bottom:4px; line-height:1.3; }
    .sb-track { height:3px; background:rgba(255,255,255,.12); border-radius:2px; }
    .sb-fill { height:100%; background:${accent}; border-radius:2px; opacity:.9; }
    .hobby-item { display:flex; align-items:flex-start; gap:9px; margin-bottom:9px; }
    .hobby-sq { width:9px; height:9px; background:${accent}; flex-shrink:0; margin-top:3px; }
    .hobby-label { font-size:8.5pt; color:rgba(255,255,255,.85); line-height:1.35; }
    .section-header { background:${accent}; color:#fff; font-size:6.5pt; font-weight:700; letter-spacing:2px; padding:3px 8px; display:inline-block; margin-top:11px; margin-bottom:8px; }
    .section-header.first { margin-top:0; }
    .section-body a { color:${accent}; text-decoration:none; }`;

  const body = `
    <div class="header-wrapper">
      <div class="header-card">
        <div class="cv-name">${esc(name)}</div>
        ${jobTitle ? `<div class="cv-title">${esc(jobTitle)}</div>` : ''}
        ${renderContact(contact, 'ci-link')}
      </div>
    </div>
    <div class="columns">
      <div class="sidebar">${renderSidebar(sidebar)}</div>
      <div class="main-content">${renderMain(main, 'badge')}</div>
    </div>`;

  return html(css, body);
}

// ── Template 2: Klassiek ───────────────────────────────────────────────────────
// Volledige navy header-balk, lichte sidebar (#f0f4f8), sectiekoppen als onderstreepte tekst.

function buildKlassiek({ name, jobTitle, contact, sidebar, main, accent }: TemplateInput): string {
  const navy = '#1d3461';
  const css = `${SHARED}
    body { background:#fff; }
    .header { background:${navy}; padding:11mm 14mm 10mm; }
    .cv-name { font-size:24pt; font-weight:700; color:#fff; letter-spacing:0.5px; text-transform:uppercase; }
    .cv-title { font-size:10pt; color:rgba(255,255,255,.8); font-weight:400; margin-top:3px; margin-bottom:10px; }
    .contact-row { display:flex; flex-wrap:wrap; gap:3px 16px; }
    .ci { display:flex; align-items:center; gap:5px; font-size:7.5pt; color:rgba(255,255,255,.8); }
    .ci-icon { font-size:7.5pt; flex-shrink:0; }
    .ci-link { color:rgba(255,255,255,.8); text-decoration:none; }
    .columns { display:flex; min-height:calc(297mm - 52mm); }
    .sidebar { width:56mm; background:#f0f4f8; flex-shrink:0; padding:8mm 7mm 8mm 8mm; }
    .main-content { flex:1; background:#fff; padding:8mm 12mm 8mm 9mm; }
    .sb-section { margin-bottom:8mm; }
    .sb-title { font-size:6.5pt; font-weight:700; letter-spacing:2px; color:#94a3b8; margin-bottom:8px; }
    .sb-item { margin-bottom:8px; }
    .sb-label { display:block; font-size:8.5pt; color:#334155; margin-bottom:4px; line-height:1.3; }
    .sb-track { height:3px; background:#dde3ea; border-radius:2px; }
    .sb-fill { height:100%; background:${navy}; border-radius:2px; }
    .hobby-item { display:flex; align-items:flex-start; gap:9px; margin-bottom:9px; }
    .hobby-sq { width:9px; height:9px; background:${navy}; flex-shrink:0; margin-top:3px; }
    .hobby-label { font-size:8.5pt; color:#334155; line-height:1.35; }
    .section-header { font-size:7.5pt; font-weight:700; letter-spacing:2px; color:${navy}; border-bottom:2px solid ${navy}; padding-bottom:3px; display:block; margin-top:13px; margin-bottom:8px; }
    .section-header.first { margin-top:0; }
    .section-body a { color:${navy}; text-decoration:none; }`;

  const body = `
    <div class="header">
      <div class="cv-name">${esc(name)}</div>
      ${jobTitle ? `<div class="cv-title">${esc(jobTitle)}</div>` : ''}
      <div class="contact-row">${renderContact(contact, 'ci-link')}</div>
    </div>
    <div class="columns">
      <div class="sidebar">${renderSidebar(sidebar)}</div>
      <div class="main-content">${renderMain(main, 'underline')}</div>
    </div>`;

  return html(css, body);
}

// ── Template 3: Strak ──────────────────────────────────────────────────────────
// Naam + contact IN de gekleurde sidebar (geen aparte header), rechter kolom wit,
// sectiekoppen als gekleurde linkerbalk.

function buildStrak({ name, jobTitle, contact, sidebar, main, accent }: TemplateInput): string {
  const css = `${SHARED}
    body { background:#fff; }
    .cv-wrapper { display:flex; min-height:297mm; }
    .sidebar { width:62mm; background:${accent}; flex-shrink:0; padding:12mm 9mm 10mm; }
    .sidebar-header { margin-bottom:10mm; padding-bottom:9mm; border-bottom:1px solid rgba(255,255,255,.2); }
    .cv-name { font-size:15pt; font-weight:700; color:#fff; text-transform:uppercase; letter-spacing:0.5px; line-height:1.2; word-break:break-word; }
    .cv-title { font-size:8.5pt; color:rgba(255,255,255,.75); margin-top:5px; margin-bottom:11px; }
    .ci { display:flex; align-items:flex-start; gap:6px; margin-bottom:4px; font-size:7.5pt; color:rgba(255,255,255,.8); line-height:1.4; word-break:break-all; }
    .ci-icon { flex-shrink:0; width:13px; text-align:center; font-size:7.5pt; }
    .ci-link { color:rgba(255,255,255,.8); text-decoration:none; }
    .sb-section { margin-bottom:8mm; }
    .sb-title { font-size:6.5pt; font-weight:700; letter-spacing:2px; color:rgba(255,255,255,.38); margin-bottom:8px; }
    .sb-item { margin-bottom:8px; }
    .sb-label { display:block; font-size:8.5pt; color:rgba(255,255,255,.88); margin-bottom:4px; line-height:1.3; }
    .sb-track { height:3px; background:rgba(255,255,255,.15); border-radius:2px; }
    .sb-fill { height:100%; background:rgba(255,255,255,.8); border-radius:2px; }
    .hobby-item { display:flex; align-items:flex-start; gap:9px; margin-bottom:9px; }
    .hobby-sq { width:9px; height:9px; background:rgba(255,255,255,.8); flex-shrink:0; margin-top:3px; }
    .hobby-label { font-size:8.5pt; color:rgba(255,255,255,.88); line-height:1.35; }
    .main-content { flex:1; background:#fff; padding:12mm 12mm 10mm 10mm; }
    .section-header { font-size:7.5pt; font-weight:700; letter-spacing:2px; color:${accent}; border-left:3px solid ${accent}; padding-left:7px; display:block; margin-top:13px; margin-bottom:8px; }
    .section-header.first { margin-top:0; }
    .section-body a { color:${accent}; text-decoration:none; }`;

  const body = `
    <div class="cv-wrapper">
      <div class="sidebar">
        <div class="sidebar-header">
          <div class="cv-name">${esc(name)}</div>
          ${jobTitle ? `<div class="cv-title">${esc(jobTitle)}</div>` : ''}
          ${renderContact(contact, 'ci-link')}
        </div>
        ${renderSidebar(sidebar)}
      </div>
      <div class="main-content">${renderMain(main, 'leftbar')}</div>
    </div>`;

  return html(css, body);
}

// ── Hulpfuncties ───────────────────────────────────────────────────────────────

function html(css: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><style>${css}</style></head>
<body>${body}</body>
</html>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
