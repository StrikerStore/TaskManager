"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/format";

const GAP = 4;
const EDGE = 8;

type Position = {
  top: number;
  left: number;
  width?: number;
  maxHeight: number;
};

/**
 * Anchored panel used by the select, time and date fields.
 *
 * It renders into document.body rather than next to its trigger: the toolbars
 * above the task list use backdrop-blur, which creates a stacking context, so a
 * panel nested inside one would be painted underneath the bar below it. A
 * portal also escapes `overflow: hidden` ancestors.
 *
 * Positioning is fixed to the viewport, flipped above the trigger when there is
 * no room below, and clamped so a wide panel on a narrow screen never runs off
 * the edge.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  className,
  matchAnchorWidth = true,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  matchAnchorWidth?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const rect = anchor.getBoundingClientRect();
    const panel = panelRef.current;
    const panelHeight = panel?.offsetHeight ?? 240;
    const panelWidth = matchAnchorWidth ? rect.width : (panel?.offsetWidth ?? rect.width);

    const spaceBelow = window.innerHeight - rect.bottom - EDGE;
    const spaceAbove = rect.top - EDGE;
    const above = spaceBelow < Math.min(panelHeight, 200) && spaceAbove > spaceBelow;

    setPosition({
      top: above ? Math.max(EDGE, rect.top - panelHeight - GAP) : rect.bottom + GAP,
      left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - panelWidth - EDGE)),
      width: matchAnchorWidth ? rect.width : undefined,
      maxHeight: Math.max(160, (above ? spaceAbove : spaceBelow) - GAP),
    });
  }, [anchorRef, matchAnchorWidth]);

  // Measure once the panel exists, then again whenever the page moves under it.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    const reposition = () => place();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, place, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        width: position?.width,
        maxWidth: `calc(100vw - ${EDGE * 2}px)`,
        maxHeight: position?.maxHeight,
        // Hidden for the first paint, while we measure it.
        visibility: position ? "visible" : "hidden",
      }}
      className={cn(
        "pop-in z-[70] overflow-hidden rounded-[10px] border border-rule-strong",
        "bg-raised shadow-[var(--shadow-sheet)]",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
