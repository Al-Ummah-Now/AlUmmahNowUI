/** Video facade: replace the thumbnail with the embed iframe on click (SPEC §6). */
export function initFacades(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('.facade[data-embed-src]').forEach((figure) => {
    const button = figure.querySelector<HTMLButtonElement>('.facade-play');
    const frame = figure.querySelector<HTMLElement>('.facade-frame');
    if (!button || !frame) return;
    button.addEventListener('click', () => {
      const src = figure.dataset.embedSrc;
      if (!src) return;
      const iframe = document.createElement('iframe');
      iframe.className = 'facade-iframe';
      iframe.src = src;
      iframe.title = figure.dataset.embedTitle ?? '';
      iframe.loading = 'lazy';
      iframe.allow = 'autoplay; fullscreen; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.replaceChildren(iframe);
      iframe.focus();
    });
  });
}
