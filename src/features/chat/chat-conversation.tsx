import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowDown, RotateCcw, Send, Square, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CARD_CHAT_DISCLOSURE_VERSION,
  CARD_CHAT_QUESTION_LIMIT,
  CARD_CHAT_TEXT_LIMIT,
  type CardChatDetail,
  type CardChatMessage
} from "#/shared/contracts";
import { createId } from "#/shared/ids";

const disclosure =
  "To answer, Lorne sends this card, its topic path and notes, and this conversation to OpenAI using your saved project key. Image cards include the image. Other cards and your review history stay out. This chat is saved in Lorne, and OpenAI usage may be billed to your project.";

const starters = ["Explain this another way", "Give me an example", "What should I remember?"];
type ChatUiMessage = UIMessage<{ status?: CardChatMessage["status"] }>;

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function toUiMessage(message: CardChatMessage): ChatUiMessage {
  return {
    id: message.id,
    role: message.role,
    metadata: { status: message.status },
    parts: message.text ? [{ type: "text", text: message.text }] : []
  };
}

function friendlyError(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { message?: string };
    if (parsed.message) return parsed.message;
  } catch {
    // The transport can also return a plain error message.
  }
  return error.message || "The answer could not be completed.";
}

export function ChatConversation({
  threadId,
  cardId,
  initialDetail,
  onNewChat,
  onPersisted
}: {
  threadId: string;
  cardId?: string;
  initialDetail: CardChatDetail | null;
  onNewChat?: () => void;
  onPersisted?: () => void;
}) {
  const [composer, setComposer] = useState("");
  const [nearLatest, setNearLatest] = useState(true);
  const [lastFailedAssistantId, setLastFailedAssistantId] = useState<string | null>(null);
  const [stoppedAssistantId, setStoppedAssistantId] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const initialMessages = useMemo(() => initialDetail?.messages.map(toUiMessage) ?? [], [initialDetail]);
  const transport = useMemo(
    () =>
      new DefaultChatTransport<ChatUiMessage>({
        api: `/api/card-chats/${encodeURIComponent(threadId)}/stream`,
        prepareSendMessagesRequest: ({ messages, body }) => {
          const latestUser = messages.findLast((message) => message.role === "user");
          if (!latestUser) throw new Error("No user message to send.");
          return {
            body: {
              cardId: initialDetail ? undefined : cardId,
              message: { id: latestUser.id, text: messageText(latestUser) },
              contextDisclosureVersion: CARD_CHAT_DISCLOSURE_VERSION,
              retryOfAssistantMessageId: typeof body?.retryOfAssistantMessageId === "string" ? body.retryOfAssistantMessageId : undefined
            }
          };
        }
      }),
    [cardId, initialDetail, threadId]
  );
  const { messages, sendMessage, stop, status, error, clearError } = useChat<ChatUiMessage>({
    id: threadId,
    messages: initialMessages,
    generateId: () => createId("msg"),
    transport,
    onFinish: () => onPersisted?.(),
    onError: () => {
      const assistant = messages.findLast((message) => message.role === "assistant");
      setLastFailedAssistantId(assistant?.id ?? null);
      onPersisted?.();
    }
  });
  const questionCount = messages.filter((message) => message.role === "user").length;
  const transcriptLength = messages.reduce((total, message) => total + messageText(message).length, 0);
  const busy = status === "submitted" || status === "streaming";
  const atLimit = questionCount >= CARD_CHAT_QUESTION_LIMIT;

  useEffect(() => {
    const element = transcriptRef.current;
    if (!element || !nearLatest || transcriptLength === 0) return;
    element.scrollTo({ top: element.scrollHeight, behavior: status === "streaming" ? "auto" : "smooth" });
  }, [nearLatest, status, transcriptLength]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = composer.trim();
    if (!text || busy || atLimit) return;
    setComposer("");
    clearError();
    setLastFailedAssistantId(null);
    setStoppedAssistantId(null);
    await sendMessage({ text, messageId: createId("msg") });
  };

  const retry = async (assistantId?: string) => {
    const retryId = assistantId ?? lastFailedAssistantId;
    const failedAssistant = retryId
      ? messages.find((message) => message.id === retryId)
      : messages.findLast((message) => message.role === "assistant");
    const index = failedAssistant ? messages.indexOf(failedAssistant) : -1;
    const userMessage = index > 0 ? messages.slice(0, index).findLast((message) => message.role === "user") : undefined;
    if (!failedAssistant || !userMessage) return;
    clearError();
    setStoppedAssistantId(null);
    await sendMessage(
      { text: messageText(userMessage), messageId: userMessage.id },
      { body: { retryOfAssistantMessageId: failedAssistant.id } }
    );
  };

  return (
    <div className="chat-conversation">
      <div
        className="chat-transcript"
        ref={transcriptRef}
        aria-live="polite"
        onScroll={(event) => {
          const element = event.currentTarget;
          setNearLatest(element.scrollHeight - element.scrollTop - element.clientHeight < 56);
        }}
      >
        {messages.length === 0 ? (
          <section className="chat-empty">
            <Sparkles aria-hidden />
            <h3>Stay with the card a little longer.</h3>
            <p>Ask for a different explanation, a concrete example, or the one thing worth remembering.</p>
            <fieldset className="chat-starters">
              <legend className="visually-hidden">Question starters</legend>
              {starters.map((starter) => (
                <button type="button" className="chip-button" key={starter} onClick={() => setComposer(starter)}>
                  {starter}
                </button>
              ))}
            </fieldset>
          </section>
        ) : (
          <ol className="chat-messages">
            {messages.map((message) => {
              const text = messageText(message);
              const retryable =
                message.role === "assistant" && (message.metadata?.status === "failed" || message.metadata?.status === "aborted");
              const stopped = message.role === "assistant" && message.id === stoppedAssistantId;
              if (!text && message.role === "assistant" && busy) {
                return (
                  <li className="chat-message chat-message--assistant chat-message--thinking" key={message.id}>
                    Thinking…
                  </li>
                );
              }
              if (!text && (retryable || stopped)) {
                return (
                  <li className="chat-message chat-message--assistant chat-message--interrupted" key={message.id}>
                    <span>Lorne</span>
                    <p>Answer stopped before any text arrived.</p>
                    <button type="button" className="text-button" onClick={() => void retry(message.id)}>
                      <RotateCcw aria-hidden /> Retry
                    </button>
                  </li>
                );
              }
              if (!text) return null;
              return (
                <li className={`chat-message chat-message--${message.role}`} key={message.id}>
                  <span>{message.role === "user" ? "You" : "Lorne"}</span>
                  <p>{text}</p>
                  {(retryable || stopped) && (
                    <button type="button" className="text-button" onClick={() => void retry(message.id)}>
                      <RotateCcw aria-hidden /> {message.metadata?.status === "aborted" || stopped ? "Retry stopped answer" : "Retry"}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {!nearLatest && (
        <button
          type="button"
          className="chat-jump button button--secondary"
          onClick={() => {
            const element = transcriptRef.current;
            element?.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
            setNearLatest(true);
          }}
        >
          <ArrowDown aria-hidden /> Jump to latest
        </button>
      )}
      {questionCount === 0 ? (
        <details className="chat-disclosure" open>
          <summary>Before your first question</summary>
          <p>{disclosure}</p>
        </details>
      ) : (
        <details className="chat-disclosure chat-disclosure--compact">
          <summary>Context shared</summary>
          <p>{disclosure}</p>
        </details>
      )}
      {error && (
        <div className="chat-error" role="alert">
          <p>{friendlyError(error)}</p>
          {lastFailedAssistantId && (
            <button type="button" className="text-button" onClick={() => void retry()}>
              <RotateCcw aria-hidden /> Retry
            </button>
          )}
        </div>
      )}
      {atLimit ? (
        <div className="chat-limit">
          <p>This chat has reached 12 questions.</p>
          {onNewChat && (
            <button type="button" className="button button--secondary" onClick={onNewChat}>
              Start new chat
            </button>
          )}
        </div>
      ) : (
        <form className="chat-composer" onSubmit={submit}>
          <label htmlFor={`chat-composer-${threadId}`} className="visually-hidden">
            Ask about this card
          </label>
          <textarea
            id={`chat-composer-${threadId}`}
            rows={2}
            maxLength={CARD_CHAT_TEXT_LIMIT}
            value={composer}
            disabled={busy}
            placeholder="Ask a follow-up question…"
            onChange={(event) => setComposer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <div>
            <span>
              {composer.length.toLocaleString()} / {CARD_CHAT_TEXT_LIMIT.toLocaleString()}
            </span>
            {busy ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => {
                  setStoppedAssistantId(messages.findLast((message) => message.role === "assistant")?.id ?? null);
                  stop();
                  onPersisted?.();
                }}
              >
                <Square aria-hidden /> Stop
              </button>
            ) : (
              <button type="submit" className="button button--primary" disabled={!composer.trim()}>
                <Send aria-hidden /> {questionCount === 0 ? "Send with context" : "Send"}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
