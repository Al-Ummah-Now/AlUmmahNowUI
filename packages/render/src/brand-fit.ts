/**
 * The header's wordmark is never shown cut ("الأمة…", "Sh. Mustaf…"): when the name doesn't fit
 * whole beside the tools (a phone with Sign in, a long scholar name), the bar shows the logo alone,
 * as the shared nav contract does below 400px, and the name stays the link's accessible name.
 * The class `aun-brand-mark-only` is styled in each app (visually hidden text, like the contract's
 * own below-400px rule). Re-checked when the bar or its tools change size (the account button
 * replacing Sign in, a rotation) and once the fonts are in.
 */
export const BRAND_MARK_ONLY = 'aun-brand-mark-only';

export function fitBrand(root: ParentNode = document): void {
  const brand = root.querySelector<HTMLElement>('.site-header .aun-brand');
  const name = brand?.querySelector<HTMLElement>('.aun-brand-name');
  if (!brand || !name) return;
  const check = () => {
    // measure with the name shown, then hide it only if it would be cut
    brand.classList.remove(BRAND_MARK_ONLY);
    brand.classList.toggle(BRAND_MARK_ONLY, name.scrollWidth > name.clientWidth + 1);
  };
  check();
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(check);
    for (const el of root.querySelectorAll<HTMLElement>('.site-header .aun-header-row, .site-header .aun-header-tools')) ro.observe(el);
  }
  void document.fonts?.ready.then(check);
}
