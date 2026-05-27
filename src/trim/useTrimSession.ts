import {useCallback, useEffect, useMemo, useReducer, useRef} from 'react';
import {
  clampTrimRange,
  decodeAudioForCrop,
  isFullSongSelection,
  MIN_CROP_SEC,
  validateCropRange,
} from '../audio/cropAudio';
import {
  applyCropToSession,
  getSessionPaths,
} from '../storage/sessionManager';
import {TrimPreviewEngine} from './TrimPreviewEngine';

export type TrimSessionStatus =
  | 'loading'
  | 'ready'
  | 'previewing'
  | 'applying'
  | 'error';

export interface TrimSessionState {
  status: TrimSessionStatus;
  durationSec: number;
  startSec: number;
  endSec: number;
  playheadSec: number;
  isPlaying: boolean;
  peaks: number[];
  pcm: Float32Array | null;
  error: string | null;
}

type TrimAction =
  | {type: 'LOAD_START'}
  | {
      type: 'LOAD_SUCCESS';
      payload: {
        durationSec: number;
        startSec: number;
        endSec: number;
        peaks: number[];
        pcm: Float32Array;
      };
    }
  | {type: 'LOAD_ERROR'; error: string}
  | {type: 'SET_RANGE'; startSec: number; endSec: number}
  | {type: 'SET_PLAYHEAD'; playheadSec: number}
  | {
      type: 'ENGINE_SYNC';
      playheadSec: number;
      isPlaying: boolean;
    }
  | {type: 'SET_STATUS'; status: TrimSessionStatus}
  | {type: 'SET_ERROR'; error: string | null};

const initialState: TrimSessionState = {
  status: 'loading',
  durationSec: 0,
  startSec: 0,
  endSec: 0,
  playheadSec: 0,
  isPlaying: false,
  peaks: [],
  pcm: null,
  error: null,
};

function trimReducer(
  state: TrimSessionState,
  action: TrimAction,
): TrimSessionState {
  switch (action.type) {
    case 'LOAD_START':
      return {...initialState, status: 'loading'};
    case 'LOAD_SUCCESS':
      return {
        ...state,
        status: 'ready',
        durationSec: action.payload.durationSec,
        startSec: action.payload.startSec,
        endSec: action.payload.endSec,
        playheadSec: action.payload.startSec,
        peaks: action.payload.peaks,
        pcm: action.payload.pcm,
        error: null,
        isPlaying: false,
      };
    case 'LOAD_ERROR':
      return {...state, status: 'error', error: action.error};
    case 'SET_RANGE':
      return {
        ...state,
        startSec: action.startSec,
        endSec: action.endSec,
      };
    case 'SET_PLAYHEAD':
      return {...state, playheadSec: action.playheadSec};
    case 'ENGINE_SYNC':
      return {
        ...state,
        playheadSec: action.playheadSec,
        isPlaying: action.isPlaying,
        status:
          action.isPlaying && state.status === 'ready'
            ? 'previewing'
            : !action.isPlaying && state.status === 'previewing'
              ? 'ready'
              : state.status,
      };
    case 'SET_STATUS':
      return {...state, status: action.status};
    case 'SET_ERROR':
      return {...state, error: action.error};
    default:
      return state;
  }
}

export function useTrimSession(sessionId: string, fileName: string) {
  const engineRef = useRef(new TrimPreviewEngine());
  const [state, dispatch] = useReducer(trimReducer, initialState);
  const trimBoundsRef = useRef({
    startSec: 0,
    endSec: 0,
    durationSec: 0,
  });

  trimBoundsRef.current.startSec = state.startSec;
  trimBoundsRef.current.endSec = state.endSec;
  trimBoundsRef.current.durationSec = state.durationSec;

  const loadAudio = useCallback(async () => {
    dispatch({type: 'LOAD_START'});
    try {
      const paths = getSessionPaths(sessionId, fileName);
      const decoded = await decodeAudioForCrop(paths.original);
      // Build the preview buffer from resampled PCM so timeline seconds, crop
      // math, and AudioBuffer duration all share one clock.
      engineRef.current.loadFromPcm(decoded.pcm);
      engineRef.current.setRegion(0, decoded.durationSec, {
        pauseOnChange: false,
      });
      trimBoundsRef.current = {
        startSec: 0,
        endSec: decoded.durationSec,
        durationSec: decoded.durationSec,
      };
      dispatch({
        type: 'LOAD_SUCCESS',
        payload: {
          durationSec: decoded.durationSec,
          startSec: 0,
          endSec: decoded.durationSec,
          peaks: decoded.peaks,
          pcm: decoded.pcm,
        },
      });
    } catch (error) {
      dispatch({
        type: 'LOAD_ERROR',
        error:
          error instanceof Error ? error.message : 'Could not load audio',
      });
    }
  }, [sessionId, fileName]);

  useEffect(() => {
    void loadAudio();
    const unsubscribe = engineRef.current.subscribe(snapshot => {
      dispatch({
        type: 'ENGINE_SYNC',
        playheadSec: snapshot.playheadSec,
        isPlaying: snapshot.isPlaying,
      });
    });

    return () => {
      unsubscribe();
      void engineRef.current.destroy();
    };
  }, [loadAudio]);

  const selectedSec = Math.max(0, state.endSec - state.startSec);
  const isFullSong = isFullSongSelection(
    state.startSec,
    state.endSec,
    state.durationSec,
  );
  const selectionValid =
    isFullSong || selectedSec >= MIN_CROP_SEC;
  const requiresFullSongOnly = state.durationSec < MIN_CROP_SEC;

  const setInPoint = useCallback((sec: number) => {
    const {endSec, durationSec} = trimBoundsRef.current;
    const range = clampTrimRange(sec, endSec, durationSec, 'start');
    trimBoundsRef.current.startSec = range.startSec;
    trimBoundsRef.current.endSec = range.endSec;
    engineRef.current.setRegion(range.startSec, range.endSec, {
      pauseOnChange: false,
    });
    dispatch({type: 'SET_RANGE', ...range});
  }, []);

  const setOutPoint = useCallback((sec: number) => {
    const {startSec, durationSec} = trimBoundsRef.current;
    const range = clampTrimRange(startSec, sec, durationSec, 'end');
    trimBoundsRef.current.startSec = range.startSec;
    trimBoundsRef.current.endSec = range.endSec;
    engineRef.current.setRegion(range.startSec, range.endSec, {
      pauseOnChange: false,
    });
    dispatch({type: 'SET_RANGE', ...range});
  }, []);

  const setPlayhead = useCallback((sec: number) => {
    engineRef.current.setPlayhead(sec);
    dispatch({type: 'SET_PLAYHEAD', playheadSec: engineRef.current.getSnapshot().playheadSec});
  }, []);

  const selectFullSong = useCallback(() => {
    engineRef.current.pause();
    engineRef.current.setRegion(0, state.durationSec, {
      pauseOnChange: false,
    });
    trimBoundsRef.current.startSec = 0;
    trimBoundsRef.current.endSec = state.durationSec;
    dispatch({
      type: 'SET_RANGE',
      startSec: 0,
      endSec: state.durationSec,
    });
    dispatch({type: 'SET_PLAYHEAD', playheadSec: 0});
  }, [state.durationSec]);

  const togglePreview = useCallback(async () => {
    await engineRef.current.togglePlayback();
  }, []);

  const restartPreview = useCallback(() => {
    engineRef.current.restartPreview();
    void engineRef.current.startPlayback();
  }, []);

  const stopPreview = useCallback(() => {
    engineRef.current.pause();
  }, []);

  const applyTrim = useCallback(async () => {
    if (!state.pcm) {
      throw new Error('Audio is not loaded.');
    }

    validateCropRange(state.startSec, state.endSec, state.durationSec);

    if (isFullSong) {
      return;
    }

    dispatch({type: 'SET_STATUS', status: 'applying'});
    try {
      engineRef.current.pause();
      await applyCropToSession(
        sessionId,
        fileName,
        state.startSec,
        state.endSec,
        state.pcm,
      );
    } catch (error) {
      dispatch({type: 'SET_STATUS', status: 'ready'});
      throw error;
    }
  }, [
    fileName,
    isFullSong,
    sessionId,
    state.durationSec,
    state.endSec,
    state.pcm,
    state.startSec,
  ]);

  return useMemo(
    () => ({
      state,
      derived: {
        selectedSec,
        isFullSong,
        selectionValid,
        requiresFullSongOnly,
      },
      actions: {
        reload: loadAudio,
        setInPoint,
        setOutPoint,
        setPlayhead,
        selectFullSong,
        togglePreview,
        restartPreview,
        stopPreview,
        applyTrim,
      },
    }),
    [
      applyTrim,
      isFullSong,
      loadAudio,
      restartPreview,
      selectFullSong,
      selectedSec,
      selectionValid,
      requiresFullSongOnly,
      setInPoint,
      setOutPoint,
      setPlayhead,
      state,
      stopPreview,
      togglePreview,
    ],
  );
}
