import { useReducer, useCallback } from 'react';

const MAX_HISTORY = 50;

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

type HistoryAction<T> =
  | { type: 'SET'; state: T }
  | { type: 'SET_FN'; fn: (prev: T) => T }
  | { type: 'UPDATE'; state: T }
  | { type: 'UPDATE_FN'; fn: (prev: T) => T }
  | { type: 'COMMIT_FROM'; previousState: T }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET'; state: T };

function createReducer<T>() {
  return (state: HistoryState<T>, action: HistoryAction<T>): HistoryState<T> => {
    switch (action.type) {
      case 'SET':
        return {
          past: [...state.past, state.present].slice(-MAX_HISTORY),
          present: action.state,
          future: [],
        };
      case 'SET_FN':
        return {
          past: [...state.past, state.present].slice(-MAX_HISTORY),
          present: action.fn(state.present),
          future: [],
        };
      case 'UPDATE':
        return { ...state, present: action.state };
      case 'UPDATE_FN':
        return { ...state, present: action.fn(state.present) };
      case 'COMMIT_FROM':
        return {
          past: [...state.past, action.previousState].slice(-MAX_HISTORY),
          present: state.present,
          future: [],
        };
      case 'UNDO':
        if (state.past.length === 0) return state;
        return {
          past: state.past.slice(0, -1),
          present: state.past[state.past.length - 1],
          future: [state.present, ...state.future],
        };
      case 'REDO':
        if (state.future.length === 0) return state;
        return {
          past: [...state.past, state.present].slice(-MAX_HISTORY),
          present: state.future[0],
          future: state.future.slice(1),
        };
      case 'RESET':
        return { past: [], present: action.state, future: [] };
      default:
        return state;
    }
  };
}

export function useUndoable<T>(initialState: T) {
  const [history, dispatch] = useReducer(createReducer<T>(), {
    past: [],
    present: initialState,
    future: [],
  });

  // Creates a history entry (for discrete actions)
  const set = useCallback((updater: T | ((prev: T) => T)) => {
    if (typeof updater === 'function') {
      dispatch({ type: 'SET_FN', fn: updater as (prev: T) => T });
    } else {
      dispatch({ type: 'SET', state: updater });
    }
  }, []);

  // Updates present without history (for continuous operations like drag)
  const update = useCallback((updater: T | ((prev: T) => T)) => {
    if (typeof updater === 'function') {
      dispatch({ type: 'UPDATE_FN', fn: updater as (prev: T) => T });
    } else {
      dispatch({ type: 'UPDATE', state: updater });
    }
  }, []);

  // Pushes a previous state to history (used after continuous operations end)
  const commitFrom = useCallback((previousState: T) => {
    dispatch({ type: 'COMMIT_FROM', previousState });
  }, []);

  const undo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo = useCallback(() => dispatch({ type: 'REDO' }), []);
  const reset = useCallback((state: T) => dispatch({ type: 'RESET', state }), []);

  return {
    state: history.present,
    set,
    update,
    commitFrom,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
