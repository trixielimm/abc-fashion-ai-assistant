"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChatRequestError, postChatJson } from "@/lib/ai/chatRequest";
import type { ViewedPageContext } from "@/lib/stylist/viewedProduct";
import {
  acceptReply, makeTurn, newSession, snapshot,
  type ChatProduct, type TurnEnvelope, type TurnReply,
} from "@/lib/stylist/conversationProtocol";
import { ShoppingProductResults, type ShoppingAction } from "./ShoppingProductResults";
import styles from "./ShoppingConversation.module.css";

type Entry = { id: string; role: "user" | "assistant"; text: string; result?: TurnReply };

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
  const [retry, setRetry] = useState<TurnEnvelope | null>(null);
  const [activeReply, setActiveReply] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState(newSession);
  const session = useRef(sessionState);
  const requestRef = useRef<AbortController | null>(null);
  const usedPageKey = useRef<number | null>(null);
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);
  useEffect(() => { if (!open) requestRef.current?.abort(); }, [open]);
  useEffect(() => {
    const element = transcript.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [entries, busy, retry]);

  function cancelRequest() {
    const controller = requestRef.current;
    if (!controller) return;
    controller.abort();
    requestRef.current = null;
    setBusy(false);
    setRetry(null);
    setEntries(previous => [...previous, {
      id: crypto.randomUUID(), role: "assistant",
      text: "Cancelled that request. Your saved preferences and cart are unchanged.",
    }]);
  }

  async function run(envelope: TurnEnvelope) {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setRetry(null);
    setActiveReply(null);
    try {
      const raw = await postChatJson("/api/conversation-search", envelope, {
        signal: controller.signal, timeoutMs: 120_000,
      });
      if (requestRef.current !== controller || controller.signal.aborted) return;
      const result = acceptReply(envelope.turn, raw);
      session.current = result.session;
      setSessionState(result.session);
      const id = crypto.randomUUID();
      setEntries(previous => [...previous, {
        id, role: "assistant", text: result.reply.message, result: result.reply,
      }]);
      setActiveReply(id);
    } catch (error) {
      if (requestRef.current !== controller || controller.signal.aborted) return;
      const expired = error instanceof ChatRequestError && error.status === 409;
      const invalid = error instanceof ChatRequestError && [400, 403, 413, 415].includes(error.status ?? 0);
      if (!expired && !invalid) setRetry({ ...envelope, retry: true });
      setEntries(previous => [...previous, {
        id: crypto.randomUUID(), role: "assistant",
        text: expired
          ? "That retry has expired. Please send your message again. Your saved preferences are unchanged."
          : "I couldn't load or verify the results just now. Please try again. Your preferences and cart are unchanged.",
      }]);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setBusy(false);
      }
    }
  }

  function send(message: string, kind?: ShoppingAction, product?: ChatProduct, previewOtherColours = false) {
    const text = message.trim();
    if (!text || text.length > 2000 || requestRef.current || busy) return;
    const focus = previewOtherColours ? null : product ? snapshot(product)
      : !session.current.pending && viewedPage && viewedPage.key !== usedPageKey.current
        ? snapshot(viewedPage.product) : null;
    try {
      const turn = makeTurn(session.current, text, focus,
        kind && product ? { kind, product_id: product.product_id } : undefined,
        previewOtherColours);
      usedPageKey.current = viewedPage?.key ?? null;
      const envelope: TurnEnvelope = { request_id: crypto.randomUUID(), retry: false, turn };
      setEntries(previous => [...previous, { id: envelope.request_id, role: "user", text }]);
      setDraft("");
      void run(envelope);
    } catch {
      setEntries(previous => [...previous, {
        id: crypto.randomUUID(), role: "assistant",
        text: "I couldn't prepare this request from the saved context. Please use Reset and start a new search.",
      }]);
    }
  }
  function act(kind: ShoppingAction, product: ChatProduct) {
    const text = kind === "cross_sell" ? `Find an extra for ${product.product_name}.`
      : kind === "cheaper" ? `Find cheaper alternatives to ${product.product_name}.`
        : `Compare higher-priced alternatives to ${product.product_name}.`;
    send(text, kind, product);
  }
  function close() { requestRef.current?.abort(); onClose(); }
  const pending = sessionState.pending;

  return (
    <div className={styles.chat}>
      <header className={styles.header}>
        <span className={styles.logo} aria-hidden="true">ABC</span>
        <h2 className={styles.title}>AI Stylist</h2>
        <div className={styles.headerActions}>
          <button type="button" className={styles.iconButton} onClick={() => {
            requestRef.current?.abort(); requestRef.current = null; onReset();
          }}>Reset</button>
          <button type="button" className={styles.iconButton} onClick={close} aria-label="Close AI Stylist">Close</button>
        </div>
      </header>
      {viewedPage ? <aside className={styles.pageContext} aria-label="Current product context">
        Viewing: <strong>{viewedPage.product.product_name}</strong> · A${viewedPage.product.price_aud.toFixed(2)}
      </aside> : null}
      <div ref={transcript} role="log" aria-live="polite" aria-relevant="additions" aria-busy={busy} className={styles.transcript}>
        {entries.map(entry => {
          const result = entry.result;
          const actionsAvailable = entry.id === activeReply && !busy && !pending;
          // Do not attach another sales offer to every cross-sell response.
          const lookAction = actionsAvailable && result?.action !== "cross_sell" ? act : undefined;
          return (
            <div key={entry.id} className={`${styles.entry} ${entry.role === "user" ? styles.userEntry : styles.assistantEntry}`}>
              <span className={styles.speaker}>{entry.role === "user" ? "You" : "AI Stylist"}</span>
              <p className={styles.message}>{entry.text}</p>
              {entry.id === "welcome" && entries.length === 1 ? (
                <div className={styles.starters}>
                  {["Find a dress", "Show me bags", "Something for work"].map(text => (
                    <button key={text} type="button" className={styles.chip} disabled={busy} onClick={() => send(text)}>{text}</button>
                  ))}
                </div>
              ) : null}
              {result?.products.length ? <ShoppingProductResults
                products={result.products} preferences={result.applied_preferences}
                label="Recommended products" onOpen={close} onAction={lookAction}
              /> : null}
              {result?.alternatives.length ? (
                <div>
                  <h3 className={styles.alternativeHeading}>Alternatives — not exact matches</h3>
                  <p className={styles.notice}>Check the listed differences. These suggestions do not change your saved request.</p>
                  <ShoppingProductResults products={result.alternatives} preferences={result.alternatives_preferences}
                    label="Alternative products with disclosed differences" onOpen={close} onAction={lookAction} />
                </div>
              ) : null}
              {result?.optional_question ? <p className={styles.question}>{result.optional_question}</p> : null}
              {actionsAvailable && result?.can_preview_other_colours ? (
                <div className={styles.starters}>
                  <button type="button" className={styles.chip} onClick={() =>
                    send("Show other colours as clearly labelled alternatives, keeping my original preferences saved.", undefined, undefined, true)
                  }>Explore other colours</button>
                  <p className={styles.notice}>Preview only. Your original colour and other restrictions stay saved.</p>
                </div>
              ) : null}
            </div>
          );
        })}
        {busy ? <p role="status" className={styles.loading}>Looking through the catalogue…</p> : null}
      </div>
      {pending && !busy ? <div className={styles.controls}>
        Reply to continue, or <button type="button" className={styles.textButton} onClick={() => send("cancel")}>cancel this question</button>.
      </div> : null}
      {retry && !busy ? <div className={styles.controls}>
        <button type="button" className={styles.textButton} onClick={() => void run(retry)}>Retry this request</button>
      </div> : null}
      {busy ? <div className={styles.controls}><button type="button" className={styles.textButton} onClick={cancelRequest}>Cancel request</button></div> : null}
      <div className={styles.composerArea}>
        <form className={styles.composer} onSubmit={event => { event.preventDefault(); send(draft); }}>
          <textarea rows={1} aria-label="Message your stylist" value={draft} onChange={event => setDraft(event.target.value)}
            maxLength={2000} placeholder="What can I help you find?" className={styles.input}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault(); send(draft);
              }
            }} />
          <button type="submit" disabled={busy || !draft.trim()} className={styles.send}>Send</button>
        </form>
        <p className={styles.legal}>
          Your message and recent shopping context may be sent to OpenAI. Product details can change. {" "}
          <Link href="/terms-of-service" target="_blank" rel="noopener noreferrer">Terms and privacy information</Link>.
        </p>
      </div>
    </div>
  );
}