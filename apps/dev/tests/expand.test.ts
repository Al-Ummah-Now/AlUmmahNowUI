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
    expect(out).toContain('<bdi dir="ltr" class="lr">Cloudflare R2</bdi> (تخزين الكائنات لدى Cloudflare).');
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
    expect(out).toContain('<p class="an-terms">في هذا المخطط: KV: مخزن المفاتيح والقيم لدى Cloudflare.</p><div class="an-frame">');
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
