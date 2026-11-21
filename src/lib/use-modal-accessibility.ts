"use client";
import { useEffect, useRef } from "react";

export function useModalAccessibility(
  open: boolean | string,
  close: () => void,
) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
    const dialog = dialogs[dialogs.length - 1];
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const siblings = [...(dialog.parentElement?.children ?? [])].filter(
      (el): el is HTMLElement => el instanceof HTMLElement && el !== dialog,
    );
    const inert = siblings.map((el) => el.inert);
    siblings.forEach((el) => {
      el.inert = true;
    });
    const focusable = () =>
      [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length > 0);
    dialog.tabIndex = -1;
    (focusable()[0] ?? dialog).focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items[items.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === dialog)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      siblings.forEach((el, i) => {
        el.inert = inert[i];
      });
      if (previous?.isConnected) previous.focus();
      else
        document
          .querySelector<HTMLElement>(
            "main button, main a[href], header a[href]",
          )
          ?.focus();
    };
  }, [open]);
}
