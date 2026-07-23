import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Plus, Trash2, WifiOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CardChatContextSnapshot, CardChatDetail } from "#/shared/contracts";
import { createId } from "#/shared/ids";
import { deleteCardChatFn, getCardChatFn, getCardChatNewThreadFn } from "#/server/functions/chat-functions";
import { ErrorState, LoadingState } from "#/features/app/loading-state";
import { CardSnapshot } from "./card-snapshot";
import { ChatConversation } from "./chat-conversation";

export function ChatDetailScreen({ threadId: routeThreadId }: { threadId: string }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CardChatDetail | null | undefined>();
  const [currentSnapshot, setCurrentSnapshot] = useState<CardChatContextSnapshot | null>(null);
  const [activeThreadId, setActiveThreadId] = useState(routeThreadId);
  const [newWithCurrent, setNewWithCurrent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    if (!navigator.onLine) {
      setError("Saved chats are online-only. Reconnect to open this thread.");
      return;
    }
    setError(null);
    try {
      const loaded = await getCardChatFn({ data: { threadId: routeThreadId } });
      setDetail(loaded);
      if (!loaded) setError("That saved chat could not be found.");
    } catch {
      setError("This saved chat could not be reached.");
    }
  }, [routeThreadId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (error)
    return (
      <main className="page page--chats">
        <section className="chat-offline-state">
          {!navigator.onLine && <WifiOff aria-hidden />}
          <ErrorState message={error} retry={() => void load()} />
        </section>
      </main>
    );
  if (detail === undefined)
    return (
      <main className="page page--chats">
        <LoadingState />
      </main>
    );
  if (!detail) return null;
  const earlierVersion = detail.currentCardVersion !== null && detail.currentCardVersion !== detail.cardVersion;
  const snapshot = newWithCurrent && currentSnapshot ? currentSnapshot : detail.contextSnapshot;

  const startWithCurrent = async () => {
    const loaded = await getCardChatNewThreadFn({ data: { cardId: detail.cardId } });
    if (!loaded) {
      setError("The current card is unavailable, so a new chat cannot be started.");
      return;
    }
    setCurrentSnapshot(loaded);
    setNewWithCurrent(true);
    setActiveThreadId(createId("chat"));
  };

  const remove = async () => {
    const result = await deleteCardChatFn({ data: { threadId: detail.id } });
    if (result.ok) await navigate({ to: "/chats" });
    else setError(result.message);
  };

  return (
    <main className="page page--chat-detail">
      <header className="chat-detail-heading">
        <Link className="text-button" to="/chats">
          <ArrowLeft aria-hidden /> All chats
        </Link>
        <div>
          {earlierVersion && !newWithCurrent && (
            <button type="button" className="button button--secondary" onClick={() => void startWithCurrent()}>
              <Plus aria-hidden /> New chat with current card
            </button>
          )}
          {!newWithCurrent && (
            <button
              type="button"
              className="icon-button"
              aria-label="Delete chat"
              title="Delete chat"
              onClick={() => deleteDialogRef.current?.showModal()}
            >
              <Trash2 aria-hidden />
            </button>
          )}
        </div>
      </header>
      <div className="chat-detail-layout">
        <CardSnapshot snapshot={snapshot} earlierVersion={earlierVersion && !newWithCurrent} />
        <section className="chat-detail-transcript" aria-label="Saved chat transcript">
          <header>
            <p className="eyebrow">{newWithCurrent ? "New chat" : "Saved conversation"}</p>
            <h1>{newWithCurrent ? "Ask about the current card" : "Continue the thread"}</h1>
          </header>
          <ChatConversation
            key={activeThreadId}
            threadId={activeThreadId}
            cardId={newWithCurrent ? detail.cardId : undefined}
            initialDetail={newWithCurrent ? null : detail}
            onNewChat={() => void startWithCurrent()}
          />
        </section>
      </div>
      <dialog className="confirm-dialog" ref={deleteDialogRef}>
        <p className="eyebrow">Delete saved chat</p>
        <h2>Remove this conversation?</h2>
        <p>The transcript will be permanently removed. The source card stays in your library.</p>
        <div>
          <button type="button" className="button" onClick={() => deleteDialogRef.current?.close()}>
            Keep chat
          </button>
          <button type="button" className="button button--danger" onClick={() => void remove()}>
            Delete chat
          </button>
        </div>
      </dialog>
    </main>
  );
}
