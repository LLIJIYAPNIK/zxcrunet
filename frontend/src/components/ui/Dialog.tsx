"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { ru } from "@/i18n/ru";

import { buttonClass } from "./Button";

type DialogProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * In-page modal on top of the native `<dialog>`: focus trap, Esc and the top layer come
 * from the browser, the look comes from the palette.
 */
export function Dialog({ title, onClose, children, footer, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof el.showModal === "function") el.showModal();
    else el.setAttribute("open", "");
    return () => {
      if (typeof el.close === "function") el.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-32px)] max-w-[440px] rounded-[20px] border border-line-2 bg-surface p-0 text-ink",
        "shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_25%,transparent),0_30px_80px_-20px_var(--glow)]",
        "transition-[opacity,transform] duration-200 ease-neon starting:scale-95 starting:opacity-0",
        "backdrop:bg-[rgba(4,6,10,.72)] backdrop:backdrop-blur-[3px]",
        className,
      )}
    >
      <div className="flex flex-col gap-3 p-6">
        <h2 id={titleId} className="font-display text-h3 font-medium">
          {title}
        </h2>
        {children}
      </div>
      {footer && (
        <div className="flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
          {footer}
        </div>
      )}
    </dialog>
  );
}

export type ConfirmOptions = {
  title: string;
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive action: red button, focus starts on «Отмена». */
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

/**
 * Promise-based replacement for `window.confirm`:
 * `const { confirm, dialog } = useConfirm()`, render `{dialog}`, then `await confirm({...})`.
 */
export function useConfirm(): {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  dialog: ReactNode;
} {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  const t = ru.dialog;
  const dialog = pending ? (
    <Dialog
      title={pending.title}
      onClose={() => settle(false)}
      footer={
        <>
          <button
            type="button"
            autoFocus={pending.danger}
            onClick={() => settle(false)}
            className={buttonClass({ variant: "secondary" })}
          >
            {pending.cancelLabel ?? t.cancel}
          </button>
          <button
            type="button"
            autoFocus={!pending.danger}
            onClick={() => settle(true)}
            className={buttonClass({ variant: pending.danger ? "danger" : "primary" })}
          >
            {pending.confirmLabel ?? t.confirm}
          </button>
        </>
      }
    >
      {pending.text && <p className="text-ink-2">{pending.text}</p>}
    </Dialog>
  ) : null;

  return { confirm, dialog };
}
