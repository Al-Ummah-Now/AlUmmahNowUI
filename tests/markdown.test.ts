import { describe, expect, it } from 'vitest';
import { extractVideoIds, plainText, renderMarkdown } from '../src/lib/markdown';

const render = (md: string, videos: Record<string, string> = {}) => renderMarkdown(md, { renderVideo: (id) => videos[id] ?? '' });

describe('markdown', () => {
  it('renders basic markdown and shifts headings below the page h1', () => {
    const html = render('# Title\n\nSome **bold** text.\n\n## Sub');
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<h3>Sub</h3>');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('never passes raw HTML through', () => {
    const html = render('<script>alert(1)</script>\n\nHi <img src=x onerror=alert(1)> there\n\n<iframe src="https://evil"></iframe>');
    expect(html).not.toMatch(/<script|<img|<iframe/i);
    expect(html).toContain('&lt;script&gt;');
  });

  it('drops javascript: and data: links', () => {
    const html = render('[x](javascript:alert(1)) [y](data:text/html,hi) [ok](https://example.com)');
    // left as inert text, never as a link
    expect(html).not.toMatch(/href="(javascript|data):/);
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toContain('href="https://example.com" rel="noopener noreferrer"');
  });

  it('renders ::video[ID] on its own line through renderVideo', () => {
    const html = render('Intro\n\n::video[abc-123]\n\nOutro', { 'abc-123': '<figure class="facade">V</figure>' });
    expect(html).toContain('<figure class="facade">V</figure>');
    expect(html).not.toContain('::video');
  });

  it('skips silently when the video is not public', () => {
    expect(render('::video[gone]')).toBe('');
  });

  it('ignores the directive inline or with an invalid id', () => {
    expect(render('see ::video[abc] here')).toContain('see ::video[abc] here');
    expect(render('::video[../../x]')).toContain('::video[../../x]');
    expect(extractVideoIds('::video[a]\ntext\n  ::video[b]  \n::video[a]\n::video[bad id]')).toEqual(['a', 'b']);
  });

  it('plainText strips syntax and directives', () => {
    expect(plainText('## Hello\n\n::video[x]\n\nA [link](https://a.b) and **bold**', 100)).toBe('Hello A link and bold');
    expect(plainText('a'.repeat(300), 10)).toHaveLength(10);
  });
});
