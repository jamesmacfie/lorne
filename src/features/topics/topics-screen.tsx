import { useEffect, useState } from "react";
import { Archive, ChevronDown, CirclePlus, Image, Layers3, Pencil, Trash2 } from "lucide-react";
import { createSortableId } from "#/shared/ids";
import {
  archiveTopicFn,
  createTopicsFn,
  deleteTopicFn,
  getTopicCardsFn,
  getTopicsDataFn,
  startGenerationFn,
  updateCardFn,
  updateTopicFn
} from "#/server/functions/app-functions";
import { useAsyncData } from "#/features/app/use-async-data";
import { ErrorState, LoadingState } from "#/features/app/loading-state";

type TopicCard = Awaited<ReturnType<typeof getTopicCardsFn>>[number];

export function TopicsScreen() {
  const result = useAsyncData(() => getTopicsDataFn(), []);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [topicCards, setTopicCards] = useState<TopicCard[]>([]);

  useEffect(() => {
    if (!result.data?.jobs.some((job) => job.status === "queued" || job.status === "running")) return;
    const timer = window.setInterval(() => void result.refresh(), 4_000);
    return () => window.clearInterval(timer);
  }, [result.data?.jobs, result.refresh]);

  if (result.loading)
    return (
      <main className="page">
        <LoadingState label="Opening your topic shelf…" />
      </main>
    );
  if (result.error || !result.data)
    return (
      <main className="page">
        <ErrorState message={result.error ?? "Topics are unavailable."} retry={() => void result.refresh()} />
      </main>
    );
  const topicData = result.data;
  const active = topicData.topics.filter((topic) => topic.status === "active");

  const create = async (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const titles = String(formData.get("titles") ?? "")
      .split(/[\n,]+/)
      .map((title) => title.trim())
      .filter(Boolean);
    const response = await createTopicsFn({
      data: {
        topics: titles.map((title) => ({
          title,
          context: String(formData.get("context") ?? ""),
          difficulty: String(formData.get("difficulty")) as "beginner" | "intermediate" | "advanced",
          visualMix: String(formData.get("visualMix")) as "mostly_text" | "balanced" | "mostly_visual",
          parentTopicId: String(formData.get("parentTopicId") || "") || null
        }))
      }
    });
    if (response.ok) {
      form.reset();
      setNotice(`${response.data.length} topic${response.data.length === 1 ? "" : "s"} added.`);
      await result.refresh();
    } else setNotice(response.message);
  };

  const generate = async (topicId: string, count: 20 | 30 | 50) => {
    const response = await startGenerationFn({ data: { topicId, count, idempotencyKey: createSortableId("generation") } });
    setNotice(response.ok ? "Generation started. You can leave this page—it will keep working." : response.message);
    await result.refresh();
  };

  const loadCards = async (topicId: string) => {
    setSelectedTopic(topicId);
    setTopicCards(await getTopicCardsFn({ data: { id: topicId } }));
  };

  return (
    <main className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Your library</p>
          <h1>Topics worth keeping close.</h1>
          <p>Broad subjects at the top; focused subtopics tucked neatly beneath.</p>
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
      <section className="workbench">
        <form
          className="create-topic-panel"
          onSubmit={(event) => {
            event.preventDefault();
            void create(event.currentTarget);
          }}
        >
          <div className="section-heading">
            <p className="eyebrow">Add knowledge</p>
            <h2>What should we learn?</h2>
          </div>
          <label>
            Topic names <span>Separate several with a comma or new line.</span>
            <textarea name="titles" maxLength={1_500} placeholder={"Guitar theory\nRoman history\nNative birds"} required />
          </label>
          <label>
            Helpful context <span>Optional; tell Lorne what matters.</span>
            <textarea name="context" maxLength={2_000} placeholder="Focus on practical, durable knowledge." />
          </label>
          <div className="field-row">
            <label>
              Level
              <select name="difficulty" defaultValue="beginner">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <label>
              Card mix
              <select name="visualMix" defaultValue="balanced">
                <option value="mostly_text">Mostly text</option>
                <option value="balanced">Balanced</option>
                <option value="mostly_visual">Mostly visual</option>
              </select>
            </label>
          </div>
          <label>
            Parent topic
            <select name="parentTopicId" defaultValue="">
              <option value="">None — top level</option>
              {active
                .filter((topic) => !topic.parentTopicId)
                .map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
            </select>
          </label>
          <button className="button button--primary" type="submit">
            <CirclePlus aria-hidden /> Add topic
          </button>
        </form>
        <section className="topic-shelf">
          <div className="section-heading">
            <p className="eyebrow">Shape the stack</p>
            <h2>{active.length ? `${active.length} active topic${active.length === 1 ? "" : "s"}` : "A clear shelf"}</h2>
          </div>
          {!active.length ? (
            <div className="empty-inline">
              <Layers3 aria-hidden />
              <h3>Your first topic starts on the left.</h3>
              <p>Try one thing you would be glad to know a little better.</p>
            </div>
          ) : (
            <div className="topic-list">
              {active.map((topic) => {
                const parent = topicData.topics.find((candidate) => candidate.id === topic.parentTopicId);
                const job = [...topicData.jobs].reverse().find((candidate) => candidate.topicId === topic.id);
                return (
                  <details className="topic-item" key={topic.id}>
                    <summary>
                      <div className="topic-icon">
                        {topic.visualMix === "mostly_visual" ? <Image aria-hidden /> : <Layers3 aria-hidden />}
                      </div>
                      <div>
                        <span>
                          {parent ? `${parent.title} → ` : ""}
                          {topic.title}
                        </span>
                        <small>
                          {topic.difficulty} · {topic.visualMix.replaceAll("_", " ")}
                        </small>
                      </div>
                      {job && <span className={`job-pill job-pill--${job.status}`}>{job.status.replace("_", " ")}</span>}
                      <ChevronDown className="chevron" aria-hidden />
                    </summary>
                    <div className="topic-actions">
                      <div className="generate-row">
                        <span>Generate</span>
                        {([20, 30, 50] as const).map((count) => (
                          <button
                            type="button"
                            className="chip-button"
                            key={count}
                            onClick={() => void generate(topic.id, count)}
                            disabled={job?.status === "queued" || job?.status === "running"}
                          >
                            {count} cards
                          </button>
                        ))}
                      </div>
                      <form
                        className="topic-edit-form"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const values = new FormData(event.currentTarget);
                          const response = await updateTopicFn({
                            data: {
                              id: topic.id,
                              title: String(values.get("title")),
                              context: String(values.get("context")),
                              difficulty: String(values.get("difficulty")) as "beginner" | "intermediate" | "advanced",
                              visualMix: String(values.get("visualMix")) as "mostly_text" | "balanced" | "mostly_visual",
                              parentTopicId: topic.parentTopicId,
                              status: topic.status
                            }
                          });
                          setNotice(response.ok ? "Topic saved." : response.message);
                          if (response.ok) await result.refresh();
                        }}
                      >
                        <label>
                          Name
                          <input name="title" defaultValue={topic.title} maxLength={120} required />
                        </label>
                        <label>
                          Context
                          <textarea name="context" defaultValue={topic.context} maxLength={2_000} />
                        </label>
                        <div className="field-row">
                          <select name="difficulty" defaultValue={topic.difficulty}>
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="advanced">Advanced</option>
                          </select>
                          <select name="visualMix" defaultValue={topic.visualMix}>
                            <option value="mostly_text">Mostly text</option>
                            <option value="balanced">Balanced</option>
                            <option value="mostly_visual">Mostly visual</option>
                          </select>
                        </div>
                        <button className="button button--secondary" type="submit">
                          Save topic
                        </button>
                      </form>
                      <button type="button" className="text-button" onClick={() => void loadCards(topic.id)}>
                        <Pencil aria-hidden /> Edit cards
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={async () => {
                          await archiveTopicFn({ data: { id: topic.id } });
                          await result.refresh();
                        }}
                      >
                        <Archive aria-hidden /> Archive
                      </button>
                      <button
                        type="button"
                        className="text-button text-button--danger"
                        onClick={async () => {
                          if (!window.confirm(`Delete “${topic.title}” and its cards? Review history will also be removed.`)) return;
                          await deleteTopicFn({ data: { id: topic.id } });
                          await result.refresh();
                        }}
                      >
                        <Trash2 aria-hidden /> Delete
                      </button>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </section>
      {selectedTopic && (
        <section className="card-editor">
          <div className="section-heading">
            <p className="eyebrow">Card workshop</p>
            <h2>Edit the details</h2>
          </div>
          {!topicCards.length ? (
            <p>No generated cards here yet.</p>
          ) : (
            topicCards.map((card) => (
              <form
                className="card-editor-row"
                key={card.id}
                onSubmit={async (event) => {
                  event.preventDefault();
                  const values = new FormData(event.currentTarget);
                  await updateCardFn({
                    data: {
                      id: card.id,
                      front: String(values.get("front")),
                      back: String(values.get("back")),
                      hint: String(values.get("hint")),
                      explanation: String(values.get("explanation")),
                      status: String(values.get("status")) as "published" | "archived" | "flagged"
                    }
                  });
                  setNotice("Card saved.");
                }}
              >
                <label>
                  Question
                  <textarea name="front" defaultValue={card.front} required />
                </label>
                <label>
                  Answer
                  <textarea name="back" defaultValue={card.back} required />
                </label>
                <label>
                  Hint
                  <input name="hint" defaultValue={card.hint} />
                </label>
                <label>
                  Explanation
                  <textarea name="explanation" defaultValue={card.explanation} />
                </label>
                <div className="field-row">
                  <select name="status" defaultValue={card.status}>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                    <option value="flagged">Flagged</option>
                  </select>
                  <button type="submit" className="button button--secondary">
                    Save card
                  </button>
                </div>
              </form>
            ))
          )}
        </section>
      )}
    </main>
  );
}
