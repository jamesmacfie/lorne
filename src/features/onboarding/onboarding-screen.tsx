import { Check, LogOut } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { OnboardingStep, TopicInput } from "#/shared/contracts";
import { authClient } from "#/features/auth/auth-client";
import { ErrorState, LoadingState } from "#/features/app/loading-state";
import { useAsyncData } from "#/features/app/use-async-data";
import { clearPrivateOfflineData } from "#/pwa/review-outbox";
import { createTopicsFn, saveCredentialFn, updatePreferencesFn } from "#/server/functions/app-functions";
import { advanceOnboardingFn, completeOnboardingFn, getOnboardingFn } from "#/server/functions/onboarding-functions";
import {
  CredentialStep,
  type OnboardingData,
  type PreferenceValues,
  PreferencesStep,
  ReviewStep,
  TopicsStep,
  WelcomeStep
} from "./onboarding-steps";

type WizardStep = 0 | OnboardingStep;

const stages: Array<{ label: string; step: WizardStep }> = [
  { step: 0, label: "Welcome" },
  { step: 1, label: "Topics" },
  { step: 2, label: "Rhythm" },
  { step: 3, label: "OpenAI" },
  { step: 4, label: "Review" }
];

function safeWizardStep(step: number): WizardStep {
  if (step <= 0) return 0;
  if (step >= 4) return 4;
  return step as OnboardingStep;
}

export function OnboardingScreen({ updateReady, viewer }: { updateReady: boolean; viewer: { id: string; name: string; email: string } }) {
  const router = useRouter();
  const result = useAsyncData(() => getOnboardingFn(), []);
  const [step, setStep] = useState<WizardStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (result.data && step === null) setStep(safeWizardStep(result.data.step));
  }, [result.data, step]);

  const signOut = async () => {
    await clearPrivateOfflineData();
    window.localStorage.removeItem("lorne-active-user");
    await authClient.signOut();
    await router.invalidate();
  };

  const advance = async (targetStep: OnboardingStep): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const response = await advanceOnboardingFn({ data: { step: targetStep } });
      if (!response.ok) {
        setError(response.message);
        return false;
      }
      result.setData(response.data);
      setStep(targetStep);
      return true;
    } catch {
      setError("Setup progress could not be saved. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveTopics = async (topics: TopicInput[]) => {
    setBusy(true);
    setError(null);
    try {
      if (topics.length) {
        const response = await createTopicsFn({ data: { topics } });
        if (!response.ok) {
          setError(response.message);
          return;
        }
      }
    } catch {
      setError("Those topics could not be saved. Check your connection and try again.");
      return;
    } finally {
      setBusy(false);
    }
    await advance(2);
  };

  const savePreferences = async (preferences: PreferenceValues) => {
    setBusy(true);
    setError(null);
    try {
      await updatePreferencesFn({ data: preferences });
    } catch {
      setError("Your study rhythm could not be saved. Check the timezone and try again.");
      return;
    } finally {
      setBusy(false);
    }
    await advance(3);
  };

  const saveCredential = async (apiKey: string, form: HTMLFormElement) => {
    setBusy(true);
    setError(null);
    try {
      const response = await saveCredentialFn({ data: { apiKey } });
      if (!response.ok) {
        setError(response.message);
        result.setData(await getOnboardingFn());
        return;
      }
      form.reset();
    } catch {
      setError("The key could not be validated right now. Check your connection and try again.");
      return;
    } finally {
      setBusy(false);
    }
    await advance(4);
  };

  const complete = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await completeOnboardingFn();
      if (!response.ok) {
        setError(response.message);
        return;
      }
      await router.navigate({ to: "/topics" });
      await router.invalidate();
    } catch {
      setError("Lorne could not finish setup. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (result.error)
    return (
      <main className="onboarding-shell onboarding-shell--state">
        <ErrorState message={result.error} retry={() => void result.refresh()} />
      </main>
    );
  if (result.loading || !result.data)
    return (
      <main className="onboarding-shell onboarding-shell--state">
        <LoadingState label="Opening your setup…" />
      </main>
    );

  const data: OnboardingData = result.data;
  const currentStep = step ?? safeWizardStep(data.step);

  return (
    <main className="onboarding-shell">
      {updateReady && (
        <button type="button" className="update-banner" onClick={() => window.location.reload()}>
          A fresh Lorne is ready. Reload
        </button>
      )}
      <header className="onboarding-topbar">
        <span className="brand">
          <span className="brand-mark">L</span>
          <span>Lorne</span>
        </span>
        <button type="button" className="text-button" onClick={() => void signOut()} disabled={busy}>
          <LogOut aria-hidden /> Sign out
        </button>
      </header>
      <div className="onboarding-layout">
        <aside className="onboarding-rail" aria-label="Setup progress">
          <div>
            <p className="onboarding-kicker">Your setup</p>
            <h2>Four small choices, then the app gets out of your way.</h2>
          </div>
          <ol>
            {stages.map((stage) => {
              const completed = stage.step < data.step;
              const available = stage.step <= data.step;
              return (
                <li key={stage.step}>
                  <button
                    type="button"
                    onClick={() => setStep(stage.step)}
                    disabled={!available || busy}
                    aria-current={currentStep === stage.step ? "step" : undefined}
                    aria-label={`${stage.label}${completed ? ", complete" : ""}`}
                  >
                    <span className="onboarding-stage-number">{completed ? <Check aria-hidden /> : stage.step + 1}</span>
                    <strong className="onboarding-stage-label">{stage.label}</strong>
                  </button>
                </li>
              );
            })}
          </ol>
          <footer>
            <p>One topic becomes a useful stack.</p>
            <span>{viewer.email}</span>
          </footer>
        </aside>
        <section className="onboarding-content" aria-live="polite">
          {error && (
            <p className="onboarding-error" role="alert">
              {error}
            </p>
          )}
          <div className="onboarding-stage-wrap" key={currentStep}>
            {currentStep === 0 && <WelcomeStep busy={busy} onStart={() => advance(1).then(() => undefined)} />}
            {currentStep === 1 && <TopicsStep busy={busy} data={data} onBack={() => setStep(0)} onSave={saveTopics} />}
            {currentStep === 2 && <PreferencesStep busy={busy} data={data} onBack={() => setStep(1)} onSave={savePreferences} />}
            {currentStep === 3 && (
              <CredentialStep
                busy={busy}
                data={data}
                onBack={() => setStep(2)}
                onContinue={() => advance(4).then(() => undefined)}
                onSave={saveCredential}
              />
            )}
            {currentStep === 4 && <ReviewStep busy={busy} data={data} onBack={() => setStep(3)} onComplete={complete} />}
          </div>
        </section>
      </div>
    </main>
  );
}
