import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpenCheck, Eye, Lightbulb, RotateCcw, WifiOff } from "lucide-react";
import type { CardChatDetail, ReviewRating, StudyCard } from "#/shared/contracts";
import { getStudyDataFn } from "#/server/functions/app-functions";
import { getCardChatPanelFn } from "#/server/functions/chat-functions";
import { cacheStudyQueue, enqueueReview, getCachedStudyQueue, syncReviewOutbox } from "#/pwa/review-outbox";
import { ErrorState, LoadingState } from "#/features/app/loading-state";
import { AskCardButton, CardChatPanel } from "#/features/chat/card-chat-panel";
import { createId } from "#/shared/ids";
import { filterStudyableCards } from "./study-card-policy";

const ratings: Array<{ rating: ReviewRating; label: string; key: string; className: string }> = [
  { rating: 1, label: "Again", key: "1", className: "again" },
  { rating: 2, label: "Hard", key: "2", className: "hard" },
  { rating: 3, label: "Good", key: "3", className: "good" },
  { rating: 4, label: "Easy", key: "4", className: "easy" }
];

export function StudyScreen({ userId }: { userId: string }) {
  const [queue, setQueue] = useState<StudyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [sessionGoal, setSessionGoal] = useState(10);
  const [online, setOnline] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatThreadId, setChatThreadId] = useState(() => createId("chat"));
  const [chatDetail, setChatDetail] = useState<CardChatDetail | null>(null);
  const [hasOlderChats, setHasOlderChats] = useState(false);
  const [chatLoadError, setChatLoadError] = useState<string | null>(null);
  const askButtonRef = useRef<HTMLButtonElement>(null);
  const shownAt = useRef(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStudyDataFn({ data: { limit: 50 } });
      const studyable = filterStudyableCards(data.queue);
      setQueue(studyable);
      setSessionGoal(Math.min(10, studyable.length));
      await cacheStudyQueue(userId, studyable);
    } catch {
      const cached = filterStudyableCards(await getCachedStudyQueue(userId));
      if (cached.length) {
        setQueue(cached);
        setSessionGoal(Math.min(10, cached.length));
        await cacheStudyQueue(userId, cached);
      } else {
        setError("Your next cards are out of reach right now. Reconnect and try once more.");
      }
    } finally {
      setLoading(false);
      shownAt.current = Date.now();
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const rate = useCallback(
    async (rating: ReviewRating) => {
      const card = queue[0];
      if (!card || !revealed || chatOpen) return;
      const remaining = queue.slice(1);
      setQueue(remaining);
      setReviewed((count) => count + 1);
      setRevealed(false);
      setHint(false);
      await enqueueReview(userId, {
        cardId: card.id,
        rating,
        reviewedAt: new Date().toISOString(),
        elapsedSeconds: Math.min(3_600, Math.max(0, Math.round((Date.now() - shownAt.current) / 1_000)))
      });
      await cacheStudyQueue(userId, remaining);
      shownAt.current = Date.now();
      if (navigator.onLine) void syncReviewOutbox(userId);
    },
    [chatOpen, queue, revealed, userId]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (chatOpen) return;
      if ((event.key === " " || event.key === "Enter") && !revealed) {
        event.preventDefault();
        setRevealed(true);
      }
      const selected = ratings.find((rating) => rating.key === event.key);
      if (selected && revealed) {
        event.preventDefault();
        void rate(selected.rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen, rate, revealed]);

  if (loading)
    return (
      <main className="page">
        <LoadingState />
      </main>
    );
  if (error)
    return (
      <main className="page">
        <ErrorState message={error} retry={() => void load()} />
      </main>
    );
  if (reviewed >= sessionGoal && sessionGoal > 0)
    return (
      <main className="page page--study">
        <section className="session-complete">
          <BookOpenCheck aria-hidden />
          <p className="eyebrow">Stack complete</p>
          <h1>{reviewed} small wins, tucked away.</h1>
          <p>Your ratings are saved. Come back when you find another quiet minute.</p>
          <button
            type="button"
            className="button button--primary"
            onClick={() => {
              setReviewed(0);
              void load();
            }}
          >
            <RotateCcw aria-hidden /> Study another stack
          </button>
        </section>
      </main>
    );
  const card = queue[0];
  if (!card)
    return (
      <main className="page">
        <section className="empty-state">
          <BookOpenCheck aria-hidden />
          <p className="eyebrow">All clear</p>
          <h1>No card is due right now.</h1>
          <p>Create a topic or generate another batch to keep your little library growing.</p>
          <Link className="button button--primary" to="/topics">
            Go to topics
          </Link>
        </section>
      </main>
    );

  const position = reviewed + 1;
  const closeChat = () => {
    setChatOpen(false);
    requestAnimationFrame(() => askButtonRef.current?.focus());
  };
  const startNewChat = () => {
    setChatDetail(null);
    setChatThreadId(createId("chat"));
  };
  const openChat = async () => {
    if (!online) return;
    setChatLoadError(null);
    setChatOpen(true);
    setChatLoading(true);
    try {
      const data = await getCardChatPanelFn({ data: { cardId: card.id, cardVersion: card.version } });
      setChatDetail(data.latest);
      setHasOlderChats(data.hasOlderVersions);
      setChatThreadId(data.latest?.id ?? createId("chat"));
    } catch {
      setChatOpen(false);
      setChatLoadError("Card chat could not be opened. Check your connection and try again.");
      requestAnimationFrame(() => askButtonRef.current?.focus());
    } finally {
      setChatLoading(false);
    }
  };
  return (
    <main className={`page page--study ${chatOpen ? "page--study-chat-open" : ""}`}>
      <header className="page-heading page-heading--study">
        <div>
          <p className="eyebrow">Quick study</p>
          <h1>A few minutes. One useful thing.</h1>
        </div>
        <div className="study-counter">
          <strong>{String(position).padStart(2, "0")}</strong>
          <span>/ {String(sessionGoal).padStart(2, "0")}</span>
        </div>
      </header>
      <div className="study-chat-layout">
        <div className="study-card-column">
          <div
            className="study-progress"
            role="progressbar"
            aria-label={`${position} of ${sessionGoal}`}
            aria-valuemin={1}
            aria-valuemax={sessionGoal}
            aria-valuenow={position}
          >
            <span style={{ width: `${Math.min(100, (position / sessionGoal) * 100)}%` }} />
          </div>
          <article className={`study-card ${revealed ? "study-card--revealed" : ""}`}>
            <header>
              <span>{card.topicTitle}</span>
              <span>{card.kind === "image" ? "Visual card" : "Recall card"}</span>
            </header>
            {card.assetId && <img className="study-card-image" src={`/api/assets/${card.assetId}`} alt="Visual prompt for this card" />}
            <div className="study-card-body">
              <p className="eyebrow">{revealed ? "Answer" : "Question"}</p>
              <h2>{revealed ? card.back : card.front}</h2>
              {revealed && card.explanation && <p className="explanation">{card.explanation}</p>}
              {revealed && (
                <div className="ask-card-action">
                  <AskCardButton online={online} onClick={() => void openChat()} buttonRef={askButtonRef} />
                  {!online && <span>A connection is required for card chat.</span>}
                  {chatLoadError && <span role="alert">{chatLoadError}</span>}
                </div>
              )}
              {!revealed && hint && card.hint && (
                <p className="hint">
                  <Lightbulb aria-hidden /> {card.hint}
                </p>
              )}
            </div>
            <footer>
              {!revealed ? (
                <>
                  <button type="button" className="button button--primary reveal-button" onClick={() => setRevealed(true)}>
                    <Eye aria-hidden /> Reveal answer <kbd>Space</kbd>
                  </button>
                  {card.hint && (
                    <button type="button" className="text-button" onClick={() => setHint((value) => !value)}>
                      <Lightbulb aria-hidden /> {hint ? "Hide hint" : "Need a hint?"}
                    </button>
                  )}
                </>
              ) : chatOpen ? (
                <button type="button" className="button button--secondary back-to-rating" onClick={closeChat}>
                  <ArrowLeft aria-hidden /> Back to rating
                </button>
              ) : (
                <fieldset className="rating-row" aria-label="Rate your recall">
                  {ratings.map((item) => (
                    <button
                      type="button"
                      key={item.rating}
                      className={`rating rating--${item.className}`}
                      onClick={() => void rate(item.rating)}
                    >
                      <kbd>{item.key}</kbd>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </fieldset>
              )}
            </footer>
          </article>
          {!online && (
            <p className="offline-note">
              <WifiOff aria-hidden /> Ratings save here first. Card chat needs a connection.
            </p>
          )}
        </div>
        {chatOpen && (
          <CardChatPanel
            card={card}
            threadId={chatThreadId}
            detail={chatDetail}
            hasOlderVersions={hasOlderChats}
            loading={chatLoading}
            close={closeChat}
            newChat={startNewChat}
            onPersisted={() => undefined}
          />
        )}
      </div>
    </main>
  );
}
