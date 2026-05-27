import React from 'react';
import {StatusBar} from 'react-native';
import {PaperProvider, MD3DarkTheme} from 'react-native-paper';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AppNavigator} from './src/navigation/AppNavigator';
import {colors} from './src/theme/colors';

const theme = {
  ...MD3DarkTheme,
  roundness: 16,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primary,
    onPrimary: colors.white,
    primaryContainer: colors.primarySoft,
    secondary: colors.accent,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceRaised,
    onSurface: colors.text,
    onSurfaceVariant: colors.textSecondary,
    outline: colors.border,
    error: colors.danger,
  },
};

function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={colors.background}
          translucent={false}
        />
        <AppNavigator />
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default App;
