/**
 * Brand palette (hex). app/globals.css mirrors these as space-separated RGB channels
 * so Tailwind opacity modifiers work. Change both together to restyle the platform.
 * Royal indigo is the primary action colour; gold and orange are accents.
 */
export const brandColors = {
  royal: '#1710B8',
  navy: '#10105C',
  gold: '#FFC400',
  orange: '#FF7900',
  ember: '#C91D0A',
  flame: '#E85D04',
  white: '#FFFFFF',
  cloud: '#F7F7FD',
  ink: '#191A35',
  muted: '#5C617A',
  line: '#E9E8F5',
} as const;

export type BrandColor = keyof typeof brandColors;
