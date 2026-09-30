"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Container } from "@/components/layout/Container";
import { createClient } from "@/lib/supabase/client";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/my-style";
}

export default function SignInPage() {
  const [next] = useState(() => typeof window === "undefined" ? "/my-style" : safeNext(new URLSearchParams(window.location.search).get("next")));
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void Promise.resolve().then(() => {
      if (new URLSearchParams(window.location.search).has("error")) {
        setMessage("Sign-in could not be completed. Please try again.");
      }
    });
  }, []);

  async function googleSignIn() {
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", next);
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo.toString() } });
      if (error) throw error;
    } catch {
      setMessage("Google sign-in is unavailable. Please try email instead.");
      setBusy(false);
    }
  }

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
      if (error) throw error;
      setCodeSent(true);
      setMessage("Check your email for a one-time code.");
    } catch {
      setMessage("Could not send a code. Please check your address and try again.");
    } finally { setBusy(false); }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
      if (error) throw error;
      window.location.assign(new URL(next, window.location.origin).toString());
    } catch {
      setMessage("That code could not be verified. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Container className="mx-auto max-w-lg px-5 py-16 sm:py-24">
      <p className="text-xs tracking-[0.18em] uppercase text-muted">ABC Fashion</p>
      <h1 className="mt-3 font-serif text-4xl">Sign in to remember your style</h1>
      <p className="mt-4 text-sm leading-6 text-muted">Save your sizes, likes, avoids and favourite products for next time. You can still use the stylist as a guest.</p>
      <button type="button" onClick={googleSignIn} disabled={busy} className="mt-9 h-12 w-full border border-foreground text-sm disabled:opacity-50">Continue with Google</button>
      <div className="my-6 text-center text-xs uppercase tracking-widest text-muted">or use email</div>
      {!codeSent ? (
        <form onSubmit={sendCode} className="space-y-3">
          <label htmlFor="email" className="block text-sm">Email address</label>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 w-full border border-hairline bg-background px-3" />
          <button disabled={busy} className="h-12 w-full bg-foreground text-sm text-background disabled:opacity-50">Send one-time code</button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-3">
          <p className="text-sm text-muted">Code sent to {email}</p>
          <label htmlFor="code" className="block text-sm">One-time code</label>
          <input id="code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(event) => setCode(event.target.value)} className="h-12 w-full border border-hairline bg-background px-3" />
          <button disabled={busy} className="h-12 w-full bg-foreground text-sm text-background disabled:opacity-50">Verify and sign in</button>
          <button type="button" onClick={() => { setCodeSent(false); setCode(""); }} className="block text-sm underline">Use another email</button>
        </form>
      )}
      {message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}
      <p className="mt-8 text-sm"><Link href="/" className="underline">Continue shopping as a guest</Link></p>
    </Container>
  );
}
