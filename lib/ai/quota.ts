import 'server-only';
import { rateLimitUsage } from '@/lib/security/rate-limit';

/** Prompts a learner may send to the study assistant per day (UTC). */
export const DAILY_PROMPTS = 40;
export const DAY_SECONDS = 86400;
export const DAILY_KEY = 'ai-student-day';

/** Prompts the learner has left today. */
export async function promptsLeft(studentId: string): Promise<number> {
  return Math.max(0, DAILY_PROMPTS - (await rateLimitUsage(DAILY_KEY, studentId, DAY_SECONDS)));
}
