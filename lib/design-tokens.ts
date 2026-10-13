/**
 * Brand palette (hex). app/globals.css mirrors these as space-separated RGB channels
 * so Tailwind opacity modifiers work. Change both together to restyle the platform.
 * Orange is reserved for primary calls to action.
 */
export const brandColors = {
  royal: '#1710B8',
  navy: '#10105C',
  gold: '#FFC400',
  orange: '#FF7900',
  ember: '#C91D0A',
  white: '#FFFFFF',
  cloud: '#F7F8FC',
  ink: '#191A35',
  muted: '#666B85',
  line: '#E5E7F0',
} as const;

export type BrandColor = keyof typeof brandColors;
