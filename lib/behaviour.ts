/** Suggested categories for behaviour notes. The Owner may also type their own. */
export const MERIT_CATEGORIES = ['Great effort', 'Excellent work', 'Good participation', 'Big improvement', 'Homework on time', 'Helping others'] as const;
export const CONCERN_CATEGORIES = ['Homework not done', 'Late to class', 'Not focused', 'Unprepared', 'Missed class without notice'] as const;

export type BehaviourNote = { id: string; kind: 'merit' | 'concern'; category: string; note: string | null; points: number; created_at: string };

/** Merit points minus concern points: a simple running balance shown to families. */
export function behaviourBalance(notes: Pick<BehaviourNote, 'kind' | 'points'>[]): { merits: number; concerns: number; balance: number } {
  let merits = 0;
  let concerns = 0;
  for (const n of notes) {
    if (n.kind === 'merit') merits += n.points;
    else concerns += n.points;
  }
  return { merits, concerns, balance: merits - concerns };
}
