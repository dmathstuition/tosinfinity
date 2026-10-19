import 'server-only';
import { optionalEnv } from '@/lib/env';

/**
 * Thin AI abstraction. Speaks the OpenAI-compatible Chat Completions format, which
 * most providers (and gateways) expose; set AI_BASE_URL, AI_API_KEY and AI_MODEL.
 * Keys never leave the server. With no key configured the rest of the app works
 * normally and AI features show a "not available" notice.
 */
export function aiConfigured(): boolean {
  return Boolean(optionalEnv('AI_API_KEY') && optionalEnv('AI_MODEL'));
}

export class AiError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

/**
 * One reply from the model. `history` holds earlier turns of the same conversation
 * (already validated and length-capped by the caller).
 */
export async function aiChat({ system, user, history = [], maxTokens = 700 }: { system: string; user: string; history?: ChatTurn[]; maxTokens?: number }): Promise<string> {
  if (!aiConfigured()) throw new AiError('The AI assistant is not configured.', 503);
  const base = (optionalEnv('AI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${optionalEnv('AI_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: optionalEnv('AI_MODEL'),
        max_tokens: Math.min(maxTokens, 1500),
        messages: [
          { role: 'system', content: system },
          ...history.map((t) => ({ role: t.role, content: t.content })),
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new AiError(`AI provider responded ${res.status}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new AiError('The AI provider returned an empty reply.');
    return text;
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError('The AI assistant could not be reached.');
  } finally {
    clearTimeout(timer);
  }
}

/** Pull the first JSON object or array out of a model reply. Returns null if none parses. */
export function extractJson<T = unknown>(text: string): T | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)?.[1];
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  const bare = start >= 0 && end > start ? text.slice(start, end + 1) : undefined;
  for (const candidate of [fenced, bare]) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** Safe message for the browser: never leaks provider details. */
export function aiErrorResponse(e: unknown): { message: string; status: number } {
  if (e instanceof AiError && e.status === 503) return { message: 'The AI assistant is not available at the moment.', status: 503 };
  console.error('[ai]', e instanceof Error ? e.message : 'unknown error');
  return { message: 'The AI assistant could not answer just now. Please try again.', status: 502 };
}

/** Wraps untrusted text so the model treats it as data, not instructions. */
export function untrusted(label: string, text: string, max = 4000): string {
  return `<${label}>\n${text.slice(0, max).replace(/<\/?[a-z_]+>/gi, '')}\n</${label}>`;
}
