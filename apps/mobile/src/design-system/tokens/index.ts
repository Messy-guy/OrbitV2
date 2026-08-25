/**
 * Orbit Mobile Design Tokens
 * Refined Deep Navy & Royal Blue Aesthetic (No Neon, Realistic Physics Depth)
 */

export const OrbitTokens = {
  colors: {
    bg: {
      canvas: '#070B14',         // Midnight Deep Navy
      canvasSecondary: '#0B1120',
      surface: 'rgba(15, 23, 42, 0.82)',
      elevated: 'rgba(30, 41, 59, 0.9)',
      glass: 'rgba(255, 255, 255, 0.05)',
      glassElevated: 'rgba(255, 255, 255, 0.09)',
      glassModal: 'rgba(11, 17, 32, 0.96)',
      glassOverlay: 'rgba(0, 0, 0, 0.72)',
    },
    border: {
      hairline: 'rgba(255, 255, 255, 0.07)',
      subtle: 'rgba(255, 255, 255, 0.12)',
      strong: 'rgba(255, 255, 255, 0.22)',
      glassHairline: 'rgba(255, 255, 255, 0.1)',
      glassSpecular: 'rgba(255, 255, 255, 0.2)',
      glassActive: 'rgba(59, 130, 246, 0.35)',
    },
    text: {
      primary: '#F8FAFC',
      secondary: '#94A3B8',
      muted: '#64748B',
      disabled: '#475569',
      accent: '#60A5FA',
    },
    accent: {
      primary: '#2563EB',        // Refined Royal Blue
      primaryGradient: ['#1D4ED8', '#3B82F6'],
      primaryGlow: 'rgba(37, 99, 235, 0.18)',
      
      secondary: '#60A5FA',      // Soft Slate Blue
      secondaryGlow: 'rgba(96, 165, 250, 0.15)',
      
      success: '#10B981',        // Calibrated Emerald
      successGlow: 'rgba(16, 185, 129, 0.15)',
      
      warning: '#F59E0B',        // Warm Amber
      warningGlow: 'rgba(245, 158, 11, 0.15)',
      
      danger: '#EF4444',         // Balanced Red
      dangerGlow: 'rgba(239, 68, 68, 0.15)',
    },
  },
  border: {
    hairline: 'rgba(255, 255, 255, 0.07)',
    subtle: 'rgba(255, 255, 255, 0.12)',
    strong: 'rgba(255, 255, 255, 0.22)',
    glassHairline: 'rgba(255, 255, 255, 0.1)',
    glassSpecular: 'rgba(255, 255, 255, 0.2)',
    glassActive: 'rgba(59, 130, 246, 0.35)',
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
      shadowColor: '#020617',
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
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 6,
      elevation: 3,
    },
  },
};
