"use client";

// A show/hide section driven by a plain button, so it opens and closes the same way in every browser.
import { useState } from "react";
import { cx } from "./ui";

export function Disclosure({
  summary,
  children,
  className,
  buttonClassName,
  defaultOpen = false,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cx("flex w-full cursor-pointer items-center gap-2 text-left", buttonClassName)}>
        <span className="min-w-0 flex-1">{summary}</span>
        <span aria-hidden className={cx("shrink-0 text-slate-400 transition-transform", open && "rotate-90")}>
          ›
        </span>
      </button>
      {open && children}
    </div>
  );
}
