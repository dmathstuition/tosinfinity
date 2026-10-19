/** A multiple-choice question drafted by the AI, after validation. */
export type DraftQuestion = { prompt: string; options: string[]; correct: number; topic: string | null };

/**
 * Turns whatever the model (or a browser) sent into clean questions, or drops them:
 * 2 to 6 distinct non-empty options, a correct index inside the list, sensible lengths.
 * Used both when drafting and again when saving, so nothing unchecked reaches the database.
 */
export function cleanDraftQuestions(raw: unknown, max = 20): DraftQuestion[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' && Array.isArray((raw as { questions?: unknown }).questions) ? (raw as { questions: unknown[] }).questions : [];
  const out: DraftQuestion[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const q = item as Record<string, unknown>;
    const prompt = typeof q.prompt === 'string' ? q.prompt.trim().slice(0, 1000) : typeof q.question === 'string' ? q.question.trim().slice(0, 1000) : '';
    const options = Array.isArray(q.options) ? q.options.filter((o): o is string | number => typeof o === 'string' || typeof o === 'number').map((o) => String(o).trim().slice(0, 200)).filter(Boolean) : [];
    const correct = Number(q.correct ?? q.correct_index ?? q.answer_index);
    const topic = typeof q.topic === 'string' && q.topic.trim() ? q.topic.trim().slice(0, 80) : null;
    if (prompt.length < 3 || options.length < 2 || options.length > 6) continue;
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) continue;
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) continue;
    out.push({ prompt, options, correct, topic });
    if (out.length >= max) break;
  }
  return out;
}
