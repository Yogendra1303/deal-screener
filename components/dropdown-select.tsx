"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
}

/** Floating popover dropdown control used across the app. */
export function DropdownSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = "Select…",
  prefix,
  id,
  ariaLabel,
  className,
  buttonClassName,
  align = "left",
  size = "md",
  theme = "light",
  tone = "default",
  required,
}: {
  value: T;
  onChange: (v: T) => void;
  options: (T | DropdownOption<T>)[];
  placeholder?: string;
  prefix?: React.ReactNode;
  id?: string;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
  align?: "left" | "right";
  size?: "xs" | "sm" | "md";
  theme?: "light" | "dark";
  tone?: "default" | "warn";
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const normalized: DropdownOption<T>[] = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const selected = normalized.find((o) => o.value === value);

  const computeCoords = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return null;
    const minW = Math.max(r.width, 188);
    const rawLeft = align === "right" ? r.right - minW : r.left;
    const left = Math.max(8, Math.min(window.innerWidth - minW - 8, rawLeft));
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const estH = Math.min(264, normalized.length * 34 + 12);
    if (spaceBelow < Math.min(estH, 180) && spaceAbove > spaceBelow) {
      const maxH = Math.min(264, Math.max(120, spaceAbove));
      const top = Math.max(8, r.top - Math.min(estH, maxH) - 4);
      return { top, left, width: minW, maxH };
    }
    const maxH = Math.min(264, Math.max(120, spaceBelow));
    return { top: r.bottom + 4, left, width: minW, maxH };
  };

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const next = computeCoords();
      if (next) setCoords(next);
    };
    updatePosition();
    const onDocPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocPointer);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, align, normalized.length]);

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!open) {
      const next = computeCoords();
      if (next) setCoords(next);
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const dark = theme === "dark";
  const menu =
    open && coords ? (
      <ul
        ref={menuRef}
        role="listbox"
        aria-label={ariaLabel}
        style={{ top: coords.top, left: coords.left, minWidth: coords.width, maxHeight: coords.maxH }}
        className={cx(
          "fixed z-[9999] overflow-y-auto rounded-lg border py-1 shadow-xl",
          dark
            ? "border-white/15 bg-zinc-900 shadow-black/50"
            : "border-slate-200 bg-white shadow-slate-900/15",
        )}
      >
        {normalized.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <li
              key={opt.value}
              role="option"
              aria-selected={isSelected}
              onClick={(e) => {
                e.stopPropagation();
                onChange(opt.value);
                setOpen(false);
              }}
              className={cx(
                "flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium leading-tight transition-colors",
                dark
                  ? isSelected
                    ? "bg-blue-500/20 text-blue-300"
                    : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                  : isSelected
                    ? "bg-blue-50 text-blue-700"
                    : "bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              <span className="truncate">{opt.label}</span>
              {isSelected && (
                <svg viewBox="0 0 24 24" className={cx("h-3.5 w-3.5 shrink-0", dark ? "text-blue-400" : "text-blue-600")} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </li>
          );
        })}
      </ul>
    ) : null;

  return (
    <div ref={ref} className={cx("relative inline-block text-left", className)} onClick={(e) => e.stopPropagation()}>
      {required && <input type="text" tabIndex={-1} aria-hidden value={value} onChange={() => {}} required className="sr-only" />}
      <button
        id={id}
        type="button"
        aria-label={ariaLabel ? `${ariaLabel}: ${selected?.label ?? placeholder}` : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggleOpen}
        className={cx(
          "inline-flex w-full cursor-pointer items-center justify-between gap-1.5 rounded-md border font-medium leading-tight shadow-2xs transition-colors",
          dark
            ? open
              ? "border-blue-500 bg-zinc-900/90 text-zinc-100 ring-2 ring-blue-500/20"
              : "border-white/10 bg-zinc-900/80 text-zinc-200 hover:border-white/20 hover:bg-zinc-900"
            : tone === "warn"
              ? open
                ? "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-400/25"
                : "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100/70"
              : open
                ? "border-blue-500 bg-white text-slate-700 ring-2 ring-blue-500/15"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
          size === "xs"
            ? "h-7 px-2 text-[11px]"
            : size === "sm"
              ? "h-8 px-2.5 text-xs"
              : "px-3 py-1.5 text-sm",
          buttonClassName,
        )}
      >
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          {prefix && <span className={cx("shrink-0", dark ? "text-zinc-400" : tone === "warn" ? "text-amber-700" : "text-slate-400")}>{prefix}</span>}
          <span
            className={cx(
              "truncate",
              tone === "warn" && !dark
                ? "font-semibold text-amber-900"
                : selected
                  ? dark
                    ? "text-white"
                    : "text-slate-900"
                  : dark
                    ? "text-zinc-400"
                    : "text-slate-500",
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <svg viewBox="0 0 24 24" className={cx("h-3.5 w-3.5 shrink-0 transition-transform", dark ? "text-zinc-400" : tone === "warn" ? "text-amber-600" : "text-slate-400", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : menu}
    </div>
  );
}
