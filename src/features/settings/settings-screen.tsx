import { useState } from "react";
import { CheckCircle2, KeyRound, LockKeyhole, Save, Trash2 } from "lucide-react";
import { deleteCredentialFn, getSettingsFn, saveCredentialFn, updatePreferencesFn } from "#/server/functions/app-functions";
import { useAsyncData } from "#/features/app/use-async-data";
import { ErrorState, LoadingState } from "#/features/app/loading-state";
import { authClient } from "#/features/auth/auth-client";

export function SettingsScreen() {
  const result = useAsyncData(() => getSettingsFn(), []);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  if (result.loading)
    return (
      <main className="page">
        <LoadingState label="Opening your settings…" />
      </main>
    );
  if (result.error || !result.data)
    return (
      <main className="page">
        <ErrorState message={result.error ?? "Settings are unavailable."} retry={() => void result.refresh()} />
      </main>
    );
  const { credential, preferences } = result.data;
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Your pace. Your key. Your call.</h1>
          <p>Generation uses your own OpenAI project; studying and editing do not.</p>
        </div>
      </header>
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
      <section className="settings-grid">
        <article className="settings-panel">
          <div className="section-heading">
            <KeyRound className="section-icon" aria-hidden />
            <p className="eyebrow">OpenAI credential</p>
            <h2>{credential.configured ? `Key ending ••••${credential.lastFour}` : "Connect a project key"}</h2>
          </div>
          {credential.configured && (
            <p className={`credential-status credential-status--${credential.status}`}>
              <CheckCircle2 aria-hidden /> {credential.status === "verified" ? "Validated and ready" : "Saved with limited model access"}
            </p>
          )}
          <p className="muted">
            Use a dedicated restricted project key with Models Read, Responses Write, and Images Write. Set project spend limits in OpenAI
            before generating.
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              const form = event.currentTarget;
              const key = String(new FormData(form).get("apiKey"));
              const response = await saveCredentialFn({ data: { apiKey: key } });
              setNotice(response.ok ? "Key encrypted, saved, and ready." : response.message);
              if (response.ok) {
                form.reset();
                await result.refresh();
              }
              setSaving(false);
            }}
          >
            <label>
              {credential.configured ? "Replace key" : "OpenAI API key"}
              <input name="apiKey" type="password" autoComplete="off" spellCheck={false} placeholder="sk-proj-…" required />
            </label>
            <button type="submit" className="button button--primary" disabled={saving}>
              <LockKeyhole aria-hidden /> {saving ? "Checking access…" : "Validate and encrypt"}
            </button>
          </form>
          {credential.configured && (
            <button
              type="button"
              className="text-button text-button--danger"
              onClick={async () => {
                if (!window.confirm("Remove the encrypted OpenAI key? Running generations will stop safely.")) return;
                await deleteCredentialFn();
                setNotice("OpenAI key removed.");
                await result.refresh();
              }}
            >
              <Trash2 aria-hidden /> Remove key
            </button>
          )}
          <aside className="data-note">
            <LockKeyhole aria-hidden />
            <div>
              <strong>What leaves Lorne?</strong>
              <p>
                Topic names, your instructions, and candidate card content are sent through your OpenAI account with storage disabled. API
                data is not used for training by default unless your account opts in; abuse-monitoring retention may still apply.
              </p>
            </div>
          </aside>
        </article>
        <article className="settings-panel">
          <div className="section-heading">
            <p className="eyebrow">Study rhythm</p>
            <h2>Keep it comfortable</h2>
          </div>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              await updatePreferencesFn({
                data: {
                  timezone: String(values.get("timezone")),
                  dailyGoal: Number(values.get("dailyGoal")),
                  textCardPercent: Number(values.get("textCardPercent"))
                }
              });
              setNotice("Study preferences saved.");
            }}
          >
            <label>
              Timezone
              <input name="timezone" defaultValue={preferences?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone} required />
            </label>
            <label>
              Daily review goal
              <input name="dailyGoal" type="number" min="1" max="100" defaultValue={preferences?.dailyGoal ?? 10} required />
            </label>
            <label>
              Text card share <span>Visual cards make up the remainder.</span>
              <input name="textCardPercent" type="range" min="0" max="100" defaultValue={preferences?.textCardPercent ?? 70} />
            </label>
            <button type="submit" className="button button--secondary">
              <Save aria-hidden /> Save rhythm
            </button>
          </form>
        </article>
        <article className="settings-panel">
          <div className="section-heading">
            <LockKeyhole className="section-icon" aria-hidden />
            <p className="eyebrow">Account security</p>
            <h2>Change your password</h2>
          </div>
          <p className="muted">Use at least 12 characters. Changing it signs out your other Lorne sessions.</p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setChangingPassword(true);
              const form = event.currentTarget;
              const values = new FormData(form);
              const response = await authClient.changePassword({
                currentPassword: String(values.get("currentPassword") ?? ""),
                newPassword: String(values.get("newPassword") ?? ""),
                revokeOtherSessions: true
              });
              setNotice(response.error ? "The password could not be changed. Check your current password." : "Password changed.");
              if (!response.error) form.reset();
              setChangingPassword(false);
            }}
          >
            <label>
              Current password
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                minLength={12}
                maxLength={128}
                required
                disabled={changingPassword}
              />
            </label>
            <label>
              New password
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                disabled={changingPassword}
              />
            </label>
            <button type="submit" className="button button--secondary" disabled={changingPassword}>
              <LockKeyhole aria-hidden /> {changingPassword ? "Changing…" : "Change password"}
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}
