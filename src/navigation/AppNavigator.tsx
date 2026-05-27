import React from 'react';
import {Platform} from 'react-native';
import {NavigationContainer, DarkTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';
import {HomeScreen} from '../screens/HomeScreen';
import {ProcessingScreen} from '../screens/ProcessingScreen';
import {MixerScreen} from '../screens/MixerScreen';
import {CropScreen} from '../screens/CropScreen';
import {SplashScreen} from '../screens/SplashScreen';
import {appLabels} from '../copy/appLabels';
import {colors} from '../theme/colors';
import {typography} from '../theme/typography';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.backgroundElevated,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

export function AppNavigator() {
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        initialRouteName="Splash"
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.backgroundElevated,
          },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: {
            ...typography.headline,
            fontSize: 17,
          },
          contentStyle: {backgroundColor: colors.background},
          animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
        }}>
        <Stack.Screen
          name="Splash"
          component={SplashScreen}
          options={{headerShown: false, animation: 'fade'}}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{headerShown: false}}
        />
        <Stack.Screen
          name="Crop"
          component={CropScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Processing"
          component={ProcessingScreen}
          options={{
            title: appLabels.navigation.processing,
            headerBackVisible: false,
          }}
        />
        <Stack.Screen
          name="Mixer"
          component={MixerScreen}
          options={{title: appLabels.navigation.mixer}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
