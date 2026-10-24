"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TRACK_INSET = 4;
const MIN_THUMB_HEIGHT = 36;
const HIDE_DELAY_MS = 1200;

type Metrics = {
  top: number;
  height: number;
  maxScroll: number;
  maxThumbTravel: number;
  scrollY: number;
};

const initialMetrics: Metrics = {
  top: TRACK_INSET,
  height: 0,
  maxScroll: 0,
  maxThumbTravel: 0,
  scrollY: 0,
};

export function OverlayScrollbar() {
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [visible, setVisible] = useState(false);
  const metricsRef = useRef(metrics);
  const thumbRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const drag = useRef<{ pointerId: number; startY: number; startScroll: number } | null>(null);
  const previousScrollBehavior = useRef("");

  const reveal = useCallback(() => {
    if (metricsRef.current.maxScroll <= 0) return;

    window.clearTimeout(hideTimer.current);
    setVisible(true);
    hideTimer.current = window.setTimeout(() => {
      if (
        !drag.current &&
        document.activeElement !== thumbRef.current &&
        !thumbRef.current?.matches(":hover")
      ) {
        setVisible(false);
      }
    }, HIDE_DELAY_MS);
  }, []);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      const scrollElement = document.scrollingElement ?? document.documentElement;
      const viewportHeight = window.innerHeight;
      const maxScroll = Math.max(0, scrollElement.scrollHeight - viewportHeight);
      const trackHeight = Math.max(0, viewportHeight - TRACK_INSET * 2);
      const height = maxScroll > 0
        ? Math.min(trackHeight, Math.max(MIN_THUMB_HEIGHT, trackHeight * viewportHeight / scrollElement.scrollHeight))
        : 0;
      const maxThumbTravel = trackHeight - height;
      const scrollY = Math.max(0, Math.min(window.scrollY, maxScroll));
      const top = TRACK_INSET + (maxScroll > 0 ? scrollY / maxScroll * maxThumbTravel : 0);
      const next = { top, height, maxScroll, maxThumbTravel, scrollY };

      metricsRef.current = next;
      setMetrics(next);
      if (maxScroll === 0) setVisible(false);
    };

    const scheduleMeasure = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    const onScroll = () => {
      scheduleMeasure();
      reveal();
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", scheduleMeasure);
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(document.body);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", scheduleMeasure);
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(hideTimer.current);
      document.documentElement.style.scrollBehavior = previousScrollBehavior.current;
    };
  }, [reveal]);

  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    document.documentElement.style.scrollBehavior = previousScrollBehavior.current;
    reveal();
  };

  return (
    <div
      ref={thumbRef}
      role="scrollbar"
      aria-label="Page scroll"
      aria-controls="page-scroll"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={Math.round(metrics.maxScroll)}
      aria-valuenow={Math.round(metrics.scrollY)}
      tabIndex={visible && metrics.maxScroll > 0 ? 0 : -1}
      className="page-scrollbar-thumb"
      data-visible={visible && metrics.maxScroll > 0}
      style={{ top: metrics.top, height: metrics.height }}
      onPointerEnter={() => window.clearTimeout(hideTimer.current)}
      onPointerLeave={() => {
        if (!drag.current) reveal();
      }}
      onPointerDown={(event) => {
        if (metricsRef.current.maxScroll <= 0) return;
        event.preventDefault();
        drag.current = {
          pointerId: event.pointerId,
          startY: event.clientY,
          startScroll: window.scrollY,
        };
        previousScrollBehavior.current = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        event.currentTarget.setPointerCapture(event.pointerId);
        reveal();
      }}
      onPointerMove={(event) => {
        const activeDrag = drag.current;
        if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
        const { maxScroll, maxThumbTravel } = metricsRef.current;
        if (maxThumbTravel <= 0) return;
        const distance = event.clientY - activeDrag.startY;
        window.scrollTo(0, activeDrag.startScroll + distance * maxScroll / maxThumbTravel);
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onFocus={() => {
        window.clearTimeout(hideTimer.current);
        setVisible(true);
      }}
      onBlur={reveal}
      onKeyDown={(event) => {
        let nextScroll: number;
        switch (event.key) {
          case "ArrowUp": nextScroll = window.scrollY - 40; break;
          case "ArrowDown": nextScroll = window.scrollY + 40; break;
          case "PageUp": nextScroll = window.scrollY - window.innerHeight * 0.85; break;
          case "PageDown": nextScroll = window.scrollY + window.innerHeight * 0.85; break;
          case "Home": nextScroll = 0; break;
          case "End": nextScroll = metricsRef.current.maxScroll; break;
          default: return;
        }
        event.preventDefault();
        window.scrollTo(0, nextScroll);
        reveal();
      }}
    />
  );
}
