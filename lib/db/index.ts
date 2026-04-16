import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { getDbPath } from "@/lib/storage";
import * as schema from "@/lib/db/schema";
import { nowIso } from "@/lib/utils";

let client: Database.Database | null = null;
let orm: ReturnType<typeof drizzle<typeof schema>> | null = null;

function bootstrap(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY NOT NULL,
      notebook_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      input TEXT NOT NULL,
      url TEXT,
      status TEXT NOT NULL DEFAULT 'ready',
      metadata TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_assets (
      id TEXT PRIMARY KEY NOT NULL,
      source_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      label TEXT,
      file_path TEXT NOT NULL,
      mime_type TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_segments (
      id TEXT PRIMARY KEY NOT NULL,
      source_id TEXT NOT NULL,
      segment_order INTEGER NOT NULL,
      content TEXT NOT NULL,
      page INTEGER,
      timestamp_start REAL,
      timestamp_end REAL,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY NOT NULL,
      notebook_id TEXT NOT NULL UNIQUE,
      markdown TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_threads (
      id TEXT PRIMARY KEY NOT NULL,
      notebook_id TEXT NOT NULL,
      title TEXT NOT NULL,
      model_key TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      thread_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations TEXT,
      used_web_search INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS segment_embeddings (
      id TEXT PRIMARY KEY NOT NULL,
      segment_id TEXT NOT NULL UNIQUE,
      vector TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY NOT NULL,
      chat_provider TEXT NOT NULL DEFAULT 'heuristic',
      chat_base_url TEXT,
      chat_api_key TEXT,
      chat_model TEXT NOT NULL DEFAULT 'heuristic-chat',
      embedding_provider TEXT NOT NULL DEFAULT 'heuristic',
      embedding_base_url TEXT,
      embedding_api_key TEXT,
      embedding_model TEXT NOT NULL DEFAULT 'heuristic-embed',
      tavily_api_key TEXT,
      export_dir TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS source_segments_fts USING fts5(
      segment_id UNINDEXED,
      source_id UNINDEXED,
      notebook_id UNINDEXED,
      content
    );
  `);

  const hasSettings = db
    .prepare("SELECT id FROM app_settings WHERE id = 1")
    .get() as { id: number } | undefined;

  if (!hasSettings) {
    db.prepare(
      `INSERT INTO app_settings (
        id,
        chat_provider,
        chat_model,
        embedding_provider,
        embedding_model,
        updated_at
      ) VALUES (1, 'heuristic', 'heuristic-chat', 'heuristic', 'heuristic-embed', ?)`,
    ).run(nowIso());
  }
}

export function getSqlite() {
  if (!client) {
    const dbPath = getDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    client = new Database(dbPath);
    bootstrap(client);
  }

  return client;
}

export function getDb() {
  if (!orm) {
    orm = drizzle(getSqlite(), { schema });
  }

  return orm;
}
