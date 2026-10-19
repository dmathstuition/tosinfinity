import type { Config } from 'tailwindcss';

/**
 * Colours are CSS variables (app/globals.css, mirrored in lib/design-tokens.ts) so the
 * whole platform, including dark mode, restyles from one place.
 */
const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        royal: c('royal'),
        navy: c('navy'),
        gold: c('gold'),
        orange: c('orange'),
        ember: c('ember'),
        flame: c('flame'),
        cloud: c('cloud'),
        surface: c('surface'),
        sunken: c('sunken'),
        tile: { sky: c('tile-sky'), lilac: c('tile-lilac'), rose: c('tile-rose'), sun: c('tile-sun'), mint: c('tile-mint'), peach: c('tile-peach') },
        ink: c('ink'),
        muted: c('muted'),
        line: c('line'),
        link: c('link'),
        accent: c('accent-text'),
        ok: c('ok'),
        bad: c('bad'),
      },
      fontFamily: {
        heading: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { display: '-0.035em', tightish: '-0.015em' },
      borderRadius: { card: '1.5rem', panel: '2rem' },
      // One elevation scale, tinted with the brand navy so shadows feel part of the palette.
      boxShadow: {
        xs: '0 1px 2px rgb(var(--shadow) / 0.06)',
        card: '0 1px 2px rgb(var(--shadow) / 0.03), 0 8px 24px -8px rgb(var(--shadow) / 0.07)',
        lift: '0 2px 4px rgb(var(--shadow) / 0.06), 0 12px 24px -6px rgb(var(--shadow) / 0.12), 0 32px 56px -24px rgb(var(--shadow) / 0.22)',
        float: '0 4px 8px rgb(var(--shadow) / 0.08), 0 24px 48px -12px rgb(var(--shadow) / 0.22), 0 56px 96px -32px rgb(var(--shadow) / 0.30)',
        cta: '0 1px 0 rgb(255 255 255 / 0.35) inset, 0 6px 16px -4px rgb(var(--orange) / 0.55)',
        royal: '0 1px 0 rgb(255 255 255 / 0.18) inset, 0 6px 16px -4px rgb(var(--royal) / 0.45)',
        ring: '0 0 0 4px rgb(var(--royal) / 0.14)',
      },
      backgroundImage: {
        'brand-deep': 'linear-gradient(135deg, rgb(var(--navy)) 0%, rgb(var(--navy)) 35%, rgb(var(--royal)) 100%)',
        'brand-cta': 'linear-gradient(180deg, rgb(var(--gold)) 0%, rgb(var(--orange)) 100%)',
        'brand-royal': 'linear-gradient(180deg, rgb(var(--royal)) 0%, rgb(var(--navy)) 140%)',
        grid: 'linear-gradient(rgb(255 255 255 / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.06) 1px, transparent 1px)',
        'grid-ink': 'linear-gradient(rgb(var(--navy) / 0.045) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--navy) / 0.045) 1px, transparent 1px)',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        wave: { '0%, 100%': { transform: 'scaleY(0.45)' }, '50%': { transform: 'scaleY(1)' } },
      },
      animation: {
        rise: 'rise 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        fade: 'fade 0.4s ease-out both',
      },
    },
  },
  plugins: [],
};
export default config;
