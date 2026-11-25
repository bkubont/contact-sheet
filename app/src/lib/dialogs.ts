/**
 * In-app confirm / text / notice dialogs, replacing the browser's confirm(),
 * prompt() and alert() (which look out of place in an installed app and can be
 * blocked in iOS standalone mode). Callable from anywhere, including sync and
 * storage code; <DialogHost/> shows them one at a time.
 */

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button. */
  danger?: boolean;
  /** Ask the person to type this word before the confirm button works. */
  typeToConfirm?: string;
};
export type TextOptions = {
  title: string;
  message?: string;
  label?: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
};
export type NoticeOptions = { title: string; message?: string; okLabel?: string };

export type Dialog =
  | ({ kind: 'confirm'; resolve: (ok: boolean) => void } & ConfirmOptions)
  | ({ kind: 'text'; resolve: (value: string | null) => void } & TextOptions)
  | ({ kind: 'notice'; resolve: () => void } & NoticeOptions);

const queue: Dialog[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

export const Dialogs = {
  current(): Dialog | null {
    return queue[0] ?? null;
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
  /** Called by the host when the person answers the dialog on screen. */
  finish() {
    queue.shift();
    emit();
  },
};

function push(d: Dialog) {
  queue.push(d);
  emit();
}

export function askConfirm(o: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => push({ kind: 'confirm', resolve, ...o }));
}

/** Resolves to the trimmed text, or null if cancelled or left empty. */
export function askText(o: TextOptions): Promise<string | null> {
  return new Promise((resolve) => push({ kind: 'text', resolve, ...o }));
}

export function notify(o: NoticeOptions): Promise<void> {
  return new Promise((resolve) => push({ kind: 'notice', resolve, ...o }));
}
