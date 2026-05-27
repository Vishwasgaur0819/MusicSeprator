import React, {useEffect, useRef, useState} from 'react';
import {Alert, StyleSheet} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../types/navigation';
import type {SeparationProgress} from '../types/session';
import {ProcessingProgress} from '../components/ProcessingProgress';
import {Screen} from '../components/ui/Screen';
import {
  destroySession,
  getSessionPaths,
} from '../storage/sessionManager';
import {separateStems} from '../ml/separateStems';

type Props = NativeStackScreenProps<RootStackParamList, 'Processing'>;

export function ProcessingScreen({navigation, route}: Props) {
  const {sessionId, fileName} = route.params;
  const cancelRef = useRef({cancelled: false});
  const [progress, setProgress] = useState<SeparationProgress>({
    phase: 'decoding',
    current: 0,
    total: 1,
    message: 'Starting…',
  });

  useEffect(() => {
    const paths = getSessionPaths(sessionId, fileName);

    separateStems(paths, setProgress, cancelRef.current)
      .then(() => {
        if (!cancelRef.current.cancelled) {
          navigation.replace('Mixer', {sessionId, fileName});
        }
      })
      .catch(error => {
        if (cancelRef.current.cancelled) {
          return;
        }
        Alert.alert(
          'Processing failed',
          error instanceof Error ? error.message : 'Unknown error',
          [
            {
              text: 'Go back',
              onPress: () => {
                destroySession(sessionId);
                navigation.popToTop();
              },
            },
          ],
        );
      });

    return () => {
      cancelRef.current.cancelled = true;
    };
  }, [sessionId, fileName, navigation]);

  const handleCancel = () => {
    Alert.alert('Cancel processing?', 'Your uploaded file will be deleted.', [
      {text: 'Keep processing', style: 'cancel'},
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: async () => {
          cancelRef.current.cancelled = true;
          await destroySession(sessionId);
          navigation.popToTop();
        },
      },
    ]);
  };

  return (
    <Screen scroll={false} centered contentStyle={styles.content}>
      <ProcessingProgress progress={progress} onCancel={handleCancel} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
  },
});
