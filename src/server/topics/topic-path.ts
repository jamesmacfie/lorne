export type TopicPathNode = { id: string; parentTopicId: string | null; title: string };

export function buildTopicPath(topics: TopicPathNode[], topicId: string): string[] | null {
  const byId = new Map(topics.map((topic) => [topic.id, topic]));
  const topic = byId.get(topicId);
  if (!topic) return null;
  const path: string[] = [];
  let cursor: TopicPathNode | undefined = topic;
  const visited = new Set<string>();
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    path.unshift(cursor.title);
    cursor = cursor.parentTopicId ? byId.get(cursor.parentTopicId) : undefined;
  }
  return path;
}
