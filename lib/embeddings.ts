import crypto from "node:crypto";

import OpenAI from "openai";

import { getSettings } from "@/lib/db/queries";
import { normalizeWhitespace } from "@/lib/utils";

const VECTOR_SIZE = 64;

function hashToken(token: string) {
  const hash = crypto.createHash("sha256").update(token).digest();
  return hash[0] % VECTOR_SIZE;
}

export function heuristicEmbedding(text: string) {
  const vector = Array.from({ length: VECTOR_SIZE }, () => 0);
  const tokens = normalizeWhitespace(text.toLowerCase())
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);

  if (tokens.length === 0) {
    return vector;
  }

  tokens.forEach((token) => {
    const index = hashToken(token);
    vector[index] += 1;
  });

  const norm = Math.sqrt(vector.reduce((sum, item) => sum + item * item, 0)) || 1;
  return vector.map((item) => Number((item / norm).toFixed(6)));
}

export async function embedText(text: string) {
  const settings = getSettings();

  if (
    settings.embeddingProvider === "heuristic" ||
    !settings.embeddingBaseUrl ||
    !settings.embeddingModel
  ) {
    return heuristicEmbedding(text);
  }

  const client = new OpenAI({
    baseURL: settings.embeddingBaseUrl,
    apiKey: settings.embeddingApiKey || "ollama",
  });

  try {
    const response = await client.embeddings.create({
      model: settings.embeddingModel,
      input: text,
    });

    return response.data[0]?.embedding ?? heuristicEmbedding(text);
  } catch {
    return heuristicEmbedding(text);
  }
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  if (!normA || !normB) {
    return 0;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
