/** Espaçamentos, raios, fontes e sombras do Acolhe. */
export const fonts = {
  base: '"Atkinson Hyperlegible", Arial, sans-serif',
  signature: "cursive",
} as const;

export const radius = {
  sm: "10px",
  md: "12px",
  lg: "16px",
  xl: "18px",
  pill: "999px",
} as const;

export const shadows = {
  card: "0 2px 8px rgba(62, 105, 142, 0.06)",
  floating: "0 15px 40px rgba(60, 144, 155, 0.14)",
  modal: "0 20px 60px rgba(0, 0, 0, 0.2)",
} as const;

export const breakpoints = {
  tablet: 1000,
  mobile: 650,
} as const;
