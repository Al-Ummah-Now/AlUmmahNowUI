/**
 * The site's own theme (wiki AUN-SCHOLAR-SITES §5.3): pinned `<id>@<version>` in its settings, chosen
 * in Studio, independent of the platform's theme. Only the built-in themes render today (their CSS is
 * vendored from the videos app into packages/render, AlUmmahNowUI#55 adds admin-made packages).
 */
import { DEFAULT_THEME, THEME_CHROME, THEME_IDS, type ThemeId } from '../../../../packages/render/src/themes/site-themes.generated';

export { THEME_CHROME, type ThemeId };

/** `fawanees@1.2.0` → `fawanees`; null when the ref names a theme this build can't render. */
export function themeIdOf(themeRef: string | null | undefined): ThemeId | null {
  const id = /^([a-z][a-z0-9-]{1,39})@\d+\.\d+\.\d+$/.exec(themeRef ?? '')?.[1];
  return id && (THEME_IDS as readonly string[]).includes(id) ? (id as ThemeId) : null;
}

/**
 * The theme a page renders. A ref this build can't render (a package before UI#55) is a
 * configuration error: it renders the default and the page is marked so it is never cached.
 */
export function renderTheme(themeRef: string): { id: ThemeId; exact: boolean } {
  const id = themeIdOf(themeRef);
  return id ? { id, exact: true } : { id: DEFAULT_THEME, exact: false };
}
