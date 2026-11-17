"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseFilters, searchHref, serializeFilters, type FilterState } from "@/lib/search/filterState";
import type { SearchSnapshot } from "@/lib/search/facetedSearch";

export function useSearchController(initialState: FilterState, initial: SearchSnapshot | null) {
  const [state, setState] = useState(initial?.state ?? initialState);
  const [snapshot, setSnapshot] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initial ? "" : "The collection is unavailable. Please try again.");
  const stateRef = useRef(state);
  const previous = useRef<FilterState | null>(null);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftOrigin = useRef<FilterState | null>(null);
  const [canUndo, setCanUndo] = useState(false);

  const load = useCallback(async (filters: FilterState) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = ++sequence.current;
    setPending(true);
    try {
      const response = await fetch(`/api/search?${serializeFilters(filters)}`, {
        cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]),
      });
      if (!response.ok) throw new Error("Search unavailable");
      const result: SearchSnapshot = await response.json();
      if (current !== sequence.current) return;
      setSnapshot(result);
      setError("");
      if (result.state.page !== filters.page) {
        stateRef.current = result.state;
        setState(result.state);
        window.history.replaceState(null, "", searchHref(result.state));
      }
    } catch {
      if (current === sequence.current && !controller.signal.aborted) setError("Couldn’t update results. Try again.");
    } finally {
      if (current === sequence.current) { setPending(false); request.current = null; }
    }
  }, []);

  const navigate = useCallback((next: FilterState, mode: "push" | "replace" = "push", remember = true) => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (remember) { previous.current = draftOrigin.current ?? stateRef.current; setCanUndo(true); }
    draftOrigin.current = null;
    stateRef.current = next;
    setState(next);
    window.history[mode === "push" ? "pushState" : "replaceState"](null, "", searchHref(next));
    void load(next);
  }, [load]);

  const schedule = useCallback((next: FilterState) => {
    if (!timer.current) draftOrigin.current = stateRef.current;
    if (timer.current) clearTimeout(timer.current);
    // Invalidate the previous response as soon as the customer starts typing.
    request.current?.abort(); request.current = null; sequence.current++; setPending(true);
    stateRef.current = next; setState(next);
    timer.current = setTimeout(() => navigate(next, "replace"), 250);
  }, [navigate]);

  useEffect(() => {
    function restore() {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      try {
        const next = parseFilters(new URLSearchParams(window.location.search));
        stateRef.current = next; setState(next); previous.current = null; draftOrigin.current = null; setCanUndo(false);
        void load(next);
      } catch { setError("This search link has invalid filters. Clear filters to start again."); }
    }
    function refresh() {
      if (document.visibilityState === "visible" && !timer.current && !request.current && !document.querySelector('[data-filter-draft="true"]')) void load(stateRef.current);
    }
    window.addEventListener("popstate", restore);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = setInterval(refresh, 30_000);
    return () => {
      request.current?.abort();
      if (timer.current) clearTimeout(timer.current);
      clearInterval(interval);
      window.removeEventListener("popstate", restore); window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load]);

  function undo() {
    if (!previous.current) return;
    navigate(previous.current, "push", false); previous.current = null; setCanUndo(false);
  }
  return { state, stateRef, snapshot, pending, error, navigate, schedule, canUndo, undo, retry: () => void load(stateRef.current) };
}
