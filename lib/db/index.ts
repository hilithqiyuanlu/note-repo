import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { getDbPath } from "@/lib/storage";
import * as schema from "@/lib/db/schema";
import { nowIso } from "@/lib/utils";

let client: Database.Database | null = null;
let orm: ReturnType<typeof drizzle<typeof schema>> | null = null;

function hasColumn(db: Database.Database, tableName: string, columnName: string) {
  const rows = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === columnName);
}

function ensureSettingsColumns(db: Database.Database) {
  const columnSql = [
    "ALTER TABLE app_settings ADD COLUMN local_chat_enabled INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE app_settings ADD COLUMN local_chat_base_url TEXT",
    "ALTER TABLE app_settings ADD COLUMN local_chat_model TEXT",
    "ALTER TABLE app_settings ADD COLUMN local_chat_label TEXT",
    "ALTER TABLE app_settings ADD COLUMN proxy_enabled INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE app_settings ADD COLUMN proxy_protocol TEXT NOT NULL DEFAULT 'http'",
    "ALTER TABLE app_settings ADD COLUMN proxy_host TEXT",
    "ALTER TABLE app_settings ADD COLUMN proxy_port INTEGER",
    "ALTER TABLE app_settings ADD COLUMN proxy_bypass_hosts TEXT",
  ] as const;

  for (const sql of columnSql) {
    const match = sql.match(/ADD COLUMN ([a-z_]+)/i);
    const columnName = match?.[1];
    if (!columnName) {
      continue;
    }

    if (!hasColumn(db, "app_settings", columnName)) {
      db.prepare(sql).run();
    }
  }
}

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
      chat_model TEXT NOT NULL DEFAULT 'gemini-2.5-pro',
      local_chat_enabled INTEGER NOT NULL DEFAULT 0,
      local_chat_base_url TEXT,
      local_chat_model TEXT,
      local_chat_label TEXT,
      embedding_provider TEXT NOT NULL DEFAULT 'ollama',
      embedding_base_url TEXT,
      embedding_api_key TEXT,
      embedding_model TEXT NOT NULL DEFAULT 'nomic-embed-text',
      proxy_enabled INTEGER NOT NULL DEFAULT 0,
      proxy_protocol TEXT NOT NULL DEFAULT 'http',
      proxy_host TEXT,
      proxy_port INTEGER,
      proxy_bypass_hosts TEXT,
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

  ensureSettingsColumns(db);

  const hasSettings = db
    .prepare("SELECT id FROM app_settings WHERE id = 1")
    .get() as { id: number } | undefined;

  if (!hasSettings) {
    db.prepare(
      `INSERT INTO app_settings (
        id,
        chat_provider,
        chat_model,
        local_chat_enabled,
        local_chat_base_url,
        local_chat_model,
        local_chat_label,
        embedding_provider,
        embedding_model,
        proxy_enabled,
        proxy_protocol,
        proxy_host,
        proxy_port,
        proxy_bypass_hosts,
        updated_at
      ) VALUES (
        1,
        'heuristic',
        'gemini-2.5-pro',
        1,
        'http://127.0.0.1:11434/v1',
        'qwen3.5:4b',
        'Ollama / qwen3.5:4b',
        'ollama',
        'nomic-embed-text',
        1,
        'http',
        '127.0.0.1',
        7897,
        'localhost,127.0.0.1,::1',
        ?
      )`,
    ).run(nowIso());
  } else {
    db.prepare(
      `UPDATE app_settings
       SET chat_model = 'gemini-2.5-pro', updated_at = ?
       WHERE id = 1 AND (chat_model IS NULL OR chat_model = '' OR chat_model = 'heuristic-chat')`,
    ).run(nowIso());
    db.prepare(
      `UPDATE app_settings
       SET embedding_provider = 'ollama',
           embedding_model = 'nomic-embed-text',
           updated_at = ?
       WHERE id = 1 AND (
         embedding_provider IS NULL OR embedding_provider = '' OR embedding_provider = 'heuristic'
       ) AND (
         embedding_model IS NULL OR embedding_model = '' OR embedding_model = 'heuristic-embed'
       )`,
    ).run(nowIso());
    db.prepare(
      `UPDATE app_settings
       SET local_chat_enabled = CASE
             WHEN local_chat_enabled = 0
               AND (local_chat_base_url IS NULL OR local_chat_base_url = '')
               AND (local_chat_model IS NULL OR local_chat_model = '')
             THEN 1
             ELSE COALESCE(local_chat_enabled, 1)
           END,
           local_chat_base_url = COALESCE(NULLIF(local_chat_base_url, ''), 'http://127.0.0.1:11434/v1'),
           local_chat_model = COALESCE(NULLIF(local_chat_model, ''), 'qwen3.5:4b'),
           local_chat_label = COALESCE(NULLIF(local_chat_label, ''), 'Ollama / qwen3.5:4b'),
           proxy_enabled = CASE
             WHEN proxy_enabled = 0
               AND (proxy_host IS NULL OR proxy_host = '')
               AND proxy_port IS NULL
             THEN 1
             ELSE COALESCE(proxy_enabled, 1)
           END,
           proxy_protocol = COALESCE(NULLIF(proxy_protocol, ''), 'http'),
           proxy_host = COALESCE(NULLIF(proxy_host, ''), '127.0.0.1'),
           proxy_port = COALESCE(proxy_port, 7897),
           proxy_bypass_hosts = COALESCE(NULLIF(proxy_bypass_hosts, ''), 'localhost,127.0.0.1,::1'),
           updated_at = ?
       WHERE id = 1`,
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
