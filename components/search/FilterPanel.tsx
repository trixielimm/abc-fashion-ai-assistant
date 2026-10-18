"use client";

import { useId, useState, type ReactNode } from "react";
import { FACETS, FEATURES, RANGES, type FacetKey, type FeatureKey, type FilterState, type RangeKey, type RangeValue } from "@/lib/search/filterState";
import type { FilterOption, SearchSnapshot } from "@/lib/search/facetedSearch";
import styles from "./Search.module.css";

const swatches: Record<string, string> = { beige: "#d5c6ad", black: "#151515", blue: "#8bafcb", brown: "#8c6750", burgundy: "#793d47", cream: "#f1e8d8", gold: "#b49b62", grey: "#929292", lavender: "#b9aaca", navy: "#29374d", olive: "#7c8062", pink: "#dcb3b7", red: "#b34e48", sage: "#a3b19c", silver: "#c2c2c0", white: "#fff", yellow: "#e2cf85" };

export function FilterGroup({ label, summary, open, onToggle, children }: { label: string; summary?: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  const id = useId();
  return <section className={styles.group}>
    <button type="button" className={styles.groupHeading} aria-expanded={open} aria-controls={id} onClick={onToggle}>
      <span>{label}{!open && summary ? <span className={styles.summary}>{summary}</span> : null}</span>
      <span aria-hidden="true" className={styles.plus}>{open ? "−" : "+"}</span>
    </button>
    <div id={id} hidden={!open} className={styles.groupBody}>{children}</div>
  </section>;
}

function Options({ label, options, selected, onChange, kind = "list" }: { label: string; options: FilterOption[]; selected: string[]; onChange: (value: string) => void; kind?: "list" | "size" | "colour" }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const shown = (expanded ? options : options.filter((option, index) => index < 6 || selected.includes(option.value)))
    .filter(option => !expanded || option.label.toLowerCase().includes(query.toLowerCase()));
  return <>
    {expanded && options.length > 10 ? <input type="search" className={styles.findInput} aria-label={`Find ${label.toLowerCase()}`} placeholder={`Find ${label.toLowerCase()}`} value={query} onChange={event => setQuery(event.target.value)} /> : null}
    <div className={kind === "size" ? styles.sizes : undefined}>
      {shown.map(option => {
        const checked = selected.includes(option.value);
        return <label key={option.value} className={`${kind === "size" ? styles.sizeOption : styles.option} ${checked ? styles.selected : ""} ${!option.count && !checked ? styles.unavailable : ""}`}>
          <input type="checkbox" checked={checked} disabled={option.count === 0 && !checked} onChange={() => onChange(option.value)} aria-label={`${option.label}, ${option.count} products`} />
          {kind !== "size" ? <span className={styles.check} aria-hidden="true">{checked ? "✓" : ""}</span> : null}
          {kind === "colour" && swatches[option.value] ? <span aria-hidden="true" className={styles.swatch} style={{ backgroundColor: swatches[option.value] }} /> : null}
          <span className={styles.optionLabel}>{option.label}</span><span className={styles.count}>{option.count}</span>
        </label>;
      })}
    </div>
    {expanded && shown.length === 0 ? <p className={styles.helper}>No matching options.</p> : null}
    {options.length > 6 ? <button type="button" className={styles.textButton} onClick={() => { setExpanded(!expanded); setQuery(""); }}>{expanded ? "Show less" : `Show all ${options.length}`}</button> : null}
  </>;
}

function RangeInput({ definition, bounds, value, onChange }: { definition: typeof RANGES[number]; bounds?: { min: number; max: number }; value?: RangeValue; onChange: (value: RangeValue) => void }) {
  const [draft, setDraft] = useState({ min: value?.min?.toString() ?? "", max: value?.max?.toString() ?? "" });
  const signature = `${value?.min ?? ""}:${value?.max ?? ""}`;
  const [previous, setPrevious] = useState(signature);
  const [invalid, setInvalid] = useState(false);
  if (signature !== previous) {
    setPrevious(signature);
    setDraft({ min: value?.min?.toString() ?? "", max: value?.max?.toString() ?? "" });
    setInvalid(false);
  }
  function edit(end: "min" | "max", text: string) {
    const next = { ...draft, [end]: text }; setDraft(next);
    const validNumber = (input: string) => !input || (/^\d+(?:\.\d{1,3})?$/.test(input) && Number(input) <= 1_000_000);
    const valid = validNumber(next.min) && validNumber(next.max) && (!next.min || !next.max || Number(next.min) <= Number(next.max));
    setInvalid(!valid);
    if (valid) onChange({ ...(next.min ? { min: Number(next.min) } : {}), ...(next.max ? { max: Number(next.max) } : {}) });
  }
  const errorId = useId();
  return <div data-filter-draft={invalid || undefined}>
    <div className={styles.rangeInputs}>{(["min", "max"] as const).map(end => <label key={end}>
      <span>{end === "min" ? "Min" : "Max"}{definition.unit ? ` ${definition.unit}` : ""}</span>
      <input type="text" inputMode="decimal" value={draft[end]} aria-label={`${definition.label} ${end === "min" ? "minimum" : "maximum"}${definition.unit ? ` (${definition.unit})` : ""}`} aria-invalid={invalid} aria-describedby={invalid ? errorId : undefined} placeholder={bounds ? String(bounds[end]) : "Any"} onChange={event => edit(end, event.target.value)} />
    </label>)}</div>
    {invalid ? <p id={errorId} className={styles.validation}>Enter a valid range. Minimum cannot exceed maximum.</p> : null}
    {bounds ? <p className={styles.helper}>{definition.unit === "A$" ? "A$" : ""}{bounds.min}–{bounds.max}{definition.unit && definition.unit !== "A$" ? ` ${definition.unit}` : ""} in the collection</p> : null}
    {definition.key === "garment_length_cm" ? <p className={styles.helper}>Sample measurement. Varies by size.</p> : null}
  </div>;
}

export function FilterPanel({ snapshot, state, open, toggleGroup, toggleValue, toggleFeature, changeRange }: {
  snapshot: SearchSnapshot; state: FilterState; open: Record<string, boolean>; toggleGroup: (key: string) => void;
  toggleValue: (key: FacetKey, value: string) => void; toggleFeature: (key: FeatureKey) => void; changeRange: (key: RangeKey, value: RangeValue) => void;
}) {
  const categories = state.values.category ?? [];
  const relevant = (values: string[]) => !categories.length || values.some(category => categories.includes(category.toLowerCase()));
  const facetOptions = (key: FacetKey) => snapshot.facets[key].filter(option => !["subcategory", "size", "sole_material", "hardware_finish"].includes(key) || (state.values[key] ?? []).includes(option.value) || relevant(option.categories));
  function facet(key: FacetKey) {
    const definition = FACETS.find(item => item.key === key)!;
    const options = facetOptions(key);
    if (!options.length) return null;
    const selected = state.values[key] ?? [];
    const summary = selected.map(value => options.find(option => option.value === value)?.label ?? value).join(", ");
    return <FilterGroup key={key} label={definition.label} summary={summary} open={!!open[key]} onToggle={() => toggleGroup(key)}>
      {key === "size" ? [...new Set(options.flatMap(option => option.categories))].map(category => <div key={category} className={styles.sizeSection}>
        <p className={styles.helper}>{category === "Shoes" ? "Shoe sizes" : category === "Clothing" ? "Clothing sizes" : `${category} sizes`}</p>
        <Options label={`${category} sizes`} options={options.filter(option => option.categories.includes(category))} selected={selected} onChange={value => toggleValue(key, value)} kind="size" />
      </div>) : <Options label={definition.label} options={options} selected={selected} onChange={value => toggleValue(key, value)} kind={key === "colour" ? "colour" : "list"} />}
    </FilterGroup>;
  }
  function range(key: RangeKey) {
    const definition = RANGES.find(item => item.key === key)!;
    const value = state.ranges[key], bounds = snapshot.bounds[key];
    if ((!bounds || !relevant(bounds.categories)) && !value) return null;
    const amount = (number: number) => key === "price" ? `A$${number}` : `${number}${definition.unit ? ` ${definition.unit}` : ""}`;
    const summary = !value ? undefined : value.min !== undefined && value.max !== undefined ? `${amount(value.min)}–${amount(value.max)}` : value.max !== undefined ? `Up to ${amount(value.max)}` : `From ${amount(value.min!)}`;
    return <FilterGroup key={key} label={definition.label} summary={summary} open={!!open[key]} onToggle={() => toggleGroup(key)}>
      <RangeInput definition={definition} bounds={bounds} value={value} onChange={next => changeRange(key, next)} />
    </FilterGroup>;
  }
  return <div className={styles.panel}>
    {facet("gender")}{facet("category")}
    {(categories.length || state.values.subcategory?.length) ? <div className={styles.subcategories}>{facet("subcategory")}</div> : null}
    {facet("size")}{facet("colour")}{range("price")}
    <FilterGroup label="Features" summary={state.features.map(key => FEATURES.find(feature => feature.key === key)?.label).join(", ")} open={!!open.features} onToggle={() => toggleGroup("features")}>
      {!snapshot.featureDataAvailable ? <p className={styles.helper}>Temporarily unavailable</p> : <>
        <p className={styles.helper}>Selected features must all match.</p>
        {snapshot.features.filter(feature => state.features.includes(feature.key) || relevant(feature.categories)).map(feature => <label key={feature.key} className={`${styles.option} ${state.features.includes(feature.key) ? styles.selected : ""} ${!feature.count && !state.features.includes(feature.key) ? styles.unavailable : ""}`}>
          <input type="checkbox" checked={state.features.includes(feature.key)} disabled={!feature.count && !state.features.includes(feature.key)} onChange={() => toggleFeature(feature.key)} />
          <span className={styles.check} aria-hidden="true">{state.features.includes(feature.key) ? "✓" : ""}</span>
          <span className={styles.optionLabel}>{feature.label}</span><span className={styles.count}>{feature.count}</span>
        </label>)}
      </>}
    </FilterGroup>
    <FilterGroup label="More details" summary={undefined} open={!!open.details} onToggle={() => toggleGroup("details")}>
      {["style", "occasion", "material", "fit", "season", "brand_line", "product_type", "tags"].map(key => facet(key as FacetKey))}
      {snapshot.featureDataAvailable ? <>
        <FilterGroup label="Fastening" summary={state.features.includes("zip_closure") ? "Zip" : state.values.closure?.join(", ")} open={!!open.closure} onToggle={() => toggleGroup("closure")}>
          <Options label="fastening" options={facetOptions("closure")} selected={state.features.includes("zip_closure") ? ["zip"] : state.values.closure ?? []} onChange={value => toggleValue("closure", value)} />
        </FilterGroup>
        {["use_cases", "sole_material", "hardware_finish"].map(key => facet(key as FacetKey))}
        {RANGES.filter(item => item.key !== "price").map(item => range(item.key))}
      </> : <p className={styles.helper}>Product specifications are temporarily unavailable.</p>}
    </FilterGroup>
  </div>;
}
