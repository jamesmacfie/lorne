import { Link } from "@tanstack/react-router";
import { History, MessageCircleQuestion, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CardChatDetail, StudyCard } from "#/shared/contracts";
import { ChatConversation } from "./chat-conversation";
import { LoadingState } from "#/features/app/loading-state";

function useDesktopPanel(): boolean {
  const [desktop, setDesktop] = useState(() => (typeof window === "undefined" ? true : window.matchMedia("(min-width: 1000px)").matches));
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1000px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return desktop;
}

function PanelContents({
  card,
  threadId,
  detail,
  hasOlderVersions,
  loading,
  close,
  newChat,
  onPersisted
}: {
  card: StudyCard;
  threadId: string;
  detail: CardChatDetail | null;
  hasOlderVersions: boolean;
  loading: boolean;
  close: () => void;
  newChat: () => void;
  onPersisted: () => void;
}) {
  return (
    <>
      <header className="chat-panel-header">
        <div>
          <p className="eyebrow">Ask about this card</p>
          <h2>A focused detour</h2>
        </div>
        <div>
          <button type="button" className="icon-button" onClick={newChat} aria-label="Start a new chat" title="New chat">
            <Plus aria-hidden />
          </button>
          <button type="button" className="icon-button" onClick={close} aria-label="Close chat" title="Close">
            <X aria-hidden />
          </button>
        </div>
      </header>
      <details className="chat-card-summary">
        <summary>{card.topicTitle} · Card summary</summary>
        <p>
          <strong>Question:</strong> {card.front}
        </p>
        <p>
          <strong>Answer:</strong> {card.back}
        </p>
      </details>
      {!detail && hasOlderVersions && (
        <Link className="chat-history-note" to="/chats">
          <History aria-hidden /> Saved chats use an earlier version of this card. View history
        </Link>
      )}
      {loading ? (
        <LoadingState label="Opening saved context…" />
      ) : (
        <ChatConversation
          key={threadId}
          threadId={threadId}
          cardId={card.id}
          initialDetail={detail}
          onNewChat={newChat}
          onPersisted={onPersisted}
        />
      )}
    </>
  );
}

export function CardChatPanel({
  card,
  threadId,
  detail,
  hasOlderVersions,
  loading,
  close,
  newChat,
  onPersisted
}: {
  card: StudyCard;
  threadId: string;
  detail: CardChatDetail | null;
  hasOlderVersions: boolean;
  loading: boolean;
  close: () => void;
  newChat: () => void;
  onPersisted: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const desktop = useDesktopPanel();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!desktop && dialog && !dialog.open) dialog.showModal();
  }, [desktop]);
  const contents = (
    <PanelContents
      card={card}
      threadId={threadId}
      detail={detail}
      hasOlderVersions={hasOlderVersions}
      loading={loading}
      close={close}
      newChat={newChat}
      onPersisted={onPersisted}
    />
  );
  if (desktop) return <aside className="card-chat-panel">{contents}</aside>;
  return (
    <dialog
      ref={dialogRef}
      className="card-chat-sheet"
      aria-label="Ask about this card"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={close}
    >
      {contents}
    </dialog>
  );
}

export function AskCardButton({
  online,
  onClick,
  buttonRef
}: {
  online: boolean;
  onClick: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className="ask-card-button button button--secondary"
      disabled={!online}
      title={online ? undefined : "A connection is required to chat about this card."}
      onClick={onClick}
    >
      <MessageCircleQuestion aria-hidden /> Ask about this card
    </button>
  );
}
