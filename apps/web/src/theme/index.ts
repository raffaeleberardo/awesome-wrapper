/** Tema di Git Wrapped (A6): palette, preferenze di movimento e componenti per le card. */
export { THEMES, THEME_NAMES, themeStyle, contrastRatio } from './palette';
export type { ThemePalette } from './palette';
export {
  useReducedMotion,
  REDUCED_MOTION_MIN_DURATION_MS,
  DEFAULT_CARD_DURATION_MS,
} from './motion';
export {
  Accent,
  AnimatedNumber,
  BigNumber,
  CardLayout,
  CardText,
  DisplayTitle,
  Kicker,
  ThemeSurface,
  formatNumber,
} from './components';
export type {
  AnimatedNumberProps,
  BigNumberProps,
  CardLayoutProps,
  DisplayTitleProps,
  ThemeSurfaceProps,
} from './components';
