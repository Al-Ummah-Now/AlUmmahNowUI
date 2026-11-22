import { describe, expect, it } from 'vitest';
import { expandAbbreviations } from '../src/lib/expand.ts';

const page = (main: string) => `<html><body><nav>API</nav><main>${main}</main></body></html>`;

describe('abbreviations are spelled out where a page first uses them', () => {
  it('adds the meaning after the first use in prose, once', () => {
    const out = expandAbbreviations(page('<p>Records live in R2. Media lives in R2 too.</p>'), 'en', 'In this figure:');
    expect(out).toContain('Records live in R2 (Cloudflare’s object storage). Media lives in R2 too.');
  });
  it('a term inside a Latin isolate gets its meaning after the isolate, so the isolate stays one short Latin run', () => {
    const out = expandAbbreviations(page('<p>التخزين في <bdi dir="ltr" class="lr">Cloudflare R2</bdi>.</p>'), 'ar', 'x');
    expect(out).toContain('<bdi dir="ltr" class="lr">Cloudflare R2</bdi> (تخزين الكائنات لدى <bdi dir="ltr" class="lr">Cloudflare</bdi>).');
  });
  it('leaves a term already explained close by, headings and navigation', () => {
    const out = expandAbbreviations(page('<h2>The CDN</h2><p>Cloudflare’s content delivery network (CDN) serves every site.</p>'), 'en', 'x');
    expect(out).toContain('<h2>The CDN</h2>');
    expect(out).toContain('content delivery network (CDN) serves');
    expect(out).toContain('<nav>API</nav>');
  });
  it('names the terms a figure uses before the prose does, above the figure', () => {
    const fig = '<div class="an-frame"><div class="an-wide"><svg class="an"><title>KV map</title><text>TUS_SESSIONS</text><text>KV</text></svg></div></div>';
    const out = expandAbbreviations(page(`<p>Lead.</p>${fig}<p>KV again.</p>`), 'ar', 'في هذا المخطط:');
    expect(out).toContain('<p class="an-terms">في هذا المخطط: <bdi dir="ltr" class="lr">KV</bdi>: مخزن المفاتيح والقيم لدى <bdi dir="ltr" class="lr">Cloudflare</bdi>.</p><div class="an-frame">');
    expect(out).toContain('<p>KV again.</p>');
  });
  it('does not treat Workers AI as the abbreviation AI', () => {
    expect(expandAbbreviations(page('<p>Models run on Workers AI.</p>'), 'en', 'x')).toContain('<p>Models run on Workers AI.</p>');
  });
});

describe('glossary inserts never garble a sentence', () => {
  it('a term already in parentheses after its explanation gets no second bracket', () => {
    const out = expandAbbreviations(page('<p>كل طابور له طابور للرسائل الفاشلة (DLQ) خاص به.</p>'), 'ar', 'x');
    expect(out).toContain('طابور للرسائل الفاشلة (DLQ) خاص به.');
    expect(out).not.toMatch(/\(DLQ \(/);
    const en = expandAbbreviations(page('<p>Each queue has a dead-letter queue (DLQ).</p>'), 'en', 'x');
    expect(en).toContain('a dead-letter queue (DLQ).');
  });
  it('API and APIs count as one term, and units in rates are named', () => {
    const fig = '<div class="an-frame"><svg class="an"><text>APIs</text><text>api-videos · API</text><text>$0.015/GB-month</text><text>$4.50/M requests</text><text>$0.40/h</text></svg></div>';
    const out = expandAbbreviations(page(fig), 'en', 'In this figure:');
    expect(out).toContain('In this figure: APIs: application programming interfaces; GB: gigabytes; /M: per million; /h: per hour.');
  });
});

describe('Arabic prose isolates every Latin run, whichever component wrote it', () => {
  it('a ".NET" run keeps its dot, a drawing and an existing isolate are left alone, entities survive', async () => {
    const { isolateLatinProse } = await import('../src/lib/expand.ts');
    const out = isolateLatinProse(page('<p>طقم أدوات .NET للكتل &amp; غيره</p><p>في <bdi dir="ltr" class="lr">api-videos</bdi></p><svg><text>R2 هنا</text></svg>'));
    expect(out).toContain('<p>طقم أدوات <bdi dir="ltr" class="lr">.NET</bdi> للكتل &amp; غيره</p>');
    expect(out).toContain('<p>في <bdi dir="ltr" class="lr">api-videos</bdi></p>');
    expect(out).toContain('<svg><text>R2 هنا</text></svg>');
    expect(isolateLatinProse(page('<p>يعمل وحده — ومهامه منفصلة</p>'))).toContain('وحده\u00a0— ومهامه');
  });
});

describe('a value in prose never splits across lines', () => {
  it('ratios, a number and its unit, «كل» and a code call keep no-break spaces; drawings are left alone', async () => {
    const { bindProse, isolateLatinProse } = await import('../src/lib/expand.ts');
    const nb = ' ';
    expect(bindProse(page('<p>Page-speed samples, 1 in 20, every hour.</p>'))).toContain(`1${nb}in${nb}20, every${nb}hour.`);
    expect(isolateLatinProse(page('<p>تُحفظ ٩٠ يومًا، كل ساعة، ١ من ٢٠</p>'))).toContain(`٩٠${nb}يومًا، كل${nb}ساعة، ١${nb}من${nb}٢٠`);
    expect(bindProse(page('<p>can(role, capability)</p><svg><text>1 in 20</text></svg>'))).toContain(`can(role,${nb}capability)</p><svg><text>1 in 20</text>`);
    expect(bindProse(page('<p>reports · gates · cookies</p>'))).toContain(`reports${nb}· gates${nb}· cookies`);
  });
});
