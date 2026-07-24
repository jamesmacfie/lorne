import { ArrowRight, Check, KeyRound, Sparkles, UserPlus } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { authClient } from "./auth-client";

type AuthMode = "sign-in" | "register";

const authErrorMessage = (mode: AuthMode): string => {
  if (mode === "sign-in") return "That username and password did not match.";
  return "The invite details or account information were not accepted.";
};

export function SignInScreen() {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setHydrated(true), []);

  const selectMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const username = String(values.get("username") ?? "").trim();
    const password = String(values.get("password") ?? "");

    const result =
      mode === "sign-in"
        ? await authClient.signIn.username({ username, password, rememberMe: true })
        : await authClient.$fetch("/sign-up/email", {
            method: "POST",
            body: {
              name: username,
              username,
              displayUsername: username,
              email: String(values.get("email") ?? "").trim(),
              inviteCode: String(values.get("inviteCode") ?? "").trim(),
              password
            }
          });

    setPending(false);
    if (result.error) {
      setError(result.error.message || authErrorMessage(mode));
      return;
    }
    window.location.replace("/");
  };

  return (
    <main className="sign-in-page">
      <section className="sign-in-copy">
        <a className="brand brand--public" href="/">
          <span className="brand-mark">L</span>
          <span>Lorne</span>
        </a>
        <div>
          <p className="eyebrow">
            <Sparkles aria-hidden /> Learn in little moments
          </p>
          <h1>
            One good question.
            <br />
            Then back to your day.
          </h1>
          <p className="lede">Turn anything you’re curious about into a tidy stack of flashcards—then make a spare five minutes count.</p>

          <div className="auth-panel">
            <fieldset className="auth-mode">
              <legend className="visually-hidden">Account action</legend>
              <button type="button" aria-pressed={mode === "sign-in"} onClick={() => selectMode("sign-in")} disabled={!hydrated || pending}>
                <KeyRound aria-hidden /> Sign in
              </button>
              <button
                type="button"
                aria-pressed={mode === "register"}
                onClick={() => selectMode("register")}
                disabled={!hydrated || pending}
              >
                <UserPlus aria-hidden /> Create account
              </button>
            </fieldset>

            <form className="auth-form" onSubmit={submit}>
              {mode === "register" && (
                <>
                  <label>
                    Invite email
                    <input name="email" type="email" autoComplete="email" required disabled={!hydrated || pending} />
                  </label>
                  <label>
                    Invite code
                    <input name="inviteCode" type="text" autoComplete="one-time-code" required disabled={!hydrated || pending} />
                  </label>
                </>
              )}
              <label>
                Username
                <input
                  name="username"
                  type="text"
                  autoComplete="username"
                  minLength={3}
                  maxLength={120}
                  pattern="[A-Za-z0-9_.@+-]+"
                  required
                  disabled={!hydrated || pending}
                  aria-describedby={mode === "register" ? "username-help" : undefined}
                />
                {mode === "register" && (
                  <span id="username-help">
                    3–120 characters. An email address is fine, or use letters, numbers, dots, dashes, and underscores.
                  </span>
                )}
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  minLength={12}
                  maxLength={128}
                  required
                  disabled={!hydrated || pending}
                />
                {mode === "register" && <span>Use at least 12 characters.</span>}
              </label>
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="button button--primary button--large" disabled={!hydrated || pending}>
                {pending ? "Working…" : mode === "sign-in" ? "Sign in" : "Create account"} <ArrowRight aria-hidden />
              </button>
            </form>
          </div>

          <p className="invite-note">
            <Check aria-hidden /> Lorne is currently an invite-only private beta.
          </p>
        </div>
        <p className="privacy-note">Your password is hashed. Your OpenAI key stays encrypted. Your learning stays yours.</p>
      </section>
      <section className="sign-in-demo" aria-label="A preview of a Lorne flashcard">
        <div className="demo-scribble" aria-hidden>
          5 min
        </div>
        <article className="preview-card">
          <header>
            <span>Guitar · Chords</span>
            <span>04 / 10</span>
          </header>
          <div className="preview-question">
            <p className="eyebrow">Quick recall</p>
            <h2>Which notes build a major triad?</h2>
            <p>Tap the card to reveal</p>
          </div>
          <footer>
            <span>Again</span>
            <span>Hard</span>
            <span className="selected">Good</span>
            <span>Easy</span>
          </footer>
        </article>
        <p className="demo-caption">Small stack. Real progress. No feed to fall into.</p>
      </section>
    </main>
  );
}
