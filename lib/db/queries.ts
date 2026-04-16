import { asc, desc, eq, inArray } from "drizzle-orm";

import { getDb, getSqlite } from "@/lib/db";
import {
  appSettings,
  chatMessages,
  chatThreads,
  notes,
  notebooks,
  segmentEmbeddings,
  sourceAssets,
  sourceSegments,
  sources,
} from "@/lib/db/schema";
import type { AppSettingsRecord, Citation, NotebookSnapshot, SegmentRecord } from "@/lib/types";
import { createId, nowIso, safeJsonParse } from "@/lib/utils";

export function deleteSource(sourceId: string) {
  const db = getDb();
  const sqlite = getSqlite();
  const source = db.select().from(sources).where(eq(sources.id, sourceId)).get();

  if (!source) {
    return null;
  }

  const segmentIds = db
    .select({ id: sourceSegments.id })
    .from(sourceSegments)
    .where(eq(sourceSegments.sourceId, sourceId))
    .all()
    .map((item) => item.id);

  if (segmentIds.length > 0) {
    db.delete(segmentEmbeddings).where(inArray(segmentEmbeddings.segmentId, segmentIds)).run();
  }

  sqlite.prepare("DELETE FROM source_segments_fts WHERE source_id = ?").run(sourceId);
  db.delete(sourceAssets).where(eq(sourceAssets.sourceId, sourceId)).run();
  db.delete(sourceSegments).where(eq(sourceSegments.sourceId, sourceId)).run();
  db.delete(sources).where(eq(sources.id, sourceId)).run();
  updateNotebookTimestamp(source.notebookId);

  return source;
}

export function listNotebooks() {
  const db = getDb();

  return db.select().from(notebooks).orderBy(desc(notebooks.updatedAt)).all();
}

export function createNotebook(input: { title: string; description?: string }) {
  const db = getDb();
  const id = createId("nb");
  const timestamp = nowIso();

  db.insert(notebooks).values({
    id,
    title: input.title,
    description: input.description ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  db.insert(notes).values({
    id: createId("note"),
    notebookId: id,
    markdown: `# ${input.title}\n\n- 核心观点\n- 待补充资料\n- 后续问题\n`,
    updatedAt: timestamp,
  }).run();

  return getNotebookSnapshot(id);
}

export function deleteNotebook(notebookId: string) {
  const db = getDb();
  const sqlite = getSqlite();
  sqlite.prepare("DELETE FROM source_segments_fts WHERE notebook_id = ?").run(notebookId);

  const sourceRows = db
    .select({ id: sources.id })
    .from(sources)
    .where(eq(sources.notebookId, notebookId))
    .all();
  const sourceIds = sourceRows.map((item) => item.id);
  const threadIds = db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(eq(chatThreads.notebookId, notebookId))
    .all()
    .map((item) => item.id);

  if (threadIds.length > 0) {
    db.delete(chatMessages).where(inArray(chatMessages.threadId, threadIds)).run();
  }

  db.delete(chatThreads).where(eq(chatThreads.notebookId, notebookId)).run();
  db.delete(notes).where(eq(notes.notebookId, notebookId)).run();

  if (sourceIds.length > 0) {
    const segmentIds = db
      .select({ id: sourceSegments.id })
      .from(sourceSegments)
      .where(inArray(sourceSegments.sourceId, sourceIds))
      .all()
      .map((item) => item.id);

    if (segmentIds.length > 0) {
      db.delete(segmentEmbeddings).where(inArray(segmentEmbeddings.segmentId, segmentIds)).run();
    }

    db.delete(sourceAssets).where(inArray(sourceAssets.sourceId, sourceIds)).run();
    db.delete(sourceSegments).where(inArray(sourceSegments.sourceId, sourceIds)).run();
    db.delete(sources).where(eq(sources.notebookId, notebookId)).run();
  }

  db.delete(notebooks).where(eq(notebooks.id, notebookId)).run();
}

export function updateNotebook(
  notebookId: string,
  input: { title?: string; description?: string | null },
) {
  const current = getDb().select().from(notebooks).where(eq(notebooks.id, notebookId)).get();

  if (!current) {
    return null;
  }

  const updatedAt = nowIso();
  getDb()
    .update(notebooks)
    .set({
      title: input.title?.trim() || current.title,
      description: input.description === undefined ? current.description : input.description,
      updatedAt,
    })
    .where(eq(notebooks.id, notebookId))
    .run();

  return getNotebookSnapshot(notebookId);
}

export function getNotebookSnapshot(notebookId: string): NotebookSnapshot | null {
  const db = getDb();
  const notebook = db.select().from(notebooks).where(eq(notebooks.id, notebookId)).get();

  if (!notebook) {
    return null;
  }

  const note = db.select().from(notes).where(eq(notes.notebookId, notebookId)).get() ?? null;

  const sourceRows = db
    .select()
    .from(sources)
    .where(eq(sources.notebookId, notebookId))
    .orderBy(asc(sources.createdAt))
    .all();

  return {
    notebook,
    note,
    sources: sourceRows.map((item) => ({
      ...item,
      metadata: safeJsonParse<Record<string, unknown>>(item.metadata, {}),
    })),
  };
}

export function updateNotebookTimestamp(notebookId: string) {
  getDb()
    .update(notebooks)
    .set({ updatedAt: nowIso() })
    .where(eq(notebooks.id, notebookId))
    .run();
}

export function upsertNote(notebookId: string, markdown: string) {
  const db = getDb();
  const existing = db.select().from(notes).where(eq(notes.notebookId, notebookId)).get();
  const updatedAt = nowIso();

  if (existing) {
    db.update(notes).set({ markdown, updatedAt }).where(eq(notes.notebookId, notebookId)).run();
  } else {
    db.insert(notes).values({
      id: createId("note"),
      notebookId,
      markdown,
      updatedAt,
    }).run();
  }

  updateNotebookTimestamp(notebookId);
}

export function getSettings(): AppSettingsRecord {
  const row = getDb().select().from(appSettings).where(eq(appSettings.id, 1)).get();

  if (!row) {
    throw new Error("settings missing");
  }

  return {
    chatProvider: row.chatProvider,
    chatBaseUrl: row.chatBaseUrl,
    chatApiKey: row.chatApiKey,
    chatModel: row.chatModel,
    embeddingProvider: row.embeddingProvider,
    embeddingBaseUrl: row.embeddingBaseUrl,
    embeddingApiKey: row.embeddingApiKey,
    embeddingModel: row.embeddingModel,
    tavilyApiKey: row.tavilyApiKey,
    exportDir: row.exportDir,
    updatedAt: row.updatedAt,
  };
}

export function updateSettings(input: Partial<AppSettingsRecord>) {
  getDb()
    .update(appSettings)
    .set({
      chatProvider: input.chatProvider,
      chatBaseUrl: input.chatBaseUrl,
      chatApiKey: input.chatApiKey,
      chatModel: input.chatModel,
      embeddingProvider: input.embeddingProvider,
      embeddingBaseUrl: input.embeddingBaseUrl,
      embeddingApiKey: input.embeddingApiKey,
      embeddingModel: input.embeddingModel,
      tavilyApiKey: input.tavilyApiKey,
      exportDir: input.exportDir,
      updatedAt: nowIso(),
    })
    .where(eq(appSettings.id, 1))
    .run();

  return getSettings();
}

export function insertSource(params: {
  notebookId: string;
  type: "web" | "youtube" | "pdf";
  title: string;
  input: string;
  url?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
}) {
  const id = createId("src");
  const timestamp = nowIso();
  getDb().insert(sources).values({
    id,
    notebookId: params.notebookId,
    type: params.type,
    title: params.title,
    input: params.input,
    url: params.url ?? null,
    status: params.status ?? "ready",
    metadata: JSON.stringify(params.metadata ?? {}),
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();
  updateNotebookTimestamp(params.notebookId);
  return id;
}

export function updateSource(sourceId: string, updates: Partial<{
  title: string;
  status: string;
  metadata: Record<string, unknown>;
  input: string;
  url: string | null;
}>) {
  const current = getDb().select().from(sources).where(eq(sources.id, sourceId)).get();

  if (!current) {
    throw new Error("source not found");
  }

  getDb()
    .update(sources)
    .set({
      title: updates.title ?? current.title,
      status: updates.status ?? current.status,
      metadata: updates.metadata ? JSON.stringify(updates.metadata) : current.metadata,
      input: updates.input ?? current.input,
      url: updates.url === undefined ? current.url : updates.url,
      updatedAt: nowIso(),
    })
    .where(eq(sources.id, sourceId))
    .run();

  updateNotebookTimestamp(current.notebookId);
}

export function replaceSourceContent(
  sourceId: string,
  notebookId: string,
  segments: Array<{
    id?: string;
    content: string;
    page?: number | null;
    timestampStart?: number | null;
    timestampEnd?: number | null;
    metadata?: Record<string, unknown>;
  }>,
  embeddings: Array<{ segmentId: string; vector: number[] }>,
  assets?: Array<{
    kind: string;
    label?: string;
    filePath: string;
    mimeType?: string | null;
    metadata?: Record<string, unknown>;
  }>,
) {
  const db = getDb();
  const sqlite = getSqlite();

  const currentSegments = db
    .select({ id: sourceSegments.id })
    .from(sourceSegments)
    .where(eq(sourceSegments.sourceId, sourceId))
    .all()
    .map((item) => item.id);

  if (currentSegments.length > 0) {
    db.delete(segmentEmbeddings).where(inArray(segmentEmbeddings.segmentId, currentSegments)).run();
  }

  db.delete(sourceSegments).where(eq(sourceSegments.sourceId, sourceId)).run();
  db.delete(sourceAssets).where(eq(sourceAssets.sourceId, sourceId)).run();
  sqlite.prepare("DELETE FROM source_segments_fts WHERE source_id = ?").run(sourceId);

  segments.forEach((segment, index) => {
    const segmentId = segment.id ?? createId("seg");
    db.insert(sourceSegments).values({
      id: segmentId,
      sourceId,
      segmentOrder: index,
      content: segment.content,
      page: segment.page ?? null,
      timestampStart: segment.timestampStart ?? null,
      timestampEnd: segment.timestampEnd ?? null,
      metadata: JSON.stringify(segment.metadata ?? {}),
    }).run();

    sqlite
      .prepare(
        "INSERT INTO source_segments_fts (segment_id, source_id, notebook_id, content) VALUES (?, ?, ?, ?)",
      )
      .run(segmentId, sourceId, notebookId, segment.content);

    const vector = embeddings.find((item) => item.segmentId === segmentId)?.vector ?? [];
    db.insert(segmentEmbeddings).values({
      id: createId("emb"),
      segmentId,
      vector: JSON.stringify(vector),
    }).run();
  });

  (assets ?? []).forEach((asset) => {
    db.insert(sourceAssets).values({
      id: createId("asset"),
      sourceId,
      kind: asset.kind,
      label: asset.label ?? null,
      filePath: asset.filePath,
      mimeType: asset.mimeType ?? null,
      metadata: JSON.stringify(asset.metadata ?? {}),
      createdAt: nowIso(),
    }).run();
  });

  updateNotebookTimestamp(notebookId);
}

export function getSourceDetail(sourceId: string) {
  const db = getDb();
  const source = db.select().from(sources).where(eq(sources.id, sourceId)).get();

  if (!source) {
    return null;
  }

  const segments = db
    .select()
    .from(sourceSegments)
    .where(eq(sourceSegments.sourceId, sourceId))
    .orderBy(asc(sourceSegments.segmentOrder))
    .all();

  const assets = db
    .select()
    .from(sourceAssets)
    .where(eq(sourceAssets.sourceId, sourceId))
    .orderBy(asc(sourceAssets.createdAt))
    .all();

  return {
    ...source,
    metadata: safeJsonParse<Record<string, unknown>>(source.metadata, {}),
    segments: segments.map((segment) => ({
      ...segment,
      metadata: safeJsonParse<Record<string, unknown>>(segment.metadata, {}),
    })),
    assets: assets.map((asset) => ({
      ...asset,
      metadata: safeJsonParse<Record<string, unknown>>(asset.metadata, {}),
    })),
  };
}

export function listNotebookSegments(notebookId: string): SegmentRecord[] {
  const sqlite = getSqlite();
  const rows = sqlite
    .prepare(
      `
      SELECT
        seg.id,
        seg.source_id AS sourceId,
        src.notebook_id AS notebookId,
        src.title AS sourceTitle,
        src.type AS sourceType,
        seg.content,
        seg.segment_order AS segmentOrder,
        seg.page,
        seg.timestamp_start AS timestampStart,
        seg.timestamp_end AS timestampEnd
      FROM source_segments seg
      INNER JOIN sources src ON src.id = seg.source_id
      WHERE src.notebook_id = ?
      ORDER BY src.created_at ASC, seg.segment_order ASC
    `,
    )
    .all(notebookId) as Array<{
      id: string;
      sourceId: string;
      notebookId: string;
      sourceTitle: string;
      sourceType: "web" | "youtube" | "pdf";
      content: string;
      segmentOrder: number;
      page: number | null;
      timestampStart: number | null;
      timestampEnd: number | null;
    }>;

  return rows.map((row) => ({
    id: row.id,
    sourceId: row.sourceId,
    notebookId: row.notebookId,
    sourceTitle: row.sourceTitle,
    sourceType: row.sourceType,
    content: row.content,
    order: row.segmentOrder,
    page: row.page,
    timestampStart: row.timestampStart,
    timestampEnd: row.timestampEnd,
  }));
}

export function getSegmentEmbeddings(segmentIds: string[]) {
  if (segmentIds.length === 0) {
    return [];
  }

  return getDb()
    .select()
    .from(segmentEmbeddings)
    .where(inArray(segmentEmbeddings.segmentId, segmentIds))
    .all()
    .map((row) => ({
      segmentId: row.segmentId,
      vector: safeJsonParse<number[]>(row.vector, []),
    }));
}

export function createThread(notebookId: string, title: string, modelKey?: string | null) {
  const id = createId("thread");
  const timestamp = nowIso();

  getDb().insert(chatThreads).values({
    id,
    notebookId,
    title,
    modelKey: modelKey ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }).run();

  return id;
}

export function listThreads(notebookId: string) {
  const db = getDb();
  const threads = db
    .select()
    .from(chatThreads)
    .where(eq(chatThreads.notebookId, notebookId))
    .orderBy(desc(chatThreads.updatedAt))
    .all();

  return threads.map((thread) => ({
    ...thread,
    messages: db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.threadId, thread.id))
      .orderBy(asc(chatMessages.createdAt))
      .all()
      .map((message) => ({
      ...message,
      citations: safeJsonParse<Citation[]>(message.citations, []),
    })),
  }));
}

export function appendMessage(params: {
  threadId: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  usedWebSearch?: boolean;
}) {
  const db = getDb();
  const id = createId("msg");
  const timestamp = nowIso();

  db.insert(chatMessages).values({
    id,
    threadId: params.threadId,
    role: params.role,
    content: params.content,
    citations: JSON.stringify(params.citations ?? []),
    usedWebSearch: params.usedWebSearch ?? false,
    createdAt: timestamp,
  }).run();

  db.update(chatThreads).set({ updatedAt: timestamp }).where(eq(chatThreads.id, params.threadId)).run();

  return id;
}

export function updateThreadTitle(threadId: string, title: string) {
  getDb().update(chatThreads).set({ title, updatedAt: nowIso() }).where(eq(chatThreads.id, threadId)).run();
}
