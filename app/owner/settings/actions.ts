'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { type ActionState, fail, ok, ownerContext, str } from '@/lib/owner';
import { DEFAULT_SETTINGS, SETTINGS_TAG } from '@/lib/site';

/**
 * Settings hold configuration and website copy only. Secrets (API keys, the service
 * role, webhook and cron secrets) live in server environment variables and are never
 * stored here or sent to the browser.
 */
async function save(key: string, value: unknown, isPublic: boolean, label: string): Promise<ActionState> {
  const { supabase, audit } = await ownerContext();
  const { error } = await supabase.from('settings').upsert({ key, value, is_public: isPublic }, { onConflict: 'key' });
  if (error) return fail('Could not save the settings.');
  await audit('settings.updated', 'settings', key);
  revalidateTag(SETTINGS_TAG);
  revalidatePath('/', 'layout');
  return ok(`${label} saved.`);
}

const lines = (text: string, max = 30) => text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, max);
const blocks = (text: string, max = 40) => text.replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean)).filter((b) => b.length).slice(0, max);

export async function saveAcademyAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const phones = lines(str(fd, 'phones', 400), 4);
  if (phones.some((p) => !/^\+?[0-9 ()-]{7,20}$/.test(p))) return fail('Phone numbers may contain only digits, spaces and + ( ) -.');
  if (phones.length === 0) return fail('Keep at least one contact phone number.');
  const email = str(fd, 'email', 254);
  if (email && !z.string().email().safeParse(email).success) return fail('Enter a valid email address, or leave it blank.');
  const whatsapp = str(fd, 'whatsapp', 30);
  if (whatsapp && !/^\+?[0-9 ()-]{7,20}$/.test(whatsapp)) return fail('Enter the WhatsApp number using digits only.');
  const name = str(fd, 'name', 80);
  if (name.length < 2) return fail('Enter the academy name.');
  return save('academy', {
    name, tagline: str(fd, 'tagline', 300), mission: str(fd, 'mission', 600), phones, whatsapp, email,
    address: str(fd, 'address', 300), founder_bio: str(fd, 'founder_bio', 3000), qualifications: lines(str(fd, 'qualifications', 2000), 12),
  }, true, 'Academy details');
}

export async function saveLocaleAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const timezone = str(fd, 'timezone', 60);
  const currency = str(fd, 'currency', 3).toUpperCase();
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    new Intl.NumberFormat('en', { style: 'currency', currency });
  } catch {
    return fail('Choose a valid time zone and a three-letter ISO currency code such as NGN, USD or GBP.');
  }
  return save('locale', { timezone, currency }, true, 'Time zone and currency');
}

export async function saveBrandAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  if (fd.get('reset') === 'on') return save('brand', DEFAULT_SETTINGS.brand, true, 'Brand colours reset and');
  const brand = { royal: str(fd, 'royal', 7), navy: str(fd, 'navy', 7), gold: str(fd, 'gold', 7), orange: str(fd, 'orange', 7) };
  if (Object.values(brand).some((c) => !/^#[0-9a-fA-F]{6}$/.test(c))) return fail('Each colour must be a hex value such as #1710B8.');
  return save('brand', brand, true, 'Brand colours');
}

export async function savePricingAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const plans = lines(str(fd, 'plans', 4000), 12).map((l) => {
    const [name = '', price = '', description = ''] = l.split('|').map((x) => x.trim());
    return { name: name.slice(0, 80), price: price.slice(0, 60), description: description.slice(0, 300) };
  });
  if (plans.some((p) => !p.name || !p.price)) return fail('Each line needs a name and a price: Name | Price | Description.');
  return save('pricing', { note: str(fd, 'note', 600), plans }, true, 'Pricing');
}

export async function saveFaqAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const faq = blocks(str(fd, 'faq', 20000)).map(([question = '', ...answer]) => ({ question: question.slice(0, 200), answer: answer.join(' ').slice(0, 1200) }));
  if (faq.some((f) => !f.answer)) return fail('Each question needs an answer on the line(s) below it, with a blank line between questions.');
  return save('faq', faq, true, 'FAQ');
}

export async function saveTestimonialsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const testimonials = blocks(str(fd, 'testimonials', 12000), 12).map(([quote = '', author = '', context = '']) => ({ quote: quote.slice(0, 600), author: author.slice(0, 80), context: context.slice(0, 120) }));
  if (testimonials.some((t) => !t.author)) return fail('Each testimonial needs the quote on the first line and who said it on the second.');
  if (testimonials.length && fd.get('confirm_genuine') !== 'on') return fail('Please confirm these testimonials are genuine and shared with permission.');
  return save('testimonials', testimonials, true, 'Testimonials');
}

export async function savePoliciesAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return save('policies', { privacy: str(fd, 'privacy', 30000), terms: str(fd, 'terms', 30000), refund: str(fd, 'refund', 30000) }, true, 'Policies');
}

export async function saveBillingAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({
    invoice_day: z.coerce.number().int().min(1).max(28),
    due_days: z.coerce.number().int().min(0).max(90),
    reminder_days_before: z.coerce.number().int().min(1).max(30),
  }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return fail('Invoice day must be 1–28, days to pay 0–90 and reminder lead time 1–30.');
  return save('billing', { ...parsed.data, auto_issue: fd.get('auto_issue') === 'on' }, false, 'Billing policy');
}

export async function saveNotificationsAction(_p: ActionState, fd: FormData): Promise<ActionState> {
  return save('notifications', { class_reminders: fd.get('class_reminders') === 'on' }, false, 'Notification preferences');
}
