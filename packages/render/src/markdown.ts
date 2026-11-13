/**
 * CMS markdown → HTML (SPEC §5/§6). Raw HTML is never passed through (markdown-it
 * `html: false` escapes it), unsafe link schemes are dropped by markdown-it's
 * validateLink, and `::video[ID]` on its own line renders the video facade.
 * Heading levels shift down by one: the page title is the only h1.
 */
import MarkdownIt from 'markdown-it';
import { VIDEO_ID } from './embeds';

const DIRECTIVE = /^::video\[([^\]\n]{1,80})\]\s*$/;

/** Ids of every well-formed `::video[ID]` line, in order, de-duplicated. */
export function extractVideoIds(markdown: string): string[] {
  const ids = new Set<string>();
  for (const line of markdown.split('\n')) {
    const m = line.trim().match(DIRECTIVE);
    if (m?.[1] && VIDEO_ID.test(m[1])) ids.add(m[1]);
  }
  return [...ids];
}

export interface RenderOptions {
  /** HTML for a video id, or '' when the video is not public (skipped silently). */
  renderVideo: (id: string) => string;
  /** HTML for an image the CMS described (responsive <picture>), or null for a plain lazy <img>. */
  renderImage?: (src: string, alt: string) => string | null;
}

type BlockRule = Parameters<InstanceType<typeof MarkdownIt>['block']['ruler']['before']>[2];

const videoRule: BlockRule = (state, startLine, _endLine, silent) => {
  const start = state.bMarks[startLine]! + state.tShift[startLine]!;
  const line = state.src.slice(start, state.eMarks[startLine]);
  const m = line.match(DIRECTIVE);
  if (!m?.[1] || !VIDEO_ID.test(m[1])) return false;
  if (silent) return true;
  const token = state.push('video_embed', '', 0);
  token.meta = { id: m[1] };
  token.map = [startLine, startLine + 1];
  state.line = startLine + 1;
  return true;
};

export function renderMarkdown(markdown: string, opts: RenderOptions): string {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: false, breaks: false });
  md.block.ruler.before('paragraph', 'video_embed', videoRule);
  md.renderer.rules.video_embed = (tokens, idx) => opts.renderVideo(String(tokens[idx]!.meta?.id ?? ''));

  const shift = (tag: string) => (/^h[1-5]$/.test(tag) ? `h${Number(tag.charAt(1)) + 1}` : tag);
  md.renderer.rules.heading_open = (tokens, idx, o, _env, self) => {
    tokens[idx]!.tag = shift(tokens[idx]!.tag);
    return self.renderToken(tokens, idx, o);
  };
  md.renderer.rules.heading_close = (tokens, idx, o, _env, self) => {
    tokens[idx]!.tag = shift(tokens[idx]!.tag);
    return self.renderToken(tokens, idx, o);
  };
  md.renderer.rules.link_open = (tokens, idx, o, _env, self) => {
    const href = String(tokens[idx]!.attrGet('href') ?? '');
    if (/^https?:\/\//i.test(href)) tokens[idx]!.attrSet('rel', 'noopener noreferrer');
    return self.renderToken(tokens, idx, o);
  };
  md.renderer.rules.image = (tokens, idx, o, env, self) => {
    const token = tokens[idx]!;
    // markdown-it's own image rule fills alt from the children; renderToken alone leaves it empty.
    const alt = self.renderInlineAsText(token.children ?? [], o, env);
    token.attrSet('alt', alt);
    const custom = opts.renderImage?.(String(token.attrGet('src') ?? ''), alt);
    if (custom) return custom;
    tokens[idx]!.attrSet('loading', 'lazy');
    tokens[idx]!.attrSet('decoding', 'async');
    return self.renderToken(tokens, idx, o);
  };
  return md.render(markdown ?? '');
}

/** Plain text for meta descriptions and RSS: markdown syntax and directives stripped. */
export function plainText(markdown: string, max = 200): string {
  const text = (markdown ?? '')
    .split('\n')
    .filter((l) => !DIRECTIVE.test(l.trim()))
    .join(' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/<[^>]*>/g, '')
    // and any stray angle bracket left by a broken tag: the result is plain text, never markup
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
