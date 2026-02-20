// src/utils/pdf.ts
import puppeteer from 'puppeteer';
import { marked } from 'marked';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import {
  buildTemplate, TemplateName, SidebarItem, SidebarSection, MainSection,
  ALWAYS_SIDEBAR, SMART_SIDEBAR, HOBBY_TITLES, isHobbyTitle,
} from './cv-templates';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CVFrontmatter {
  name?:      string;
  title?:     string;
  email?:     string;
  phone?:     string;
  linkedin?:  string;
  github?:    string;
  location?:  string;
  version?:   number;
  date?:      string;
  target?:    string;
  accent?:    string;
  darkColor?: string;
  template?:  string;
}

// ── Parsers (geëxporteerd voor gebruik in workflows) ───────────────────────────

export function parseFrontmatter(content: string): { fm: CVFrontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { fm: {}, body: content };
  try {
    const fm = yaml.load(match[1]) as CVFrontmatter;
    return { fm: fm || {}, body: match[2].trim() };
  } catch {
    return { fm: {}, body: content };
  }
}

export interface Section { title: string; rawMd: string; }

export function parseSections(body: string): Section[] {
  const sections: Section[] = [];
  const parts = body.split(/^## /m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const nl = part.indexOf('\n');
    const title = (nl > -1 ? part.slice(0, nl) : part).trim();
    const rawMd = nl > -1 ? part.slice(nl + 1).trim() : '';
    sections.push({ title, rawMd });
  }
  return sections;
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

export function parseSkillItem(line: string): SidebarItem {
  const text = stripMarkdown(line.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, ''));

  const numMatch = text.match(/^(.+?)\s*\((\d{1,3})%?\)\s*$/);
  if (numMatch) return { label: numMatch[1].trim(), level: Math.min(100, parseInt(numMatch[2], 10)) };

  const kwMatch = text.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (kwMatch) {
    const kw = kwMatch[2].trim().toLowerCase();
    const level = LEVEL_KEYWORDS[kw];
    if (level !== undefined) return { label: kwMatch[1].trim(), level };
  }

  return { label: text, level: 70 };
}

export function parseSidebarItems(rawMd: string): SidebarItem[] {
  const listLines = rawMd.split('\n').filter(l => /^[-*•]\s+/.test(l));
  if (listLines.length > 0) return listLines.map(parseSkillItem);
  return rawMd.split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => ({ label: stripMarkdown(l), level: 70 }));
}

const LEVEL_KEYWORDS: Record<string, number> = {
  moedertaal: 100, native: 100,
  expert: 90,
  professioneel: 80, professional: 80, c1: 80, c2: 95,
  gevorderd: 70, advanced: 70, b2: 70,
  gemiddeld: 55, intermediate: 55, b1: 55,
  basis: 35, basic: 35, a2: 35,
  beginner: 20, a1: 20,
};

// ── Sectie-routing ─────────────────────────────────────────────────────────────

export function isSidebarSection(section: Section): boolean {
  const t = section.title.toLowerCase().trim();
  if (ALWAYS_SIDEBAR.has(t)) return true;
  if (SMART_SIDEBAR.has(t)) return /^[-*•]\s+/m.test(section.rawMd);
  return false;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function generateCVPdf(
  mdPath:  string,
  pdfPath: string,
  accent = '#2e6cb2'
): Promise<void> {
  const content = fs.readFileSync(mdPath, 'utf-8');
  const { fm, body } = parseFrontmatter(content);

  const accentColor    = fm.accent    || accent;
  const darkColor      = fm.darkColor || '#1e2936';
  const templateName   = (fm.template || 'donker') as TemplateName;

  const sections        = parseSections(body);
  const sidebarSections = sections.filter(isSidebarSection);
  const mainSections    = sections.filter(s => !isSidebarSection(s));

  // Sidebar opbouwen
  const sidebar: SidebarSection[] = sidebarSections.map(s => ({
    title:   s.title,
    items:   parseSidebarItems(s.rawMd),
    isHobby: isHobbyTitle(s.title),
  }));

  // Hoofdkolom omzetten naar HTML
  const main: MainSection[] = await Promise.all(
    mainSections.map(async s => ({
      title: s.title,
      html:  await marked.parse(s.rawMd),
    }))
  );

  // Contactitems
  const contact = buildContact(fm);

  const pageHtml = buildTemplate(templateName, {
    name:     fm.name     || '',
    jobTitle: fm.title    || '',
    contact,
    sidebar,
    main,
    accent:   accentColor,
    dark:     darkColor,
  });

  fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

  const executablePath = process.env.CHROME_PATH
    || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']
       .find(p => { try { fs.accessSync(p); return true; } catch { return false; } });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox',
           '--disable-dev-shm-usage', '--disable-gpu', '--disable-software-rasterizer'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(pageHtml, { waitUntil: 'load' });
    await page.pdf({
      path: pdfPath, format: 'A4', printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  } finally {
    await browser.close();
  }
}

// ── Contactitems opbouwen ─────────────────────────────────────────────────────

function buildContact(fm: CVFrontmatter) {
  const items = [];
  if (fm.email)    items.push({ icon: '✉', text: fm.email,   href: `mailto:${fm.email}` });
  if (fm.phone)    items.push({ icon: '☎', text: fm.phone });
  if (fm.location) items.push({ icon: '⊙', text: fm.location });
  if (fm.github)   items.push({ icon: 'gh', text: `github.com/${fm.github}`, href: `https://github.com/${fm.github}` });
  if (fm.linkedin) items.push({ icon: 'in', text: fm.linkedin, href: ensureHttps(fm.linkedin) });
  return items;
}

function ensureHttps(url: string): string {
  return url.startsWith('http') ? url : `https://${url}`;
}
