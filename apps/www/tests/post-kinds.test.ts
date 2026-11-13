/** Scholar posts of community kinds (src/lib/post-kinds.ts): text stays text, outside links are safe. */
import { describe, expect, it } from 'vitest';
import { isArticleKind, linkHost, plainLines, safeOutsideUrl } from '../../../packages/render/src/posts/post-kinds';
import { POST_STRINGS } from '../../../packages/render/src/posts/strings';
import { POST_FIXTURES, POST_KINDS, postSummary } from '../../../packages/render/src/posts/post-schema.generated';

describe('post kinds', () => {
  it('turns a text post into plain paragraphs (no HTML, entities decoded once)', () => {
    expect(plainLines('<p>Hello <b>world</b></p><p>Second &amp;lt;b&amp;gt;</p><script>x</script>')).toEqual(['Hello world', 'Second &lt;b&gt;', 'x']);
    expect(plainLines('a<br>b\n\nc')).toEqual(['a\nb', 'c']);
  });
  it('keeps http(s) outside links only', () => {
    expect(safeOutsideUrl('https://example.org/a')).toBe('https://example.org/a');
    expect(safeOutsideUrl('javascript:alert(1)')).toBeNull();
    expect(safeOutsideUrl('data:text/html,x')).toBeNull();
    expect(linkHost('https://www.example.org/x')).toBe('example.org');
  });
  it('article and cards render with PostArticle, every other kind with PostKindBody', () => {
    expect(POST_KINDS.filter((k) => isArticleKind(k))).toEqual(['article', 'cards']);
    expect(isArticleKind(undefined)).toBe(true);
  });
  it('the vendored schema summarises every shared fixture', () => {
    for (const k of POST_KINDS) expect(postSummary(POST_FIXTURES[k]).kind).toBe(k);
  });
  it('the shared post strings have the same keys in en and ar', () => {
    expect(Object.keys(POST_STRINGS.ar).sort()).toEqual(Object.keys(POST_STRINGS.en).sort());
  });
});
