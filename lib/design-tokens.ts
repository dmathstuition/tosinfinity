/**
 * Brand palette (hex). app/globals.css mirrors these as space-separated RGB channels
 * so Tailwind opacity modifiers work. Change both together to restyle the platform.
 * Vivid green ("orange" token, kept for compatibility) is reserved for primary calls to action.
 */
export const brandColors = {
  royal: '#2E7D1E',
  navy: '#16351A',
  gold: '#C5F04A',
  orange: '#5DC22B',
  ember: '#1F6B18',
  flame: '#EA6A00',
  white: '#FFFFFF',
  cloud: '#F2F7E6',
  ink: '#1A2618',
  muted: '#586654',
  line: '#DFE8D0',
} as const;

export type BrandColor = keyof typeof brandColors;
