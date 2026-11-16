/**
 * Arabic pages show Eastern Arabic (Hindi) numerals ٠–٩ in every formatted value (owner,
 * 2026-11-15; AlUmmahNow#1488/#1496), the same on the Worker and in every browser. This guards the
 * whole repo (www, sites, dev, packages/render):
 *  - every formatter in packages/render/src/format.ts gives no Arabic numerals 0–9 in Arabic, and
 *    English keeps 0–9;
 *  - the Arabic UI strings have no hard-coded numbers (placeholders instead);
 *  - no `Intl.*` / `toLocale*String` display call outside the formatter, and no `ar-SA` / `ar-EG` /
 *    `nu-latn` locale literal in source (plain `ar` gives 0–9 in Node and Chromium but ٠–٩ in WebKit).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as f from '../../../packages/render/src/format';
import { fmt, formatDate } from '../src/i18n';
import { ar } from '../src/i18n/ar';
import { dayLabel, relativeTime } from '../src/lib/feed';
import { absoluteTime } from '../src/lib/timeline';
import { clockDuration } from '../src/lib/videos';
import { slideCountLabel } from '../src/lib/cards';
import { STRINGS as SITE_STRINGS } from '../../sites/src/lib/i18n';
import { formatDuration as siteDuration } from '../../sites/src/lib/data';
import { strings as devStrings } from '../../dev/src/i18n';
import { ar as devAr } from '../../dev/src/i18n/ar';
import { POST_STRINGS } from '../../../packages/render/src/posts/strings';

const ASCII = /[0-9]/;
const EASTERN = /[٠-٩]/;
const ROOT = join(__dirname, '../../..');
const when = Date.UTC(2026, 10, 15, 14, 5, 9);

describe('Arabic formatted values use Eastern Arabic (Hindi) numerals ٠–٩', () => {
  const arabic: Record<string, string> = {
    number: f.formatNumber(1234567.5, 'ar'),
    compact: f.formatCompact(12_345, 'ar'),
    percent: f.formatPercent(0.256, 'ar'),
    money: f.formatMoney(1234.5, 'USD', 'ar'),
    date: f.formatDate(when, 'ar'),
    time: f.formatTime(when, 'ar', { timeZone: 'UTC' }),
    dateTime: f.formatDateTime(when, 'ar', { timeZone: 'UTC' }),
    relative: f.formatRelative(when - 5 * 60_000, 'ar', when),
    relativeDays: f.formatRelative(when - 3 * 86_400_000, 'ar', when),
    duration: f.formatDuration(3725, 'ar'),
    shortDuration: f.formatDuration(65, 'ar'),
    year: f.formatYear(2026, 'ar'),
    fill: f.fill('الصفحة {page} من {pages}', { page: 2, pages: 12 }, 'ar'),
    wwwFmt: fmt('{count} مقالات', { count: 25 }, 'ar'),
    wwwDate: formatDate('2026-11-15T10:00:00Z', 'ar'),
    feedDay: dayLabel('2026-01-02', new Date(when), 'ar', { today: 'اليوم', yesterday: 'أمس' }),
    feedRelative: relativeTime(new Date(when - 3 * 3600_000).toISOString(), new Date(when), 'ar'),
    timelineAbsolute: absoluteTime(new Date(when).toISOString(), 'ar'),
    clock: clockDuration(4000, 'ar') ?? '',
    slides: slideCountLabel(ar.cards, 14, 'ar'),
    siteDuration: siteDuration(754, 'ar'),
  };

  for (const [name, value] of Object.entries(arabic)) {
    it(`${name}: «${value}»`, () => {
      expect(value).not.toMatch(ASCII);
      expect(value).toMatch(EASTERN);
    });
  }

  it('money in Arabic names the currency in Arabic, never «US$»', () => {
    expect(arabic.money).toBe('١٬٢٣٤٫٥٠ دولار أمريكي');
    expect(f.formatMoney(1234.5, 'USD', 'en')).toBe('US$1,234.50');
  });

  it('English keeps Arabic numerals 0–9 and its current formats', () => {
    expect(f.formatNumber(1234567.5, 'en')).toBe('1,234,567.5');
    expect(f.formatDuration(3725, 'en')).toBe('1:02:05');
    expect(formatDate('2026-11-15T10:00:00Z', 'en')).toBe('15 November 2026');
    expect(f.formatYear(2026, 'en')).toBe('2026');
    expect(fmt('Page {page} of {pages}', { page: 2, pages: 12 }, 'en')).toBe('Page 2 of 12');
    expect(f.formatYear(2026, 'ar')).toBe('٢٠٢٦');
  });

  it('day keys stay machine keys in Arabic numerals 0–9', () => {
    expect(f.dayKey(when, 'UTC')).toBe('2026-11-15');
  });

  it('inputs accept ٠–٩ (and Persian ۰–۹) and normalise them to 0–9', () => {
    expect(f.toAsciiDigits('٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789 0123456789');
    expect(f.toAsciiNumber('١٬٢٣٤٫٥')).toBe('1234.5');
  });
});

/** Every string leaf of a strings object. */
function leaves(v: unknown, path = ''): [string, string][] {
  if (typeof v === 'string') return [[path, v]];
  if (Array.isArray(v)) return v.flatMap((x, i) => leaves(x, `${path}[${i}]`));
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => leaves(x, path ? `${path}.${k}` : k));
  return [];
}

/** Text a reader sees: links, wiki labels and code names (D1, R2, OAuth 2.0, H.264, O31) are not numbers to format. */
const prose = (s: string) =>
  s
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\b(?:[A-Za-z][A-Za-z0-9.-]*\d[A-Za-z0-9.-]*|\d+(?:\.\d+)+)\b/g, '');

describe('Arabic UI strings have no hard-coded numbers (placeholders instead)', () => {
  const sets: [string, unknown][] = [
    ['www', ar],
    ['sites', SITE_STRINGS.ar],
    ['dev', devAr],
    ['posts', POST_STRINGS.ar],
  ];
  for (const [name, strings] of sets) {
    it(name, () => {
      const bad = leaves(strings).filter(([k, s]) => !/\.(href|url|feature)$|^.*\.sources\[\d+\]\.label$/.test(k) && /[0-9٠-٩]/.test(prose(s)));
      expect(bad).toEqual([]);
    });
  }

  it('dev copy fills its numbers per language', () => {
    expect(JSON.stringify(devStrings('ar'))).toContain('١٥');
    expect(JSON.stringify(devStrings('en'))).toContain('15 minutes');
  });
});

/** Source files of the repo's apps and packages (no tests, generated or vendored code). */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (['node_modules', 'dist', '.astro', '.wrangler', 'tests', 'e2e', 'public'].includes(name)) return [];
    if (statSync(p).isDirectory()) return sources(p);
    return /\.(ts|astro|js|mjs)$/.test(name) && !/\.generated\.|\.d\.ts$/.test(name) ? [p] : [];
  });
}

describe('one formatter: no Intl or toLocale*String display calls elsewhere', () => {
  const files = ['apps/www/src', 'apps/sites/src', 'apps/dev/src', 'packages/render/src'].flatMap((d) => sources(join(ROOT, d)));

  it('finds the sources', () => expect(files.length).toBeGreaterThan(50));

  it('Intl.* and toLocale*String only in packages/render/src/format.ts', () => {
    const bad = files
      .filter((p) => !p.endsWith(join('packages', 'render', 'src', 'format.ts')))
      .filter((p) => /\bIntl\.|\.toLocale(?:Date|Time)?String\(/.test(readFileSync(p, 'utf8')))
      .map((p) => relative(ROOT, p));
    expect(bad).toEqual([]);
  });

  it('no ar-SA, ar-EG or nu-latn locale literals', () => {
    const bad = files.filter((p) => /['"`]ar-(?:SA|EG)\b|nu-latn/.test(readFileSync(p, 'utf8'))).map((p) => relative(ROOT, p));
    expect(bad).toEqual([]);
  });
});
