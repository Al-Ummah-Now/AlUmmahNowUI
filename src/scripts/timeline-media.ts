/**
 * The home timeline's videos (src/components/FeedCard.astro, Timeline.astro):
 *
 *  - Hover preview: resting the mouse on a video post plays it in place, muted, from the videos
 *    platform's public play API (GET {api}/videos/{id}/play, an MP4 with sound; AlUmmahNow
 *    docs/embeds/README.md §8). Play/pause, sound
 *    and progress controls appear with it; they act on the preview only and never open the post.
 *    No preview under reduced motion, on touch (no hover) or with Save-Data.
 *  - Shorts viewer: a click on a Short (its player surface) opens a full-screen dialog with one
 *    Short per screen; scroll or swipe up (or ↑ ↓, Page Up/Down) for the next one, from
 *    GET {api}/shorts?after={id}. Esc or Close returns focus to the Short. It starts with sound (the
 *    click allows it), falling back to muted; under reduced motion nothing plays until Play.
 *
 * When the API is not configured or does not answer, nothing changes: the facade's own click plays
 * the video in place (src/scripts/facade.ts). Everything is delegated from the timeline root, so
 * posts appended by "Load more" work without setup.
 */

export interface PlayInfo {
  id: string;
  format: 'short' | 'video';
  title: string;
  channelName: string | null;
  channelHandle?: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  poster: string | null;
  mp4: { url: string; width: number | null; height: number | null } | null;
  hls: string | null;
  expiresAt: string;
  watchUrl: string;
}

const ICON = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5 3.2v9.6L12.6 8z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4.5 3h2.5v10H4.5zm4.5 0h2.5v10H9z" fill="currentColor"/></svg>',
  off: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2.5 6h2.5L8.5 3v10L5 10H2.5z" fill="currentColor"/><path d="m11 6 3.5 4m0-4L11 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  on: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M2.5 6h2.5L8.5 3v10L5 10H2.5z" fill="currentColor"/><path d="M10.8 5.6a3.4 3.4 0 0 1 0 4.8M12.6 3.8a6 6 0 0 1 0 8.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m3.5 3.5 9 9m0-9-9 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  up: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 10 8 5.5 12.5 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = () => matchMedia('(hover: hover)').matches;
const saveData = () => !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? String(v[k]) : m));

/** A play answer we can use: an https MP4 (Chrome cannot play HLS in a plain <video>). */
export function playable(info: unknown): info is PlayInfo & { mp4: { url: string } } {
  if (!info || typeof info !== 'object') return false;
  const i = info as Partial<PlayInfo>;
  return typeof i.id === 'string' && typeof i.title === 'string' && !!i.mp4 && typeof i.mp4.url === 'string' && /^https:\/\//.test(i.mp4.url);
}

/** The next page of Shorts: valid items only (the viewer skips anything it cannot play). */
export function shortsPage(body: unknown): { items: (PlayInfo & { mp4: { url: string } })[]; next: string | null } {
  if (!body || typeof body !== 'object') return { items: [], next: null };
  const b = body as { items?: unknown; next?: unknown };
  const items = Array.isArray(b.items) ? b.items.filter(playable) : [];
  return { items, next: typeof b.next === 'string' && b.next ? b.next : null };
}

const cache = new Map<string, Promise<PlayInfo | null>>();
function playInfo(api: string, id: string): Promise<PlayInfo | null> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`${api}/videos/${encodeURIComponent(id)}/play`, { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: unknown) => (playable(j) ? j : null))
      .catch(() => null);
    cache.set(id, p);
    // a failure may be passing: try again on the next hover
    void p.then((v) => v || cache.delete(id));
  }
  return p;
}

function setMute(btn: HTMLButtonElement, muted: boolean, t: DOMStringMap, withLabel: boolean) {
  btn.setAttribute('aria-pressed', String(!muted));
  btn.setAttribute('aria-label', muted ? t.tUnmute ?? '' : t.tMute ?? '');
  btn.innerHTML = (muted ? ICON.off : ICON.on) + (withLabel ? `<span>${muted ? t.tSoundOff ?? '' : t.tSoundOn ?? ''}</span>` : '');
}
function setPlay(btn: HTMLButtonElement, playing: boolean, playLabel: string, pauseLabel: string) {
  btn.setAttribute('aria-label', playing ? pauseLabel : playLabel);
  btn.innerHTML = playing ? ICON.pause : ICON.play;
}

/* ------------------------------ hover preview ------------------------------ */

function initPreview(root: HTMLElement, api: string) {
  const t = root.dataset;
  let timer = 0;

  function video(wrap: HTMLElement): HTMLVideoElement | null {
    return wrap.querySelector<HTMLVideoElement>('video.tl-preview');
  }

  async function start(wrap: HTMLElement) {
    if (wrap.querySelector('.facade-iframe')) return; // the real player is open
    const existing = video(wrap);
    if (existing) {
      void existing.play().catch(() => {});
      return;
    }
    const info = await playInfo(api, wrap.dataset.videoId!);
    if (!info?.mp4 || !wrap.matches(':hover')) return;
    const frame = wrap.querySelector<HTMLElement>('.facade-frame');
    if (!frame || frame.querySelector('.facade-iframe')) return;
    const v = document.createElement('video');
    v.className = 'tl-preview';
    v.muted = true;
    v.playsInline = true;
    v.loop = true;
    v.preload = 'auto';
    v.setAttribute('aria-hidden', 'true');
    v.disablePictureInPicture = true;
    if (info.poster) v.poster = info.poster;
    v.src = info.mp4.url;
    // A file the CDN does not have (an old import without that rendition): keep the poster, no controls
    v.addEventListener('error', () => {
      v.remove();
      delete wrap.dataset.previewing;
      const c = wrap.querySelector<HTMLElement>('[data-vctl]');
      if (c) c.hidden = true;
    });
    frame.querySelector('.facade-play')?.before(v);
    const ctl = wrap.querySelector<HTMLElement>('[data-vctl]');
    const prog = wrap.querySelector<HTMLElement>('[data-vprog]');
    const playBtn = wrap.querySelector<HTMLButtonElement>('[data-vplay]');
    v.addEventListener('playing', () => {
      wrap.dataset.previewing = '';
      if (ctl) ctl.hidden = false;
    });
    v.addEventListener('play', () => playBtn && setPlay(playBtn, true, t.tPreviewPlay ?? '', t.tPreviewPause ?? ''));
    v.addEventListener('pause', () => playBtn && setPlay(playBtn, false, t.tPreviewPlay ?? '', t.tPreviewPause ?? ''));
    v.addEventListener('timeupdate', () => {
      if (prog && v.duration) prog.style.inlineSize = `${(v.currentTime / v.duration) * 100}%`;
    });
    void v.play().catch(() => {});
  }

  root.addEventListener('pointerover', (e) => {
    if (e.pointerType !== 'mouse' || reduced() || saveData() || !canHover()) return;
    const wrap = (e.target as Element).closest<HTMLElement>('.tl-mwrap[data-video-id]');
    if (!wrap || wrap.contains(e.relatedTarget as Node | null)) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => void start(wrap), 220);
  });
  root.addEventListener('pointerout', (e) => {
    const wrap = (e.target as Element).closest<HTMLElement>('.tl-mwrap[data-video-id]');
    if (!wrap || wrap.contains(e.relatedTarget as Node | null)) return;
    clearTimeout(timer);
    video(wrap)?.pause();
  });

  // The controls act on the preview only: never the facade, the post link or the Shorts viewer.
  root.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-vctl] button');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const wrap = btn.closest<HTMLElement>('.tl-mwrap')!;
    const v = video(wrap);
    if (!v) return;
    if (btn.hasAttribute('data-vmute')) {
      v.muted = !v.muted;
      setMute(btn, v.muted, t, true);
      if (!v.muted && v.paused) void v.play().catch(() => {});
    } else if (btn.hasAttribute('data-vplay')) {
      if (v.paused) void v.play().catch(() => {});
      else v.pause();
    }
  });

  // The real player (a click on the surface of a regular video) replaces the preview.
  root.addEventListener(
    'click',
    (e) => {
      const play = (e.target as Element).closest('.facade-play');
      const wrap = play?.closest<HTMLElement>('.tl-mwrap');
      if (!wrap || wrap.hasAttribute('data-short')) return;
      video(wrap)?.pause();
      const ctl = wrap.querySelector<HTMLElement>('[data-vctl]');
      if (ctl) ctl.hidden = true;
      delete wrap.dataset.previewing;
    },
    true,
  );
}

/* ------------------------------ Shorts viewer ------------------------------ */

function initShorts(root: HTMLElement, api: string) {
  const t = root.dataset;
  let dlg: HTMLDialogElement | null = null;

  root.addEventListener(
    'click',
    (e) => {
      const target = e.target as Element;
      if (target.closest('[data-vctl]')) return; // the preview's controls never open the viewer
      const play = target.closest<HTMLButtonElement>('.facade-play');
      const wrap = play?.closest<HTMLElement>('.tl-mwrap[data-short][data-video-id]');
      if (!play || !wrap || wrap.dataset.viewer === 'off') return;
      // ours, not the facade's in-place player
      e.preventDefault();
      e.stopPropagation();
      void open(wrap, play);
    },
    true,
  );

  async function open(wrap: HTMLElement, opener: HTMLButtonElement) {
    wrap.querySelector<HTMLVideoElement>('video.tl-preview')?.pause();
    const first = await playInfo(api, wrap.dataset.videoId!);
    if (!first?.mp4) {
      // no playable file: the facade plays it in place, as before
      wrap.dataset.viewer = 'off';
      opener.click();
      return;
    }
    new Viewer(t, api, first as PlayInfo & { mp4: { url: string } }, opener).show();
  }

  class Viewer {
    readonly el: HTMLDialogElement;
    readonly track: HTMLElement;
    readonly live: HTMLElement;
    readonly prev: HTMLButtonElement;
    readonly next: HTMLButtonElement;
    items: HTMLElement[] = [];
    infos: PlayInfo[] = [];
    current = -1;
    muted = false;
    paused = false;
    cursor: string | null = null;
    loading = false;
    io: IntersectionObserver;

    constructor(
      readonly s: DOMStringMap,
      readonly apiBase: string,
      first: PlayInfo,
      readonly opener: HTMLElement,
    ) {
      dlg?.remove();
      const el = document.createElement('dialog');
      el.className = 'sv';
      el.setAttribute('aria-label', s.tShorts ?? '');
      el.innerHTML = `<div class="sv-top"><b></b><button type="button" class="sv-btn" data-sv-close>${ICON.close}</button></div>
        <div class="sv-track" data-sv-track></div>
        <div class="sv-nav"><button type="button" class="sv-btn" data-sv-step="-1">${ICON.up}</button><button type="button" class="sv-btn" data-sv-step="1">${ICON.down}</button></div>
        <p class="visually-hidden" aria-live="polite" data-sv-live></p>`;
      el.querySelector('b')!.textContent = s.tShorts ?? '';
      el.querySelector('[data-sv-close]')!.setAttribute('aria-label', s.tCloseShorts ?? '');
      this.prev = el.querySelector<HTMLButtonElement>('[data-sv-step="-1"]')!;
      this.next = el.querySelector<HTMLButtonElement>('[data-sv-step="1"]')!;
      this.prev.setAttribute('aria-label', s.tPrevShort ?? '');
      this.next.setAttribute('aria-label', s.tNextShort ?? '');
      this.track = el.querySelector<HTMLElement>('[data-sv-track]')!;
      this.live = el.querySelector<HTMLElement>('[data-sv-live]')!;
      this.el = el;
      dlg = el;
      this.io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && this.select(this.items.indexOf(e.target as HTMLElement))), { root: this.track, threshold: 0.6 });
      this.add([first]);
      this.wire();
    }

    add(list: PlayInfo[]) {
      for (const info of list) {
        if (this.infos.some((i) => i.id === info.id)) continue;
        const n = this.infos.length + 1;
        const item = document.createElement('section');
        item.className = 'sv-item';
        item.setAttribute('aria-label', fill(this.s.tShortPosition ?? '{n}: {title}', { n, title: info.title }));
        item.innerHTML = `<div class="sv-player"><video playsinline loop preload="metadata" aria-hidden="true"></video>
          <div class="sv-info"><p class="sv-title" dir="auto"></p><p class="sv-meta"><span dir="auto"></span><a class="sv-watch"></a></p></div>
          <div class="sv-side"><button type="button" class="sv-btn" data-sv-play></button><button type="button" class="sv-btn" data-sv-mute></button></div>
          <span class="sv-prog" aria-hidden="true"><i></i></span></div>`;
        const v = item.querySelector('video')!;
        v.src = info.mp4!.url;
        if (info.poster) v.poster = info.poster;
        item.querySelector('.sv-title')!.textContent = info.title;
        item.querySelector('.sv-meta span')!.textContent = info.channelName ?? '';
        const watch = item.querySelector<HTMLAnchorElement>('.sv-watch')!;
        // the API's watch link is English; the viewer speaks the page's language
        watch.href = document.documentElement.lang === 'ar' ? info.watchUrl.replace('/en/', '/ar/') : info.watchUrl;
        watch.textContent = this.s.tWatchOn ?? '';
        const bar = item.querySelector<HTMLElement>('.sv-prog i')!;
        v.addEventListener('timeupdate', () => {
          if (v.duration) bar.style.inlineSize = `${(v.currentTime / v.duration) * 100}%`;
        });
        this.track.append(item);
        this.items.push(item);
        this.infos.push(info);
        this.io.observe(item);
      }
      this.sync();
    }

    /** The next page of Shorts after the last one shown (the API's `next`, else the last id). */
    async more() {
      if (this.loading || this.loadedAll) return;
      this.loading = true;
      try {
        const after = this.cursor ?? this.infos[this.infos.length - 1]!.id;
        const r = await fetch(`${this.apiBase}/shorts?after=${encodeURIComponent(after)}&limit=10`, { credentials: 'omit' });
        const page = shortsPage(r.ok ? await r.json() : null);
        this.add(page.items);
        this.cursor = page.next;
        if (!page.next || !page.items.length) this.loadedAll = true;
      } catch {
        this.loadedAll = true; // the viewer keeps what it has
      } finally {
        this.loading = false;
        this.sync();
      }
    }
    loadedAll = false;

    video(i: number) {
      return this.items[i]?.querySelector('video') ?? null;
    }

    select(i: number) {
      if (i < 0 || i === this.current) return;
      this.current = i;
      this.items.forEach((_, k) => {
        if (k === i) return;
        const v = this.video(k)!;
        v.pause();
        v.currentTime = 0;
      });
      this.paused = reduced();
      if (!this.paused) this.play();
      this.live.textContent = fill(this.s.tShortPosition ?? '{n}: {title}', { n: i + 1, title: this.infos[i]!.title });
      if (i >= this.items.length - 2 && !this.loadedAll) void this.more();
      this.sync();
    }

    play() {
      const v = this.video(this.current);
      if (!v) return;
      v.muted = this.muted;
      v.play().catch(() => {
        // sound refused: play muted, the sound button says so
        if (this.muted) return;
        this.muted = true;
        v.muted = true;
        this.sync();
        void v.play().catch(() => {});
      });
    }

    go(i: number) {
      const target = Math.max(0, Math.min(this.items.length - 1, i));
      this.track.scrollTo({ top: this.items[target]!.offsetTop, behavior: reduced() ? 'auto' : 'smooth' });
      this.select(target);
    }

    sync() {
      this.items.forEach((item, k) => {
        const playing = k === this.current && !this.paused;
        setPlay(item.querySelector<HTMLButtonElement>('[data-sv-play]')!, playing, this.s.tPlayShort ?? '', this.s.tPauseShort ?? '');
        setMute(item.querySelector<HTMLButtonElement>('[data-sv-mute]')!, this.muted, this.s, false);
        this.video(k)!.muted = this.muted;
      });
      this.prev.disabled = this.current <= 0;
      this.next.disabled = this.current >= this.items.length - 1 && this.loadedAll;
    }

    wire() {
      const el = this.el;
      el.addEventListener('click', (e) => {
        const b = (e.target as Element).closest<HTMLButtonElement>('button');
        if (!b) return;
        if (b.hasAttribute('data-sv-close')) el.close();
        else if (b.hasAttribute('data-sv-mute')) {
          this.muted = !this.muted;
          this.sync();
          if (!this.muted && !this.paused) this.play();
        } else if (b.hasAttribute('data-sv-play')) {
          this.paused = !this.paused;
          if (this.paused) this.video(this.current)?.pause();
          else this.play();
          this.sync();
        } else if (b.dataset.svStep) {
          const step = Number(b.dataset.svStep);
          if (step > 0 && this.current >= this.items.length - 1) void this.more().then(() => this.go(this.current + 1));
          else this.go(this.current + step);
        }
      });
      el.addEventListener('keydown', (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (['ArrowDown', 'PageDown', 'j'].includes(e.key)) {
          e.preventDefault();
          this.go(this.current + 1);
        } else if (['ArrowUp', 'PageUp', 'k'].includes(e.key)) {
          e.preventDefault();
          this.go(this.current - 1);
        }
      });
      el.addEventListener('close', () => {
        this.items.forEach((_, k) => this.video(k)?.pause());
        this.io.disconnect();
        document.documentElement.classList.remove('sv-open');
        el.remove();
        if (dlg === el) dlg = null;
        this.opener.focus();
      });
    }

    show() {
      document.body.append(this.el);
      document.documentElement.classList.add('sv-open');
      this.el.showModal();
      this.el.querySelector<HTMLButtonElement>('[data-sv-close]')!.focus();
      this.select(0);
      void this.more();
    }
  }
}

export function initTimelineMedia(doc: ParentNode = document) {
  doc.querySelectorAll<HTMLElement>('[data-timeline][data-play-api]:not([data-media-ready])').forEach((root) => {
    const api = root.dataset.playApi!;
    initPreview(root, api);
    initShorts(root, api);
    root.dataset.mediaReady = '';
  });
}
