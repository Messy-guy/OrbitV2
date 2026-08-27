/**
 * Orbit Mobile Design Tokens
 * Refined Warm Obsidian & Luxe Peach / Apricot Aesthetic
 */

export const OrbitTokens = {
  colors: {
    bg: {
      canvas: '#0B0A0D',         // Warm Obsidian Dark
      canvasSecondary: '#131117',
      surface: 'rgba(23, 20, 28, 0.86)',
      elevated: 'rgba(38, 33, 46, 0.92)',
      glass: 'rgba(255, 255, 255, 0.05)',
      glassElevated: 'rgba(255, 255, 255, 0.09)',
      glassModal: 'rgba(19, 17, 23, 0.98)',
      glassOverlay: 'rgba(0, 0, 0, 0.75)',
    },
    border: {
      hairline: 'rgba(255, 255, 255, 0.07)',
      subtle: 'rgba(255, 255, 255, 0.12)',
      strong: 'rgba(255, 255, 255, 0.22)',
      glassHairline: 'rgba(255, 255, 255, 0.09)',
      glassSpecular: 'rgba(255, 255, 255, 0.18)',
      glassActive: 'rgba(251, 146, 60, 0.4)',
    },
    text: {
      primary: '#FFF7ED',        // Soft Warm White
      secondary: '#D6C7B8',      // Warm Muted Sand
      muted: '#8C827A',          // Muted Taupe
      disabled: '#574F49',
      accent: '#FB923C',         // Vivid Peach / Tangerine
    },
    accent: {
      primary: '#F97316',        // Warm Vibrant Peach / Orange-Coral
      primaryGradient: ['#EA580C', '#FB923C'], // Deep Apricot to Soft Peach
      primaryGlow: 'rgba(249, 115, 22, 0.22)',
      
      secondary: '#FDBA74',      // Soft Peach Cream
      secondaryGlow: 'rgba(253, 186, 116, 0.18)',
      
      success: '#10B981',        // Emerald
      successGlow: 'rgba(16, 185, 129, 0.15)',
      
      warning: '#F59E0B',        // Amber
      warningGlow: 'rgba(245, 158, 11, 0.15)',
      
      danger: '#EF4444',         // Red
      dangerGlow: 'rgba(239, 68, 68, 0.15)',
    },
  },
  border: {
    hairline: 'rgba(255, 255, 255, 0.07)',
    subtle: 'rgba(255, 255, 255, 0.12)',
    strong: 'rgba(255, 255, 255, 0.22)',
    glassHairline: 'rgba(255, 255, 255, 0.09)',
    glassSpecular: 'rgba(255, 255, 255, 0.18)',
    glassActive: 'rgba(251, 146, 60, 0.4)',
  },
  typography: {
    fontFamily: undefined,
    mono: 'monospace',
    weights: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      heavy: '800' as const,
    },
  },
  radii: {
    xs: 14,
    sm: 20,
    md: 28,
    lg: 36,
    pill: 9999,
  },
  shadows: {
    subtle: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 2,
    },
    depth3D: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 18,
      elevation: 6,
    },
    floatingDock: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.45,
      shadowRadius: 22,
      elevation: 10,
    },
    glowIndigo: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 6,
    },
  },
} as const;
