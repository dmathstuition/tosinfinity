import { describe, expect, it } from 'vitest';
import { cleanDraftQuestions } from '@/lib/ai/questions';
import { memoryRateLimit, memoryUsage } from '@/lib/security/window';

describe('AI-drafted quiz questions', () => {
  const good = { prompt: 'What is 3/4 of 12?', options: ['6', '8', '9', '12'], correct: 2, topic: 'Fractions' };

  it('keeps well-formed questions from either shape of reply', () => {
    expect(cleanDraftQuestions({ questions: [good] })).toEqual([{ prompt: good.prompt, options: good.options, correct: 2, topic: 'Fractions' }]);
    expect(cleanDraftQuestions([{ question: 'Solve x + 2 = 5', options: [1, 2, 3], correct_index: 2 }])).toEqual([{ prompt: 'Solve x + 2 = 5', options: ['1', '2', '3'], correct: 2, topic: null }]);
  });

  it('drops questions with a bad answer index, duplicate or too few options, or no prompt', () => {
    expect(cleanDraftQuestions([
      { ...good, correct: 4 },
      { ...good, correct: -1 },
      { ...good, correct: 1.5 },
      { ...good, options: ['6', '6', '8'] },
      { ...good, options: ['6'] },
      { ...good, options: ['1', '2', '3', '4', '5', '6', '7'] },
      { ...good, prompt: '  ' },
      'not an object',
      null,
    ])).toEqual([]);
    expect(cleanDraftQuestions('nonsense')).toEqual([]);
  });

  it('caps the count and the text length', () => {
    expect(cleanDraftQuestions(Array.from({ length: 30 }, () => good), 5)).toHaveLength(5);
    expect(cleanDraftQuestions([{ ...good, prompt: 'x'.repeat(5000) }])[0]!.prompt).toHaveLength(1000);
  });
});

describe('prompt allowance counter', () => {
  it('reports uses in the current window without counting a use', () => {
    const now = Date.UTC(2026, 9, 19, 10);
    expect(memoryUsage('k-usage', 86400, now)).toBe(0);
    memoryRateLimit('k-usage', 40, 86400, now);
    memoryRateLimit('k-usage', 40, 86400, now);
    expect(memoryUsage('k-usage', 86400, now)).toBe(2);
    expect(memoryUsage('k-usage', 86400, now)).toBe(2);
    expect(memoryUsage('k-usage', 86400, now + 86400 * 1000)).toBe(0); // next day
  });
});
