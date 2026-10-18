"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProductImage } from "@/components/commerce/ProductImage";
import { SearchIcon } from "@/components/ui/icons";
import { emptyFilters, FACETS, FEATURES, RANGES, filterCount, searchHref, type FacetKey, type FeatureKey, type FilterState, type RangeKey, type RangeValue } from "@/lib/search/filterState";
import type { SearchSnapshot } from "@/lib/search/facetedSearch";
import { FilterPanel } from "./FilterPanel";
import { useSearchController } from "./useSearchController";
import styles from "./Search.module.css";

function QueryInput({ value, onChange, onSubmit }: { value: string; onChange: (q: string) => void; onSubmit: (q: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [previous, setPrevious] = useState(value);
  if (value !== previous) { setPrevious(value); setDraft(value); }
  return <form role="search" className={styles.searchForm} onSubmit={event => { event.preventDefault(); onSubmit(draft); }}>
    <label htmlFor="catalogue-search" className="sr-only">Search products</label>
    <input id="catalogue-search" type="search" value={draft} maxLength={120} placeholder="Search products, colours or styles" onChange={event => { setDraft(event.target.value); onChange(event.target.value); }} />
    <button type="submit" aria-label="Search products"><SearchIcon className="h-5 w-5" /></button>
  </form>;
}

export function SearchExplorer({ initialState, initial }: { initialState: FilterState; initial: SearchSnapshot | null }) {
  const { state, stateRef, snapshot, pending, error, navigate, schedule, canUndo, undo, retry } = useSearchController(initialState, initial);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ gender: true, category: true });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [allChips, setAllChips] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const filterButton = useRef<HTMLButtonElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const queryDraft = useRef(state.q);
  const selections = filterCount(state);
  const totalLabel = snapshot ? `${snapshot.total} ${snapshot.total === 1 ? "product" : "products"}` : "";
  const toggleGroup = (key: string) => setOpenGroups(current => ({ ...current, [key]: !current[key] }));
  function update(next: FilterState) { navigate({ ...next, q: queryDraft.current, page: 1 }); }
  function toggleValue(key: FacetKey, value: string) {
    const current = stateRef.current;
    if (key === "closure" && value === "zip" && !current.values.closure?.length) { toggleFeature("zip_closure"); return; }
    const selected = current.values[key] ?? [];
    const next = selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value];
    const values = { ...current.values };
    if (next.length) values[key] = next; else delete values[key];
    update({ ...current, values, features: key === "closure" ? current.features.filter(feature => feature !== "zip_closure") : current.features });
  }
  function toggleFeature(key: FeatureKey) {
    const current = stateRef.current;
    const values = { ...current.values };
    if (key === "zip_closure") delete values.closure;
    update({ ...current, values, features: current.features.includes(key) ? current.features.filter(feature => feature !== key) : [...current.features, key] });
  }
  function changeRange(key: RangeKey, value: RangeValue) {
    const current = stateRef.current;
    const ranges = { ...current.ranges };
    if (value.min === undefined && value.max === undefined) delete ranges[key]; else ranges[key] = value;
    schedule({ ...current, q: queryDraft.current, ranges, page: 1 });
  }
  function clear() { update(emptyFilters(stateRef.current.q)); }
  useEffect(() => { queryDraft.current = state.q; }, [state.q]);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (drawerOpen && !element.open) element.showModal();
    if (!drawerOpen && element.open) element.close();
    if (!drawerOpen) return;
    const previousBody = document.body.style.overflow, previousHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden"; document.documentElement.style.overflow = "hidden";
    const viewport = window.visualViewport;
    const resize = () => {
      element.style.setProperty("--filter-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      element.style.setProperty("--filter-viewport-top", `${viewport?.offsetTop ?? 0}px`);
    };
    resize();
    viewport?.addEventListener("resize", resize); viewport?.addEventListener("scroll", resize);
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (media.matches) element.close(); };
    media.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.style.overflow = previousBody; document.documentElement.style.overflow = previousHtml;
      media.removeEventListener("change", closeOnDesktop);
      viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize);
    };
  }, [drawerOpen]);

  const chips = [
    ...FACETS.flatMap(({ key, label }) => (state.values[key] ?? []).map(value => ({ id: `${key}:${value}`, label: snapshot?.facets[key].find(option => option.value === value)?.label ?? value, name: `${label}: ${value}`, remove: () => toggleValue(key, value) }))),
    ...state.features.map(key => ({ id: key, label: FEATURES.find(feature => feature.key === key)!.label, name: FEATURES.find(feature => feature.key === key)!.label, remove: () => toggleFeature(key) })),
    ...RANGES.flatMap(({ key, label, unit }) => {
      const range = state.ranges[key];
      if (!range) return [];
      const text = range.min !== undefined && range.max !== undefined ? `${range.min}–${range.max}` : range.max !== undefined ? `Up to ${range.max}` : `From ${range.min}`;
      const display = key === "price" ? text.replace(/\d+(?:\.\d+)?/g, number => `A$${number}`) : `${label}: ${text}${unit ? ` ${unit}` : ""}`;
      return [{ id: key, label: display, name: label, remove: () => { const ranges = { ...stateRef.current.ranges }; delete ranges[key]; update({ ...stateRef.current, ranges }); } }];
    }),
  ];
  const panel = snapshot ? <FilterPanel snapshot={snapshot} state={state} open={openGroups} toggleGroup={toggleGroup} toggleValue={toggleValue} toggleFeature={toggleFeature} changeRange={changeRange} /> : null;
  return <>
    <div className={styles.intro}>
      <p className={styles.overline}>ABC Fashion / Discover</p><h1>Search the collection</h1>
      <p className={styles.description}>Explore clothing, shoes, bags and accessories from our current catalogue.</p>
      <QueryInput value={state.q} onChange={q => { queryDraft.current = q; schedule({ ...stateRef.current, q, page: 1 }); }} onSubmit={q => { queryDraft.current = q.trim(); navigate({ ...stateRef.current, q: q.trim(), page: 1 }); }} />
    </div>
    {!snapshot ? <div className={styles.unavailableState}>
      <h2 className="font-serif text-3xl">The collection is unavailable</h2><p>{error}</p><button type="button" className={styles.textButton} onClick={retry}>{pending ? "Trying again…" : "Try again"}</button>
      {selections ? <button type="button" className={`${styles.textButton} ml-6`} onClick={clear}>Clear filters</button> : null}
    </div> : <div className={styles.catalogue}>
      <aside className={styles.rail} aria-label="Product filters"><h2 className={styles.refine}>Refine</h2>{panel}</aside>
      <div className={styles.results} ref={results} aria-busy={pending}>
        <div className={styles.toolbar}>
          <div><p className={styles.overline}>{state.q ? "Search results" : "All products"}</p><h2 className={styles.resultTitle}>{state.q ? `“${state.q}”` : "The collection"}</h2></div>
          <div className={styles.total}><span>{totalLabel}</span>{pending ? <span className={styles.updating}>Updating results…</span> : null}</div>
        </div>
        <div className={styles.mobileToolbar}>
          <button type="button" className={styles.filterButton} ref={filterButton} onClick={() => setDrawerOpen(true)} aria-haspopup="dialog" aria-expanded={drawerOpen}>
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 5h14M3 15h14M7 2v6m6 4v6" stroke="currentColor" strokeWidth="1.2" /></svg>
            Filters{selections ? ` · ${selections}` : ""}
          </button><span>{pending ? "Updating results…" : totalLabel}</span>
        </div>
        {chips.length ? <div className={styles.chips} aria-label="Selected filters">
          {chips.map((chip, index) => <button type="button" key={chip.id} className={`${styles.chip} ${index > 3 && !allChips ? styles.extraChip : ""}`} onClick={chip.remove} aria-label={`Remove ${chip.name}`}><span>{chip.label}</span><span aria-hidden="true">×</span></button>)}
          {chips.length > 4 ? <button type="button" className={styles.showChips} onClick={() => setAllChips(!allChips)}>{allChips ? "Show fewer" : `Show all ${chips.length} filters`}</button> : null}
          <button type="button" className={styles.textButton} onClick={clear}>Clear filters</button>
        </div> : null}
        {error ? <p className={styles.error} role="status">{error} Showing the last available results. <button type="button" className={styles.textButton} onClick={retry}>Try again</button></p> : null}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{pending ? "Updating results" : `${totalLabel}${error ? ". Results may be out of date." : ""}`}</p>
        {snapshot.products.length ? <div className={styles.productGrid}>
          {snapshot.products.map(product => <Link key={product.product_id} href={`/products/${encodeURIComponent(product.product_id)}`} className={styles.productCard}>
            <ProductImage src={product.image_src} name={product.product_name} category={product.subcategory ?? product.category} sizes="(min-width: 1440px) 17vw, (min-width: 1200px) 23vw, (min-width: 1024px) 30vw, (min-width: 768px) 30vw, 45vw" />
            <div className={styles.productDetails}><div><p className={styles.overline}>{product.brand_line ?? product.subcategory ?? product.category}</p><h3>{product.product_name}</h3>{product.colour ? <p className={styles.productColour}>{product.colour}</p> : null}</div><p className={styles.price}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(product.price_aud)}</p></div>
          </Link>)}
        </div> : <div className={styles.emptyState}>
          <h2>{selections ? "No pieces match these filters" : "No products found"}</h2><p>{selections ? "Try removing a filter or widening your price range." : "Try a broader term, another colour or a product category."}</p>
          <div>{canUndo ? <button type="button" className={styles.textButton} onClick={undo}>Undo last filter</button> : null}{selections ? <button type="button" className={styles.textButton} onClick={clear}>Clear filters</button> : <Link className={styles.textButton} href="/search">Browse all products</Link>}</div>
        </div>}
        {snapshot.pageCount > 1 ? <nav className={styles.pagination} aria-label="Search result pages">
          {(["Previous", "Next"] as const).map((label, index) => {
            const page = snapshot.state.page + (index ? 1 : -1), available = page >= 1 && page <= snapshot.pageCount;
            return <span key={label}>{available ? <Link href={searchHref({ ...state, page })} onClick={event => { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); navigate({ ...stateRef.current, page }); results.current?.scrollIntoView({ block: "start", behavior: "instant" }); }}>{label}</Link> : <span className={styles.helper}>{label}</span>}</span>;
          })}<span>Page {snapshot.state.page} of {snapshot.pageCount}</span>
        </nav> : null}
      </div>
    </div>}
    <dialog ref={dialog} className={styles.drawer} aria-labelledby="search-refine-title" onClose={() => { setDrawerOpen(false); filterButton.current?.focus({ preventScroll: true }); }} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className={styles.drawerContent}>
        <header className={styles.drawerHeader}><div><h2 id="search-refine-title">Refine</h2>{selections ? <p>{selections} {selections === 1 ? "filter" : "filters"} selected</p> : null}</div><button type="button" aria-label="Close filters" onClick={() => dialog.current?.close()}>×</button></header>
        <div className={styles.drawerBody}>{panel}</div>
        <footer className={styles.drawerFooter}><button type="button" className={styles.textButton} disabled={!selections} onClick={clear}>Clear filters</button><button type="button" className={styles.viewResults} onClick={() => dialog.current?.close()}>{pending || error ? "View results" : `View ${totalLabel}`}</button>{pending || error ? <p role="status">{pending ? "Updating results…" : "Couldn’t update results."}{error ? <button type="button" className={styles.textButton} onClick={retry}>Try again</button> : null}</p> : null}</footer>
      </div>
    </dialog>
  </>;
}
