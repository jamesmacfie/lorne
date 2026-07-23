import { BarChart3, CalendarClock, Flame, Sprout, Timer, TrendingUp } from "lucide-react";
import { getProgressFn } from "#/server/functions/app-functions";
import { useAsyncData } from "#/features/app/use-async-data";
import { ErrorState, LoadingState } from "#/features/app/loading-state";

export function ProgressScreen() {
  const result = useAsyncData(() => getProgressFn(), []);
  if (result.loading)
    return (
      <main className="page">
        <LoadingState label="Counting the little wins…" />
      </main>
    );
  if (result.error || !result.data)
    return (
      <main className="page">
        <ErrorState message={result.error ?? "Progress is unavailable."} retry={() => void result.refresh()} />
      </main>
    );
  const data = result.data;
  const goalPercent = Math.min(100, Math.round((data.reviewsToday / data.dailyGoal) * 100));
  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Progress, gently measured</p>
          <h1>Proof that small moments add up.</h1>
          <p>Scheduling estimates guide your next review; they are not a verdict on mastery.</p>
        </div>
      </header>
      <section className="progress-hero">
        <div className="goal-ring" style={{ "--goal": `${goalPercent * 3.6}deg` } as React.CSSProperties}>
          <div>
            <strong>{data.reviewsToday}</strong>
            <span>of {data.dailyGoal} today</span>
          </div>
        </div>
        <div>
          <p className="eyebrow">Daily rhythm</p>
          <h2>{goalPercent >= 100 ? "Goal tucked away." : `${data.dailyGoal - data.reviewsToday} reviews to today’s goal.`}</h2>
          <p>{Math.round(data.studySecondsToday / 60)} focused minutes so far.</p>
        </div>
      </section>
      <section className="metric-grid">
        <article>
          <Flame aria-hidden />
          <strong>{data.streak}</strong>
          <span>day streak</span>
        </article>
        <article>
          <TrendingUp aria-hidden />
          <strong>{data.retentionEstimate === null ? "—" : `${data.retentionEstimate}%`}</strong>
          <span>30-day recall estimate</span>
        </article>
        <article>
          <CalendarClock aria-hidden />
          <strong>{data.dueTomorrow}</strong>
          <span>due tomorrow</span>
        </article>
        <article>
          <Timer aria-hidden />
          <strong>{Math.round(data.studySecondsToday / 60)}m</strong>
          <span>studied today</span>
        </article>
      </section>
      <section className="progress-panels">
        <article className="progress-panel">
          <div className="section-heading">
            <p className="eyebrow">Card garden</p>
            <h2>Where the stack sits</h2>
          </div>
          <div className="garden-row">
            <div>
              <Sprout aria-hidden />
              <strong>{data.newCount}</strong>
              <span>New</span>
            </div>
            <div>
              <BarChart3 aria-hidden />
              <strong>{data.learningCount}</strong>
              <span>Learning</span>
            </div>
            <div>
              <TrendingUp aria-hidden />
              <strong>{data.matureCount}</strong>
              <span>Mature</span>
            </div>
          </div>
        </article>
        <article className="progress-panel">
          <div className="section-heading">
            <p className="eyebrow">By topic</p>
            <h2>30-day recall</h2>
          </div>
          {data.recallByTopic.length ? (
            <div className="recall-list">
              {data.recallByTopic.map((topic) => (
                <div key={topic.topicId}>
                  <span>
                    {topic.topicTitle}
                    <small>{topic.reviews} reviews</small>
                  </span>
                  <strong>{topic.recall === null ? "—" : `${topic.recall}%`}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Topic recall appears after your first reviews.</p>
          )}
        </article>
      </section>
    </main>
  );
}
