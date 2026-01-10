/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

// Blue and White Theme
const primaryBlue = '#2196F3';
const darkBlue = '#1976D2';
const lightBlue = '#BBDEFB';
const white = '#FFFFFF';
const lightGray = '#F5F5F5';
const darkGray = '#424242';
const textDark = '#212121';
const textLight = '#FFFFFF';

export const Colors = {
  light: {
    text: textDark,
    background: white,
    tint: primaryBlue,
    icon: '#757575',
    tabIconDefault: '#9E9E9E',
    tabIconSelected: primaryBlue,
    primary: primaryBlue,
    secondary: darkBlue,
    accent: lightBlue,
    card: white,
    border: '#E0E0E0',
    notification: primaryBlue,
    surface: lightGray,
  },
  dark: {
    text: textLight,
    background: '#121212',
    tint: primaryBlue,
    icon: '#B0B0B0',
    tabIconDefault: '#757575',
    tabIconSelected: primaryBlue,
    primary: primaryBlue,
    secondary: lightBlue,
    accent: darkBlue,
    card: '#1E1E1E',
    border: '#333333',
    notification: primaryBlue,
    surface: '#1A1A1A',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
