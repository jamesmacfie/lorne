import { ImageIcon } from "lucide-react";
import type { CardChatContextSnapshot } from "#/shared/contracts";

export function CardSnapshot({ snapshot, earlierVersion }: { snapshot: CardChatContextSnapshot; earlierVersion: boolean }) {
  return (
    <article className="chat-snapshot">
      <header>
        <div>
          <p className="eyebrow">{earlierVersion ? "Earlier card version" : "Saved card snapshot"}</p>
          <h2>{snapshot.topicPath.join(" / ")}</h2>
        </div>
        <span>v{snapshot.version}</span>
      </header>
      {snapshot.visualAssetId ? (
        <img src={`/api/assets/${snapshot.visualAssetId}`} alt="Visual prompt saved with this card chat" />
      ) : snapshot.kind === "image" ? (
        <div className="chat-snapshot-missing">
          <ImageIcon aria-hidden /> Saved image unavailable
        </div>
      ) : null}
      <dl>
        <div>
          <dt>Question</dt>
          <dd>{snapshot.question}</dd>
        </div>
        <div>
          <dt>Answer</dt>
          <dd>{snapshot.answer}</dd>
        </div>
        {snapshot.explanation && (
          <div>
            <dt>Explanation</dt>
            <dd>{snapshot.explanation}</dd>
          </div>
        )}
        {snapshot.hint && (
          <div>
            <dt>Hint</dt>
            <dd>{snapshot.hint}</dd>
          </div>
        )}
      </dl>
    </article>
  );
}
