/**
 * The site's one confirmation dialog for destructive actions (never window.confirm).
 *
 * Uses the server-rendered <dialog id="confirm-dialog"> in Header.astro (its Cancel
 * label is already localized): showModal() traps focus, focus starts on Cancel, and
 * Esc, a backdrop click or Cancel all resolve false. Only the danger button resolves true.
 */
export interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel: string;
}

export function confirmDialog({ title, body, confirmLabel }: ConfirmOptions): Promise<boolean> {
  const dialog = document.getElementById('confirm-dialog') as HTMLDialogElement | null;
  const heading = dialog?.querySelector<HTMLElement>('#confirm-dialog-title');
  const text = dialog?.querySelector<HTMLElement>('#confirm-dialog-body');
  const ok = dialog?.querySelector<HTMLButtonElement>('[data-confirm-ok]');
  const cancel = dialog?.querySelector<HTMLButtonElement>('[data-confirm-cancel]');
  // Without the dialog the action does not run: the safe answer
  if (!dialog || !heading || !text || !ok || !cancel || typeof dialog.showModal !== 'function' || dialog.open) return Promise.resolve(false);

  heading.textContent = title;
  text.textContent = body;
  ok.textContent = confirmLabel;

  return new Promise((resolve) => {
    const listeners = new AbortController();
    const { signal } = listeners;
    const done = (answer: boolean) => {
      listeners.abort();
      if (dialog.open) dialog.close();
      resolve(answer);
    };
    ok.addEventListener('click', () => done(true), { signal });
    cancel.addEventListener('click', () => done(false), { signal });
    // Esc
    dialog.addEventListener(
      'cancel',
      (e) => {
        e.preventDefault();
        done(false);
      },
      { signal },
    );
    // The backdrop is the only place a click lands on the <dialog> itself (the content is padded inside it)
    dialog.addEventListener(
      'click',
      (e) => {
        if (e.target === dialog) done(false);
      },
      { signal },
    );
    dialog.addEventListener('close', () => done(false), { signal });
    dialog.showModal();
    cancel.focus();
  });
}
