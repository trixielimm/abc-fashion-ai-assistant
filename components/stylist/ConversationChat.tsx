"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CloseIcon, ChevronIcon, StopIcon } from "@/components/ui/icons";
import { ChatRequestError, postChatJson } from "@/lib/ai/chatRequest";
import type { ViewedPageContext } from "@/lib/stylist/viewedProduct";
import { readCart } from "@/lib/cart";
import { trackRecommendationEvents } from "@/lib/stylist/recommendationTelemetry";
import {
  acceptReply, makeTurn, newSession, snapshot,
  type ChatProduct, type TurnEnvelope, type TurnReply,
} from "@/lib/stylist/conversationProtocol";
import { ShoppingProductResults, type ShoppingAction } from "./ShoppingProductResults";
import styles from "./ShoppingConversation.module.css";
import { OutfitSummary } from "./OutfitSummary";
import { DressCodeChoices, OutfitGuidance } from "./OutfitGuidance";
import { hasEventContext } from "@/lib/stylist/dressCode";
import { suggestedOutfit } from "@/lib/stylist/outfitPresentation";
import { outfitReviewSections } from "@/lib/stylist/outfitReview";

type Entry = { id: string; role: "user" | "assistant"; text: string; result?: TurnReply; groupRecommendationIds?: string[] };

function OutfitReviewMessage({ review }: { review: NonNullable<TurnReply["outfit_review"]> }) {
  return <div className={styles.outfitReview} aria-label="Current outfit review">
    {outfitReviewSections.map(section => <p key={section.key} className={styles.message}>
      <strong>{section.title}</strong><br />{review[section.key]}
    </p>)}
  </div>;
}

function ReplyMessage({ text, collapsible }: { text: string; collapsible: boolean }) {
  const paragraphs = text.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  if (!collapsible || paragraphs.length < 2) return <p className={styles.message}>{text}</p>;
  return (
    <>
      <p className={styles.message}>{paragraphs[0]}</p>
      <details className={styles.messageDetails}>
        <summary>Details about these picks</summary>
        <div>{paragraphs.slice(1).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      </details>
    </>
  );
}

export function ConversationChat({ onClose, onReset, viewedPage = null, open = true }: {
  onClose: () => void;
  onReset: () => void;
  viewedPage?: ViewedPageContext | null;
  open?: boolean;
}) {
  const [entries, setEntries] = useState<Entry[]>([{
    id: "welcome", role: "assistant",
    text: "What are you shopping for today? Tell me an item, style or occasion and I'll help you explore the catalogue.",
  }]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [quietBusy, setQuietBusy] = useState(false);
  const [selectionFeedback, setSelectionFeedback] = useState("");
  const [retry, setRetry] = useState<{ envelope: TurnEnvelope; quietMessage?: string } | null>(null);
  const [activeReply, setActiveReply] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState(newSession);
  const session = useRef(sessionState);
  const requestRef = useRef<AbortController | null>(null);
  const usedPageKey = useRef<number | null>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const latestEntry = useRef<HTMLDivElement>(null);
  const loading = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const conversationBusy = busy && !quietBusy;

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);
  useEffect(() => { if (!open) requestRef.current?.abort(); }, [open]);
  useEffect(() => {
    const element = transcript.current;
    const anchor = conversationBusy ? loading.current : latestEntry.current;
    if (open && element && anchor) {
      // Start at the new reply, rather than jumping past its images and summary.
      const padding = Number.parseFloat(getComputedStyle(element).paddingTop) || 0;
      element.scrollTop = Math.max(0, anchor.offsetTop - padding);
    }
  }, [entries, conversationBusy, open]);

  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`;
    element.style.overflowY = element.scrollHeight > 128 ? "auto" : "hidden";
  }, [draft, open]);

  function cancelRequest() {
    const controller = requestRef.current;
    if (!controller) return;
    controller.abort();
    requestRef.current = null;
    setBusy(false);
    setRetry(null);
    if (quietBusy) {
      setQuietBusy(false);
      setSelectionFeedback("Cancelled that update. Your look is unchanged.");
      return;
    }
    setEntries(previous => [...previous, {
      id: crypto.randomUUID(), role: "assistant",
      text: "Cancelled that request. Your saved preferences and cart are unchanged.",
    }]);
  }

  async function run(envelope: TurnEnvelope, quietMessage?: string) {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setQuietBusy(Boolean(quietMessage));
    if (quietMessage) setSelectionFeedback("Updating your look…");
    setRetry(null);
    try {
      const raw = await postChatJson("/api/conversation-search", envelope, {
        signal: controller.signal, timeoutMs: 120_000,
      });
      if (requestRef.current !== controller || controller.signal.aborted) return;
      const result = acceptReply(envelope.turn, raw);
      session.current = result.session;
      setSessionState(result.session);
      const id = crypto.randomUUID();
      const groupRecommendationIds = result.reply.outfit_choices?.groups.map(() => crypto.randomUUID());
      if (result.reply.outfit_choices && groupRecommendationIds) {
        result.reply.outfit_choices.groups.forEach((group, index) => trackRecommendationEvents(groupRecommendationIds[index],
          group.product_ids.map((product_id, position) => ({ product_id, position: position + 1, event_type: "impression" }))));
      } else trackRecommendationEvents(id, [...result.reply.products, ...result.reply.alternatives].map((product, index) => ({
          product_id: product.product_id, position: index + 1, event_type: "impression",
        })));
      if (quietMessage && result.reply.intent_understood && result.reply.status === "no_action" && !result.reply.pending) {
        setSelectionFeedback(quietMessage);
      } else {
        setSelectionFeedback("");
        setEntries(previous => [...previous, {
          id, role: "assistant", text: result.reply.message, result: result.reply, groupRecommendationIds,
        }]);
      }
      if (result.reply.intent_understood && !["answered", "no_action", "no_upsell"].includes(result.reply.status)) setActiveReply(id);
    } catch (error) {
      if (requestRef.current !== controller || controller.signal.aborted) return;
      const expired = error instanceof ChatRequestError && error.status === 409;
      const invalid = error instanceof ChatRequestError && [400, 403, 413, 415].includes(error.status ?? 0);
      if (!expired && !invalid) setRetry({ envelope: { ...envelope, retry: true }, quietMessage });
      if (quietMessage) setSelectionFeedback("Couldn't update your look. Your selections are unchanged. Please try again.");
      else setEntries(previous => [...previous, {
        id: crypto.randomUUID(), role: "assistant",
        text: expired
          ? "That retry has expired. Please send your message again. Your saved preferences are unchanged."
          : "I couldn't load or verify the results just now. Please try again. Your preferences and cart are unchanged.",
      }]);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(false);
        setQuietBusy(false);
      }
    }
  }

  function send(message: string, kind?: ShoppingAction | "similar", product?: ChatProduct, previewOtherColours = false, selectedId?: string, quietMessage?: string, recovery?: TurnEnvelope["turn"]["recovery"]) {
    const text = message.trim();
    if (!text || text.length > 2000 || requestRef.current || busy) return;
    const focus = previewOtherColours ? null : product ? snapshot(product)
      : !session.current.pending && viewedPage && viewedPage.key !== usedPageKey.current
        ? snapshot(viewedPage.product) : null;
    try {
      const current = { ...session.current, cart_product_ids: [...new Set(readCart().map(item => item.productId))].slice(0, 50) };
      const turn = makeTurn(current, text, focus,
        kind && (product || selectedId) ? { kind, product_id: product?.product_id ?? selectedId! } : undefined,
        previewOtherColours, recovery);
      usedPageKey.current = viewedPage?.key ?? null;
      const envelope: TurnEnvelope = { request_id: crypto.randomUUID(), retry: false, turn };
      if (!quietMessage) {
        setSelectionFeedback("");
        setEntries(previous => [...previous, { id: envelope.request_id, role: "user", text }]);
        if (draft.trim() === text) setDraft("");
      }
      void run(envelope, quietMessage);
    } catch {
      setEntries(previous => [...previous, {
        id: crypto.randomUUID(), role: "assistant",
        text: "I couldn't prepare this request from the saved context. Please use New chat and start a new search.",
      }]);
    }
  }
  function act(kind: ShoppingAction, product: ChatProduct) {
    const text = kind === "cross_sell" ? `Find an extra for ${product.product_name}.`
      : kind === "cheaper" ? `Find cheaper alternatives to ${product.product_name}.`
      : kind === "upsell" ? `Compare value alternatives to ${product.product_name}.`
      : kind === "keep" ? `Keep ${product.product_name} for my outfit.`
      : kind === "own" ? `I already own ${product.product_name}.`
      : kind === "reject" ? `Skip ${product.product_name} in future recommendations.`
      : `Remove ${product.product_name} from my selected outfit.`;
    const quietMessage = kind === "keep" ? `${product.product_name} added to your look.`
      : kind === "remove" ? `${product.product_name} removed from your look.`
      : kind === "own" ? `${product.product_name} marked as already owned.`
      : kind === "reject" ? `${product.product_name} skipped for future recommendations.` : undefined;
    send(text, kind, product, false, undefined, quietMessage);
  }
  function close() { requestRef.current?.abort(); onClose(); }
  const pending = sessionState.pending || sessionState.pending_answer;
  const welcome = entries.length === 1;

  return (
    <div className={styles.chat}>
      <header className={styles.header}>
        <span className={styles.logo} aria-hidden="true">ABC</span>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Personal shopping</p>
          <h2 className={styles.title}>AI Stylist</h2>
          {viewedPage ? <span className={styles.pageContext} aria-label="Current product context"
            title={`${viewedPage.product.product_name} · A$${viewedPage.product.price_aud.toFixed(2)}`}>
            Viewing: <strong>{viewedPage.product.product_name}</strong>
          </span> : null}
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.newChat} onClick={() => {
            requestRef.current?.abort(); requestRef.current = null; onReset();
          }}>New chat</button>
          <button type="button" className={styles.iconButton} onClick={close} aria-label="Close AI Stylist" title="Close AI Stylist">
            <CloseIcon />
          </button>
        </div>
      </header>
      {!welcome && sessionState.styling ? <OutfitSummary styling={sessionState.styling} open={open} feedback={selectionFeedback} disabled={busy || Boolean(pending)}
        onRemoveExternal={description => send(`Remove the owned item I described as "${description}".`, undefined, undefined, false, undefined, "Owned item removed from your look.")}
        onRemove={(productId, productName) => send(`Remove ${productName} from my outfit.`, "remove", undefined, false, productId, `${productName} removed from your look.`)} /> : null}
      <div ref={transcript} role="log" aria-live="polite" aria-relevant="additions" aria-busy={busy}
        className={`${styles.transcript} ${welcome ? styles.transcriptWelcome : ""}`}>
        {welcome ? (
          <div className={styles.welcome}>
            <p className={styles.eyebrow}>A little inspiration, just for you</p>
            <h3>Find your next<br /><em>favourite.</em></h3>
            <p className={styles.welcomeDescription}>Tell me an item, a style or an occasion.<br />Not sure yet? I’ll help you explore.</p>
            <div className={styles.welcomeStarters}>
              {["Find a dress", "Something for work", "Help me choose"].map(text => (
                <button key={text} type="button" className={styles.starter} onClick={() => send(text)}>
                  {text}<ChevronIcon direction="right" />
                </button>
              ))}
            </div>
            <p className={styles.welcomeHint}>Have a colour, size or budget in mind? Start there.</p>
          </div>
        ) : entries.map((entry, index) => {
          if (entry.id === "welcome") return null;
          const result = entry.result;
          const actionsAvailable = entry.id === activeReply && (!busy || quietBusy) && !pending;
          // Do not attach another sales offer to every cross-sell response.
          const lookAction = actionsAvailable ? act : undefined;
          const allowOffers = !result?.outfit_budget && result?.action !== "cross_sell" && result?.action !== "discover" && !sessionState.styling?.offers_paused;
          const selectedIds = sessionState.styling?.outfit.map(piece => piece.product_id) ?? [];
          const recommendedIds = result?.outfit_choices && result.outfit_budget
            ? suggestedOutfit(result.products, result.outfit_choices, result.outfit_budget.limit_aud)?.products.map(product => product.product_id) ?? [] : [];
          const onEvent = (event_type: "select" | "own" | "reject" | "add_to_cart", product_id: string, position: number) =>
            trackRecommendationEvents(entry.id, [{ event_type, product_id, position }]);
          return (
            <div key={entry.id} ref={index === entries.length - 1 ? latestEntry : undefined}
              className={`${styles.entry} ${entry.role === "user" ? styles.userEntry : styles.assistantEntry}`}>
              <div className={entry.role === "assistant" ? styles.replyBubble : undefined}>
                <span className={styles.speaker}>{entry.role === "user" ? "You" : "AI Stylist"}</span>
                {result?.outfit_review ? <OutfitReviewMessage review={result.outfit_review} /> : result?.outfit_budget && result.outfit_choices ?
                  <OutfitGuidance products={result.products} choices={result.outfit_choices} limit={result.outfit_budget.limit_aud} /> :
                  <ReplyMessage text={entry.text} collapsible={Boolean(result && (result.products.length || result.alternatives.length))} />}
                {result?.outfit_budget ? <div className={styles.budgetSummary} aria-label="Combined outfit budget">
                  <span><strong>A${result.outfit_budget.total_aud.toFixed(2)}
                    {result.outfit_choices && result.outfit_choices.maximum_total_aud !== result.outfit_budget.total_aud
                      ? `–A$${result.outfit_choices.maximum_total_aud.toFixed(2)}` : ""}</strong> combined</span>
                  <span>Within your <strong>A${result.outfit_budget.limit_aud.toFixed(2)}</strong> budget</span>
                </div> : null}
                {result?.purchase_budget ? <div className={styles.budgetSummary} aria-label="Selected purchases budget">
                  <span>A${result.purchase_budget.fixed_total_aud.toFixed(2)} selected</span>
                  <span>A${result.purchase_budget.remaining_aud.toFixed(2)} left of A${result.purchase_budget.limit_aud.toFixed(2)}</span>
                </div> : null}
                {result?.answer_sources.length ? <p className={styles.notice}>
                  Sources: {result.answer_sources.map((source, sourceIndex) => <span key={source.url}>
                    {sourceIndex > 0 ? " · " : ""}<Link href={source.url} onClick={close}>{source.label}</Link>
                  </span>)}
                </p> : null}
              </div>
              {index === entries.length - 1 && result?.task_transition_applied && result.issues.length ? <div className={styles.starters} role="group" aria-label="Resolve shopping request">
                {result.issues.filter(issue => issue.code === "unverified_requirement").map(issue => <button key={issue.id} type="button" className={styles.chip} disabled={busy}
                  onClick={() => send(`Remove my ${issue.scope} requirement: ${issue.value}.`, undefined, undefined, false, undefined, undefined,
                    { issue_id: issue.id, generation: sessionState.task?.generation ?? 0, operation: "drop_requirement" })}>Remove {String(issue.value)}</button>)}
                {result.issues.some(issue => issue.code === "unverified_requirement") ? <button type="button" className={styles.chip} disabled={busy}
                  onClick={() => send("Browse provisional options with my requirements kept unverified; exclude known violations.", undefined, undefined, false, undefined, undefined,
                    { issue_id: result.issues.find(issue => issue.code === "unverified_requirement")!.id, generation: sessionState.task?.generation ?? 0, operation: "preview_unverified" })}>Browse with unknown details labelled</button> : null}
                <button type="button" className={styles.chip} disabled={busy}
                  onClick={() => send("Cancel the current shopping task. Help me start a new search.", undefined, undefined, false, undefined, undefined,
                    { issue_id: result.issues[0].id, generation: sessionState.task?.generation ?? 0, operation: "restart_task" })}>Start a new shopping task</button>
              </div> : null}
              {result?.outfit_choices ? result.outfit_choices.groups.map((group, groupIndex) => (
                <ShoppingProductResults key={`${entry.id}-group-${groupIndex}`}
                  products={group.product_ids.map(id => result.products.find(product => product.product_id === id)!)}
                  heading={group.label} preferences={group.preferences} label={`${group.label} options`} onOpen={close} onAction={lookAction} open={open}
                  selectedIds={selectedIds} allowOffers={false} outfitMode actionDisabled={busy} recommendedIds={recommendedIds}
                  onEvent={(event_type, product_id, position) => trackRecommendationEvents(entry.groupRecommendationIds?.[groupIndex] ?? entry.id,
                    [{ event_type, product_id, position }])} />
              )) : result?.products.length ? <ShoppingProductResults
                products={result.products} preferences={result.applied_preferences}
                preferencesByProduct={result.outfit_budget ? Object.fromEntries(result.outfit_budget.items.map(item => [item.product_id, item.preferences])) : undefined}
                label={result.outfit_budget ? "Items in one complete set" : "Recommended products"} onOpen={close} onAction={lookAction} open={open}
                selectedIds={selectedIds} onEvent={onEvent} allowOffers={allowOffers} actionDisabled={busy} outfitMode={Boolean(result.outfit_budget)}
                onSimilar={actionsAvailable && result.action === "discover" ? product => send(`Show me more like ${product.product_name}.`, "similar", product) : undefined}
              /> : null}
              {result?.alternatives.length ? (
                <div>
                  <h3 className={styles.alternativeHeading}>Alternatives <span>Details differ</span></h3>
                  <ShoppingProductResults products={result.alternatives} preferences={result.alternatives_preferences}
                    label="Alternative products with disclosed differences" onOpen={close} onAction={lookAction} open={open}
                    selectedIds={selectedIds} onEvent={onEvent} allowOffers={allowOffers} actionDisabled={busy} positionOffset={result.products.length}
                    onSimilar={actionsAvailable && result.action === "discover" ? product => send(`Show me more like ${product.product_name}.`, "similar", product) : undefined} />
                </div>
              ) : null}
              {result?.optional_question && !result.outfit_choices && !result.outfit_budget ?
                <p className={styles.optionalQuestion}>{result.optional_question}</p> : null}
              {Boolean(result?.suggested_replies.length) && index === entries.length - 1 && !retry ? (
                <div className={styles.starters} role="group" aria-label="Suggested replies">
                  {result!.suggested_replies.map(choice => <button key={choice.message} type="button"
                    className={styles.chip} disabled={busy || Boolean(pending)} onClick={() => send(choice.message)}>
                    {choice.label}
                  </button>)}
                </div>
              ) : null}
              {actionsAvailable && result?.can_preview_other_colours ? (
                <div className={styles.starters}>
                  <button type="button" className={styles.chip} onClick={() =>
                    send("Show other colours as clearly labelled alternatives, keeping my original preferences saved.", undefined, undefined, true)
                  }>Explore other colours</button>
                  <p className={styles.notice}>Preview only. Your original colour and other restrictions stay saved.</p>
                </div>
              ) : null}
              {entry.id === activeReply && sessionState.styling?.outfit_request && hasEventContext(sessionState.styling) ?
                <DressCodeChoices value={sessionState.styling.dress_code ?? null}
                  disabled={busy || Boolean(pending)} onChoose={message => send(message)} /> : null}
            </div>
          );
        })}
        {conversationBusy ? <div ref={loading} role="status" className={styles.loading}>
          <span className={styles.loadingDots} aria-hidden="true"><i /><i /><i /></span>
          <span>Checking your request…</span>
        </div> : null}
      </div>
      {retry && !busy ? <div className={styles.controls}>
        <button type="button" className={styles.textButton} onClick={() => void run(retry.envelope, retry.quietMessage)}>Retry this request</button>
      </div> : null}
      <div className={styles.composerArea}>
        <form className={styles.composer} onSubmit={event => { event.preventDefault(); send(draft); }}>
          <textarea ref={input} rows={1} aria-label="Message your stylist" value={draft} onChange={event => setDraft(event.target.value)}
            maxLength={2000} placeholder="What can I help you find?" className={styles.input}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault(); send(draft);
              }
            }} />
          <button type={busy ? "button" : "submit"} disabled={!busy && !draft.trim()} className={styles.send}
            aria-label={busy ? "Cancel request" : "Send message"} title={busy ? "Cancel request" : undefined}
            onClick={busy ? event => { event.preventDefault(); cancelRequest(); } : undefined}>
            {busy ? <StopIcon /> : "Send"}
          </button>
        </form>
        <div className={styles.legal}>
          <span>Messages may be sent to OpenAI.</span>
          <details className={styles.privacyDetails}>
            <summary>Privacy & details</summary>
            <p>Your message and recent shopping context may be sent to OpenAI. Product details can change. {" "}
              <Link href="/terms-of-service" target="_blank" rel="noopener noreferrer">Read the terms and privacy information</Link>.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
