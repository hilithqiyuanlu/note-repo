import { getSqlite } from "@/lib/db";
import { getSegmentEmbeddings, listNotebookSegments } from "@/lib/db/queries";
import { cosineSimilarity, embedText } from "@/lib/embeddings";
import type { SegmentRecord } from "@/lib/types";

type SearchResult = SegmentRecord & {
  lexicalScore: number;
  semanticScore: number;
  score: number;
};

export async function hybridSearch(notebookId: string, query: string, limit = 8) {
  const lexicalMap = new Map<string, number>();
  const sqlite = getSqlite();
  const lexicalRows = sqlite
    .prepare(
      `
      SELECT segment_id AS segmentId, bm25(source_segments_fts) AS rank
      FROM source_segments_fts
      WHERE notebook_id = ? AND source_segments_fts MATCH ?
      ORDER BY rank
      LIMIT 20
    `,
    )
    .all(notebookId, query.replace(/["']/g, " ")) as Array<{ segmentId: string; rank: number }>;

  lexicalRows.forEach((row) => {
    lexicalMap.set(row.segmentId, Math.max(0, 1 / (1 + Math.abs(row.rank))));
  });

  const segments = listNotebookSegments(notebookId);
  const queryVector = await embedText(query);
  const storedEmbeddings = getSegmentEmbeddings(segments.map((segment) => segment.id));
  const semanticMap = new Map(
    storedEmbeddings.map((row) => [row.segmentId, cosineSimilarity(queryVector, row.vector)]),
  );

  const results: SearchResult[] = segments
    .map((segment) => {
      const semanticScore = semanticMap.get(segment.id) ?? 0;
      const lexicalScore = lexicalMap.get(segment.id) ?? 0;
      return {
        ...segment,
        lexicalScore,
        semanticScore,
        score: semanticScore * 0.6 + lexicalScore * 0.4,
      };
    })
    .filter((segment) => segment.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (results.length > 0) {
    return results;
  }

  return segments.slice(0, Math.min(limit, segments.length)).map((segment) => ({
    ...segment,
    lexicalScore: 0,
    semanticScore: 0,
    score: 0,
  }));
}
