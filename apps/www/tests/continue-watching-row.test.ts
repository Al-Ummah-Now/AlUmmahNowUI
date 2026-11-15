// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { initContinueWatching, renderCard } from '../src/scripts/continue-watching';

describe('Continue watching row (client)', () => {
  const item = { id: 'v1', title: 'Patience', href: 'https://videos.test/en/video/v1', thumbnailUrl: 'https://img.test/1.jpg', channelName: 'Channel', durationSeconds: 754, percent: 40 };
  const mount = () => {
    document.body.innerHTML = `<section data-continue data-locale="ar" data-labels='{"watched":", {percent}% watched"}' hidden><ul data-continue-list></ul></section>`;
    return document.querySelector<HTMLElement>('[data-continue]')!;
  };

  it('a card: one link to the watch page, a progress bar, the duration, the percent for screen readers', () => {
    const li = renderCard(item, { watched: ', {percent}% watched' });
    const a = li.querySelector('a')!;
    expect(a.getAttribute('href')).toBe(item.href);
    expect(a.textContent).toBe('12:34Patience, 40% watched');
    expect(li.querySelector<HTMLElement>('.cw-progress > span')!.style.inlineSize).toBe('40%');
    expect(li.querySelector('.cw-progress')!.getAttribute('aria-hidden')).toBe('true');
    expect(li.querySelector('.cw-channel')!.textContent).toBe('Channel');
  });

  it('signed in with items: fills and shows the row; signed out: no request; failure or no items: stays hidden', async () => {
    const section = mount();
    const fetchImpl = vi.fn(async (url: string) => (expect(url).toBe('/auth/continue-watching?locale=ar'), Response.json({ items: [item, { href: 'javascript:x', title: 'bad' }] })));
    await initContinueWatching(document, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).not.toHaveBeenCalled();
    document.documentElement.setAttribute('data-signed-in', '');
    await initContinueWatching(document, fetchImpl as unknown as typeof fetch);
    expect(section.hidden).toBe(false);
    expect(section.querySelectorAll('li')).toHaveLength(1);
    for (const answer of [new Response('{}', { status: 401 }), Response.json({ items: [] })]) {
      const s = mount();
      await initContinueWatching(document, (async () => answer) as unknown as typeof fetch);
      expect(s.hidden).toBe(true);
    }
    document.documentElement.removeAttribute('data-signed-in');
  });
});
