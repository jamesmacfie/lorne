import { Check, CheckCircle2, ExternalLink, KeyRound, Layers3, LoaderCircle, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import type { TopicInput } from "#/shared/contracts";
import type { getOnboardingFn } from "#/server/functions/onboarding-functions";

export type OnboardingData = Awaited<ReturnType<typeof getOnboardingFn>>;

type StepActionProps = {
  busy: boolean;
  label: string;
  onBack?: () => void;
};

function StepActions({ busy, label, onBack }: StepActionProps) {
  return (
    <footer className="onboarding-actions">
      <p>{busy ? "Saving this step…" : "You can sign out and resume later."}</p>
      <div>
        {onBack && (
          <button type="button" className="button button--secondary" onClick={onBack} disabled={busy}>
            Back
          </button>
        )}
        <button type="submit" className="button button--primary" disabled={busy} aria-busy={busy}>
          {busy && <LoaderCircle className="spin" aria-hidden />}
          {busy ? "Saving…" : label}
        </button>
      </div>
    </footer>
  );
}

export function WelcomeStep({ busy, onStart }: { busy: boolean; onStart: () => Promise<void> }) {
  return (
    <form
      className="onboarding-stage onboarding-stage--welcome"
      onSubmit={(event) => {
        event.preventDefault();
        void onStart();
      }}
    >
      <div className="onboarding-stage-copy">
        <p className="onboarding-kicker">A short setup</p>
        <h1>Give your curiosity somewhere to go.</h1>
        <p>
          Lorne needs one subject, your preferred study rhythm, and a private OpenAI project key. Set those once, then your first card stack
          is ready to make.
        </p>
      </div>
      <ol className="onboarding-overview" aria-label="Setup overview">
        <li>
          <Layers3 aria-hidden />
          <span>
            <strong className="onboarding-overview-title">Choose what to learn</strong>
            Start broad. You can add focused subtopics later.
          </span>
        </li>
        <li>
          <SlidersHorizontal aria-hidden />
          <span>
            <strong className="onboarding-overview-title">Set a comfortable pace</strong>
            Pick a daily target and the balance of text and visual cards.
          </span>
        </li>
        <li>
          <KeyRound aria-hidden />
          <span>
            <strong className="onboarding-overview-title">Connect OpenAI</strong>
            Your key is encrypted before it is stored and is never returned to this browser.
          </span>
        </li>
      </ol>
      <StepActions busy={busy} label="Start setup" />
    </form>
  );
}

export function TopicsStep({
  busy,
  data,
  onBack,
  onSave
}: {
  busy: boolean;
  data: OnboardingData;
  onBack: () => void;
  onSave: (topics: TopicInput[]) => Promise<void>;
}) {
  return (
    <form
      className="onboarding-stage"
      onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const titles = String(values.get("titles") ?? "")
          .split(/[\n,]+/)
          .map((title) => title.trim())
          .filter(Boolean);
        void onSave(
          titles.map((title) => ({
            title,
            context: String(values.get("context") ?? ""),
            difficulty: String(values.get("difficulty")) as TopicInput["difficulty"],
            visualMix: String(values.get("visualMix")) as TopicInput["visualMix"],
            parentTopicId: null
          }))
        );
      }}
    >
      <div className="onboarding-stage-copy">
        <p className="onboarding-kicker">Step one</p>
        <h1>What would you like to know better?</h1>
        <p>Add one subject or several. A little context helps Lorne make cards that match what you actually want to learn.</p>
      </div>
      {data.topics.length > 0 && (
        <section className="onboarding-saved" aria-labelledby="saved-topics-title">
          <h2 id="saved-topics-title">Already on your shelf</h2>
          <ul>
            {data.topics.map((topic) => (
              <li key={topic.id}>
                <CheckCircle2 aria-hidden />
                <span>
                  <strong>{topic.title}</strong>
                  {topic.difficulty} · {topic.visualMix.replaceAll("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="onboarding-fields">
        <label>
          Topic names
          <textarea
            name="titles"
            maxLength={1_500}
            placeholder={"Guitar theory\nRoman history\nNative birds"}
            required={data.topics.length === 0}
            disabled={busy}
          />
          <span>Separate several topics with a comma or new line.</span>
        </label>
        <label>
          Helpful context
          <textarea name="context" maxLength={2_000} placeholder="Practical knowledge I can use and remember." disabled={busy} />
          <span>Optional. This instruction applies to every topic added above.</span>
        </label>
        <div className="onboarding-field-pair">
          <label>
            Starting level
            <select name="difficulty" defaultValue="beginner" disabled={busy}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </label>
          <label>
            Card mix
            <select name="visualMix" defaultValue="balanced" disabled={busy}>
              <option value="mostly_text">Mostly text</option>
              <option value="balanced">Balanced</option>
              <option value="mostly_visual">Mostly visual</option>
            </select>
          </label>
        </div>
      </div>
      <StepActions busy={busy} label={data.topics.length ? "Keep these topics" : "Save topics"} onBack={onBack} />
    </form>
  );
}

export type PreferenceValues = {
  timezone: string;
  dailyGoal: number;
  textCardPercent: number;
};

export function PreferencesStep({
  busy,
  data,
  onBack,
  onSave
}: {
  busy: boolean;
  data: OnboardingData;
  onBack: () => void;
  onSave: (preferences: PreferenceValues) => Promise<void>;
}) {
  const [textCardPercent, setTextCardPercent] = useState(data.preferences?.textCardPercent ?? 70);
  const [timezone, setTimezone] = useState(data.preferences?.timezone ?? "UTC");

  useEffect(() => {
    if (data.step <= 2) setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [data.step]);

  return (
    <form
      className="onboarding-stage"
      onSubmit={(event) => {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        void onSave({
          timezone: String(values.get("timezone")),
          dailyGoal: Number(values.get("dailyGoal")),
          textCardPercent: Number(values.get("textCardPercent"))
        });
      }}
    >
      <div className="onboarding-stage-copy">
        <p className="onboarding-kicker">Step two</p>
        <h1>Set a pace you’ll come back to.</h1>
        <p>
          This is a target, not a streak. Lorne uses your timezone to count each day and keeps visual generation within your chosen mix.
        </p>
      </div>
      <div className="onboarding-fields">
        <label>
          Timezone
          <input
            name="timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.currentTarget.value)}
            autoComplete="off"
            required
            disabled={busy}
          />
          <span>Using this device’s timezone. You can enter another IANA timezone such as Pacific/Auckland.</span>
        </label>
        <label>
          Daily review goal
          <input
            name="dailyGoal"
            type="number"
            min="1"
            max="100"
            defaultValue={data.preferences?.dailyGoal ?? 10}
            required
            disabled={busy}
          />
          <span>Ten reviews usually fit into a spare few minutes.</span>
        </label>
        <label>
          Text card share
          <span className="onboarding-range-value">
            <output htmlFor="onboarding-text-share">{textCardPercent}% text</output>
            <span>{100 - textCardPercent}% visual</span>
          </span>
          <input
            id="onboarding-text-share"
            name="textCardPercent"
            type="range"
            min="0"
            max="100"
            step="10"
            value={textCardPercent}
            onChange={(event) => setTextCardPercent(Number(event.currentTarget.value))}
            disabled={busy}
          />
        </label>
      </div>
      <StepActions busy={busy} label="Save study rhythm" onBack={onBack} />
    </form>
  );
}

export function CredentialStep({
  busy,
  data,
  onBack,
  onContinue,
  onSave
}: {
  busy: boolean;
  data: OnboardingData;
  onBack: () => void;
  onContinue: () => Promise<void>;
  onSave: (apiKey: string, form: HTMLFormElement) => Promise<void>;
}) {
  const verified = data.credential.configured && data.credential.status === "verified";
  if (verified) {
    return (
      <form
        className="onboarding-stage"
        onSubmit={(event) => {
          event.preventDefault();
          void onContinue();
        }}
      >
        <div className="onboarding-stage-copy">
          <p className="onboarding-kicker">Step three</p>
          <h1>Your project key is ready.</h1>
          <p>Lorne has a verified encrypted key ending in ••••{data.credential.lastFour}. The full value cannot be read back in the app.</p>
        </div>
        <div className="onboarding-key-ready" role="status">
          <Check aria-hidden />
          <div>
            <strong className="onboarding-key-ready-title">Validated and encrypted</strong>
            <span className="onboarding-key-ready-copy">
              Lorne can read the configured model. Your restricted key remains encrypted at rest.
            </span>
          </div>
        </div>
        <StepActions busy={busy} label="Review setup" onBack={onBack} />
      </form>
    );
  }

  return (
    <form
      className="onboarding-stage"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        void onSave(String(new FormData(form).get("apiKey") ?? ""), form);
      }}
    >
      <div className="onboarding-stage-copy">
        <p className="onboarding-kicker">Step three</p>
        <h1>Connect a dedicated OpenAI project.</h1>
        <p>Use a separate restricted key so Lorne has only the access it needs and its spend is easy to monitor.</p>
      </div>
      <ol className="onboarding-key-guide">
        <li>
          Open{" "}
          <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
            API keys <ExternalLink aria-hidden />
          </a>{" "}
          and create a project key for Lorne.
        </li>
        <li>Choose Restricted. Allow Models Read, Responses Write, and Images Write.</li>
        <li>Set a project budget and usage alerts before generating your first stack.</li>
      </ol>
      <div className="onboarding-fields">
        <label>
          OpenAI API key
          <input
            name="apiKey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-proj-…"
            minLength={20}
            maxLength={256}
            required
            disabled={busy}
            aria-describedby="onboarding-key-help"
          />
          <span id="onboarding-key-help">Validated on the server, then stored with AES-256-GCM encryption.</span>
        </label>
      </div>
      {data.credential.status === "limited" && (
        <p className="onboarding-inline-error" role="alert">
          This saved key cannot read Lorne’s configured model. Update its project access, then validate it again.
        </p>
      )}
      <StepActions busy={busy} label="Validate key" onBack={onBack} />
    </form>
  );
}

export function ReviewStep({
  busy,
  data,
  onBack,
  onComplete
}: {
  busy: boolean;
  data: OnboardingData;
  onBack: () => void;
  onComplete: () => Promise<void>;
}) {
  return (
    <form
      className="onboarding-stage"
      onSubmit={(event) => {
        event.preventDefault();
        void onComplete();
      }}
    >
      <div className="onboarding-stage-copy">
        <p className="onboarding-kicker">Ready to learn</p>
        <h1>Everything needed is in place.</h1>
        <p>Open your topic shelf next and generate the first stack. You can change every choice later in Topics or Settings.</p>
      </div>
      <dl className="onboarding-review">
        <div>
          <dt>Topics</dt>
          <dd>{data.topics.map((topic) => topic.title).join(", ")}</dd>
        </div>
        <div>
          <dt>Daily goal</dt>
          <dd>{data.preferences?.dailyGoal ?? 10} reviews</dd>
        </div>
        <div>
          <dt>Card mix</dt>
          <dd>
            {data.preferences?.textCardPercent ?? 70}% text · {100 - (data.preferences?.textCardPercent ?? 70)}% visual
          </dd>
        </div>
        <div>
          <dt>OpenAI</dt>
          <dd>Verified key ending ••••{data.credential.lastFour}</dd>
        </div>
      </dl>
      {data.missingRequirements.length > 0 && (
        <p className="onboarding-inline-error" role="alert">
          Setup still needs: {data.missingRequirements.join(", ")}.
        </p>
      )}
      <StepActions busy={busy} label="Open my topic shelf" onBack={onBack} />
    </form>
  );
}
