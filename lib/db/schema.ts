import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const notebooks = sqliteTable("notebooks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  notebookId: text("notebook_id").notNull(),
  type: text("type", { enum: ["web", "youtube", "pdf"] }).notNull(),
  title: text("title").notNull(),
  input: text("input").notNull(),
  url: text("url"),
  status: text("status").notNull().default("ready"),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const sourceAssets = sqliteTable("source_assets", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  kind: text("kind").notNull(),
  label: text("label"),
  filePath: text("file_path").notNull(),
  mimeType: text("mime_type"),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull(),
});

export const sourceSegments = sqliteTable("source_segments", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").notNull(),
  segmentOrder: integer("segment_order").notNull(),
  content: text("content").notNull(),
  page: integer("page"),
  timestampStart: real("timestamp_start"),
  timestampEnd: real("timestamp_end"),
  metadata: text("metadata"),
});

export const notes = sqliteTable("notes", {
  id: text("id").primaryKey(),
  notebookId: text("notebook_id").notNull(),
  markdown: text("markdown").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});

export const notesNotebookUnique = uniqueIndex("notes_notebook_idx").on(notes.notebookId);

export const chatThreads = sqliteTable("chat_threads", {
  id: text("id").primaryKey(),
  notebookId: text("notebook_id").notNull(),
  title: text("title").notNull(),
  modelKey: text("model_key"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  citations: text("citations"),
  usedWebSearch: integer("used_web_search", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const segmentEmbeddings = sqliteTable("segment_embeddings", {
  id: text("id").primaryKey(),
  segmentId: text("segment_id").notNull(),
  vector: text("vector").notNull(),
});

export const segmentEmbeddingUnique = uniqueIndex("segment_embedding_idx").on(
  segmentEmbeddings.segmentId,
);

export const appSettings = sqliteTable("app_settings", {
  id: integer("id").primaryKey(),
  chatProvider: text("chat_provider").notNull().default("heuristic"),
  chatBaseUrl: text("chat_base_url"),
  chatApiKey: text("chat_api_key"),
  chatModel: text("chat_model").notNull().default("gemini-2.5-pro"),
  embeddingProvider: text("embedding_provider").notNull().default("ollama"),
  embeddingBaseUrl: text("embedding_base_url"),
  embeddingApiKey: text("embedding_api_key"),
  embeddingModel: text("embedding_model").notNull().default("nomic-embed-text"),
  tavilyApiKey: text("tavily_api_key"),
  exportDir: text("export_dir"),
  updatedAt: text("updated_at").notNull(),
});
