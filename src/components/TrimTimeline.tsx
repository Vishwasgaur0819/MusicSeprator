import React, {useCallback, useMemo, useRef, useState} from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {formatTime, MIN_CROP_SEC} from '../audio/cropAudio';
import {colors} from '../theme/colors';
import {radii, shadows, spacing} from '../theme/layout';
import {typography} from '../theme/typography';

interface TrimTimelineProps {
  durationSec: number;
  startSec: number;
  endSec: number;
  playheadSec: number;
  peaks: number[];
  isPlaying: boolean;
  ready: boolean;
  onInChange: (sec: number) => void;
  onOutChange: (sec: number) => void;
  onPlayheadChange: (sec: number) => void;
  onTogglePlay: () => void;
  onRestart: () => void;
}

const HANDLE_WIDTH = 36;
const PLAYHEAD_WIDTH = 24;
const TRACK_HEIGHT = 132;

export function TrimTimeline({
  durationSec,
  startSec,
  endSec,
  playheadSec,
  peaks,
  isPlaying,
  ready,
  onInChange,
  onOutChange,
  onPlayheadChange,
  onTogglePlay,
  onRestart,
}: TrimTimelineProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [activeHandle, setActiveHandle] = useState<
    'in' | 'out' | 'playhead' | null
  >(null);

  const durationRef = useRef(durationSec);
  const startRef = useRef(startSec);
  const endRef = useRef(endSec);
  const trackWidthRef = useRef(trackWidth);
  const dragOriginSecRef = useRef(0);
  const playheadRef = useRef(playheadSec);

  durationRef.current = durationSec;
  startRef.current = startSec;
  endRef.current = endSec;
  trackWidthRef.current = trackWidth;
  playheadRef.current = playheadSec;

  const trimDisabled = durationSec < MIN_CROP_SEC;
  const maxPeak = Math.max(...peaks, 0.001);
  const startRatio = durationSec > 0 ? startSec / durationSec : 0;
  const endRatio = durationSec > 0 ? endSec / durationSec : 1;
  const playheadRatio = durationSec > 0 ? playheadSec / durationSec : 0;
  const startX = startRatio * trackWidth;
  const endX = endRatio * trackWidth;
  const playheadX = playheadRatio * trackWidth;
  const selectedSec = Math.max(0, endSec - startSec);
  const selectionProgress =
    selectedSec > 0
      ? Math.max(
          0,
          Math.min(1, (playheadSec - startSec) / selectedSec),
        )
      : 0;

  const secFromDx = useCallback((dx: number) => {
    const width = trackWidthRef.current;
    const duration = durationRef.current;
    if (width <= 0 || duration <= 0) {
      return 0;
    }
    return (dx / width) * duration;
  }, []);

  const createDragResponder = useCallback(
    (handle: 'in' | 'out' | 'playhead') =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => ready && !trimDisabled,
        onMoveShouldSetPanResponder: () => ready && !trimDisabled,
        onPanResponderGrant: () => {
          setActiveHandle(handle);
          if (handle === 'in') {
            dragOriginSecRef.current = startRef.current;
          } else if (handle === 'out') {
            dragOriginSecRef.current = endRef.current;
          } else {
            dragOriginSecRef.current = playheadRef.current;
          }
        },
        onPanResponderMove: (_, gesture) => {
          const nextSec = dragOriginSecRef.current + secFromDx(gesture.dx);
          if (handle === 'in') {
            onInChange(nextSec);
          } else if (handle === 'out') {
            onOutChange(nextSec);
          } else {
            onPlayheadChange(nextSec);
          }
        },
        onPanResponderRelease: () => setActiveHandle(null),
        onPanResponderTerminate: () => setActiveHandle(null),
      }),
    [
      onInChange,
      onOutChange,
      onPlayheadChange,
      ready,
      secFromDx,
      trimDisabled,
    ],
  );

  const inResponder = useMemo(
    () => createDragResponder('in'),
    [createDragResponder],
  );
  const outResponder = useMemo(
    () => createDragResponder('out'),
    [createDragResponder],
  );
  const playheadResponder = useMemo(
    () => createDragResponder('playhead'),
    [createDragResponder],
  );

  const onTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={styles.container}>
      <View style={styles.timelineCard}>
        <View style={styles.trackShell} onLayout={onTrackLayout}>
          <View style={styles.waveformRow}>
            {peaks.map((peak, index) => {
              const ratio = (index + 0.5) / peaks.length;
              const inSelection = ratio >= startRatio && ratio <= endRatio;
              const barHeight = Math.max(10, (peak / maxPeak) * 78);

              return (
                <View key={index} style={styles.barSlot}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: inSelection
                          ? colors.primary
                          : colors.textMuted,
                        opacity: inSelection ? 1 : 0.16,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>

          {trackWidth > 0 && !trimDisabled ? (
            <>
              <View
                pointerEvents="none"
                style={[styles.dimRegion, {left: 0, width: startX}]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.dimRegion,
                  {left: endX, width: Math.max(0, trackWidth - endX)},
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.selectionBand,
                  {left: startX, width: Math.max(0, endX - startX)},
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.selectionProgress,
                  {
                    left: startX,
                    width: Math.max(0, (endX - startX) * selectionProgress),
                  },
                ]}
              />

              <View
                {...playheadResponder.panHandlers}
                style={[
                  styles.playheadHandle,
                  {left: playheadX - PLAYHEAD_WIDTH / 2},
                  activeHandle === 'playhead' && styles.handleActive,
                ]}>
                <View style={styles.playheadNeedle} />
              </View>

              <View
                {...inResponder.panHandlers}
                style={[
                  styles.trimHandle,
                  {left: startX - HANDLE_WIDTH / 2},
                  activeHandle === 'in' && styles.handleActive,
                ]}>
                <View style={[styles.handleTag, styles.inTag]}>
                  <Text style={styles.handleTagText}>IN</Text>
                </View>
                <View style={[styles.handleKnob, styles.inKnob]} />
                <View style={[styles.handleStem, styles.inStem]} />
              </View>

              <View
                {...outResponder.panHandlers}
                style={[
                  styles.trimHandle,
                  {left: endX - HANDLE_WIDTH / 2},
                  activeHandle === 'out' && styles.handleActive,
                ]}>
                <View style={[styles.handleTag, styles.outTag]}>
                  <Text style={styles.handleTagText}>OUT</Text>
                </View>
                <View style={[styles.handleKnob, styles.outKnob]} />
                <View style={[styles.handleStem, styles.outStem]} />
              </View>
            </>
          ) : null}
        </View>

        <View style={styles.markerRow}>
          <View style={styles.markerBlock}>
            <Text style={styles.markerLabel}>IN</Text>
            <Text style={[styles.markerValue, styles.inText]}>
              {formatTime(startSec)}
            </Text>
          </View>
          <View style={styles.markerBlockCenter}>
            <Text style={styles.markerLabel}>CLIP</Text>
            <Text style={styles.markerValue}>{formatTime(selectedSec)}</Text>
          </View>
          <View style={styles.markerBlock}>
            <Text style={styles.markerLabel}>OUT</Text>
            <Text style={[styles.markerValue, styles.outText]}>
              {formatTime(endSec)}
            </Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <Pressable
            onPress={onRestart}
            disabled={!ready}
            style={({pressed}) => [
              styles.secondaryButton,
              !ready && styles.buttonDisabled,
              pressed && ready && styles.buttonPressed,
            ]}>
            <MaterialCommunityIcons
              name="restart"
              size={24}
              color={ready ? colors.primary : colors.textMuted}
            />
          </Pressable>

          <Pressable
            onPress={onTogglePlay}
            disabled={!ready}
            style={({pressed}) => [
              styles.playButton,
              shadows.glow(colors.primary),
              !ready && styles.buttonDisabled,
              pressed && ready && styles.buttonPressed,
            ]}>
            <MaterialCommunityIcons
              name={isPlaying ? 'pause' : 'play'}
              size={34}
              color={colors.white}
              style={isPlaying ? undefined : styles.playIconOffset}
            />
          </Pressable>

          <View style={styles.secondarySpacer} />
        </View>

        <View style={styles.playbackMeta}>
          <Text style={styles.playbackTime}>{formatTime(playheadSec)}</Text>
          <Text style={styles.playbackHint}>
            {isPlaying ? 'Previewing selection' : 'Play previews IN to OUT'}
          </Text>
          <Text style={styles.playbackTime}>{formatTime(durationSec)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  timelineCard: {
    backgroundColor: colors.surfaceHighlight,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.sm,
  },
  trackShell: {
    height: TRACK_HEIGHT,
    borderRadius: radii.xl,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
  },
  waveformRow: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  barSlot: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: 3,
    borderRadius: radii.pill,
  },
  dimRegion: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  selectionBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  selectionProgress: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
  },
  trimHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: HANDLE_WIDTH,
    alignItems: 'center',
    zIndex: 4,
  },
  playheadHandle: {
    position: 'absolute',
    top: spacing.sm,
    bottom: spacing.sm,
    width: PLAYHEAD_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  handleActive: {
    transform: [{scale: 1.04}],
  },
  handleTag: {
    position: 'absolute',
    top: spacing.xs,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    zIndex: 5,
  },
  inTag: {
    backgroundColor: colors.primary,
  },
  outTag: {
    backgroundColor: colors.accent,
  },
  handleTagText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  handleKnob: {
    position: 'absolute',
    top: 30,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.white,
    ...shadows.sm,
  },
  inKnob: {
    backgroundColor: colors.primary,
  },
  outKnob: {
    backgroundColor: colors.accent,
  },
  handleStem: {
    position: 'absolute',
    top: 52,
    bottom: spacing.sm,
    width: 3,
    borderRadius: radii.pill,
  },
  inStem: {
    backgroundColor: colors.primary,
  },
  outStem: {
    backgroundColor: colors.accent,
  },
  playheadNeedle: {
    width: 3,
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  markerBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  markerBlockCenter: {
    flex: 1.1,
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.28)',
  },
  markerLabel: {
    ...typography.caption,
    letterSpacing: 0.8,
  },
  markerValue: {
    ...typography.headline,
    fontSize: 15,
  },
  inText: {
    color: colors.primary,
  },
  outText: {
    color: colors.accent,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  secondaryButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondarySpacer: {
    width: 52,
    height: 52,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    transform: [{scale: 0.97}],
  },
  playIconOffset: {
    marginLeft: 4,
  },
  playbackMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  playbackTime: {
    ...typography.mono,
    color: colors.textSecondary,
    minWidth: 42,
  },
  playbackHint: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    textAlign: 'center',
  },
});
