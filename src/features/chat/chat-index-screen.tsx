import { Link } from "@tanstack/react-router";
import { MessageCircleQuestion, WifiOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { CardChatThreadSummary } from "#/shared/contracts";
import { listCardChatsFn } from "#/server/functions/chat-functions";
import { ErrorState, LoadingState } from "#/features/app/loading-state";

type GroupName = "Today" | "This week" | "Earlier";

function groupName(value: string): GroupName {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1_000) return "This week";
  return "Earlier";
}

export function ChatIndexScreen() {
  const [threads, setThreads] = useState<CardChatThreadSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!navigator.onLine) {
      setError("Saved chats are online-only. Reconnect to open them.");
      return;
    }
    setError(null);
    try {
      setThreads(await listCardChatsFn());
    } catch {
      setError("Saved chats could not be reached.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (error)
    return (
      <main className="page page--chats">
        <section className="chat-offline-state">
          <WifiOff aria-hidden />
          <ErrorState message={error} retry={() => void load()} />
        </section>
      </main>
    );
  if (!threads)
    return (
      <main className="page page--chats">
        <LoadingState />
      </main>
    );
  const grouped = new Map<GroupName, CardChatThreadSummary[]>();
  for (const thread of threads) {
    const name = groupName(thread.lastActivityAt);
    grouped.set(name, [...(grouped.get(name) ?? []), thread]);
  }
  return (
    <main className="page page--chats">
      <header className="page-heading chat-index-heading">
        <div>
          <p className="eyebrow">Saved chats</p>
          <h1>Questions worth keeping.</h1>
          <p>Every thread stays paired with the exact card version that shaped its answers.</p>
        </div>
        <MessageCircleQuestion aria-hidden />
      </header>
      {threads.length === 0 ? (
        <section className="empty-state chat-index-empty">
          <MessageCircleQuestion aria-hidden />
          <h2>No saved chats yet.</h2>
          <p>Reveal a card while studying, then choose “Ask about this card.” A chat is saved after your first question.</p>
          <Link className="button button--primary" to="/">
            Go to study
          </Link>
        </section>
      ) : (
        <div className="chat-index-groups">
          {(["Today", "This week", "Earlier"] as const).map((name) => {
            const items = grouped.get(name);
            if (!items?.length) return null;
            return (
              <section key={name}>
                <h2>{name}</h2>
                <ol>
                  {items.map((thread) => (
                    <li key={thread.id}>
                      <Link to="/chats/$threadId" params={{ threadId: thread.id }}>
                        <div className="chat-index-row-main">
                          <span>{thread.topicPath.join(" / ")}</span>
                          <h3>{thread.cardQuestion}</h3>
                          <p>{thread.firstUserQuestion}</p>
                        </div>
                        <div className="chat-index-row-meta">
                          <time dateTime={thread.lastActivityAt}>
                            {new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" }).format(new Date(thread.lastActivityAt))}
                          </time>
                          <span>
                            {thread.messageCount} {thread.messageCount === 1 ? "message" : "messages"}
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
