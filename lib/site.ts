import 'server-only';
import { unstable_cache } from 'next/cache';
import { brandColors } from '@/lib/design-tokens';
import { createPublicClient } from '@/lib/supabase/server';

export type Academy = {
  name: string;
  tagline: string;
  mission: string;
  phones: string[];
  whatsapp: string;
  email: string;
  address: string;
  founder_bio: string;
  qualifications: string[];
};

export type PricingPlan = { name: string; price: string; description: string };
export type Testimonial = { quote: string; author: string; context: string };
export type FaqItem = { question: string; answer: string };

export type SiteSettings = {
  academy: Academy;
  locale: { timezone: string; currency: string };
  pricing: { note: string; plans: PricingPlan[] };
  testimonials: Testimonial[];
  faq: FaqItem[];
  /** Markdown. Empty string means "use the built-in baseline text". */
  policies: { privacy: string; terms: string; refund: string };
  /** Hex colours. Defaults come from lib/design-tokens.ts. */
  brand: { royal: string; navy: string; gold: string; orange: string };
};

/** Built-in defaults. Contact numbers are from the academy flyer; nothing else is assumed. */
export const DEFAULT_SETTINGS: SiteSettings = {
  academy: {
    name: 'Tosinfinity Academy',
    tagline:
      "Personalised learning that builds confidence, inspires excellence, and unlocks every learner's potential.",
    mission:
      'To inspire learners worldwide to develop confidence, curiosity and competence in Mathematics, Science and Technology through innovative, technology-driven and purpose-centred education.',
    phones: ['07015879377', '09031521922'],
    whatsapp: '',
    email: '',
    address: '',
    founder_bio: '',
    qualifications: [],
  },
  locale: { timezone: 'Africa/Lagos', currency: 'NGN' },
  pricing: { note: '', plans: [] },
  testimonials: [],
  faq: [],
  policies: { privacy: '', terms: '', refund: '' },
  brand: { royal: brandColors.royal, navy: brandColors.navy, gold: brandColors.gold, orange: brandColors.orange },
};

export const SETTINGS_TAG = 'site-settings';

export const getSiteSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    const supabase = createPublicClient();
    if (!supabase) return DEFAULT_SETTINGS;
    const { data, error } = await supabase.from('settings').select('key, value').eq('is_public', true);
    if (error || !data) return DEFAULT_SETTINGS;
    const map = new Map(data.map((r) => [r.key as string, r.value as unknown]));
    const pick = <K extends keyof SiteSettings>(k: K): SiteSettings[K] => {
      const v = map.get(k);
      const d = DEFAULT_SETTINGS[k];
      if (v == null) return d;
      return (Array.isArray(d) ? v : { ...(d as object), ...(v as object) }) as SiteSettings[K];
    };
    return {
      academy: pick('academy'),
      locale: pick('locale'),
      pricing: pick('pricing'),
      testimonials: pick('testimonials'),
      faq: pick('faq'),
      policies: pick('policies'),
      brand: pick('brand'),
    };
  },
  ['site-settings'],
  { tags: [SETTINGS_TAG], revalidate: 300 },
);

/** Nigerian local numbers (0XXXXXXXXXX) to international form for tel:/wa.me links. */
export function toInternational(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('234')) return digits;
  if (digits.startsWith('0') && digits.length === 11) return '234' + digits.slice(1);
  return digits;
}

export function whatsappLink(academy: Academy, text?: string): string {
  const number = toInternational(academy.whatsapp || academy.phones[0] || '');
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${number}${q}`;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** CSS that applies Owner-chosen brand colours over the built-in tokens. Only valid hex values are emitted. */
export function brandCss(brand: SiteSettings['brand']): string {
  const vars = (Object.keys(DEFAULT_SETTINGS.brand) as Array<keyof SiteSettings['brand']>)
    .filter((k) => HEX.test(brand[k] ?? '') && brand[k].toLowerCase() !== DEFAULT_SETTINGS.brand[k].toLowerCase())
    .map((k) => {
      const n = parseInt(brand[k].slice(1), 16);
      return `--${k}:${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
    });
  return vars.length ? `:root,[data-theme='light'],[data-theme='dark']{${vars.join(';')}}` : '';
}
