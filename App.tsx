import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { Workspace } from './components/Workspace';
import { StatsPanel } from './components/StatsPanel';
import { FabricSettings, PatternItem, GridCalculations, PatternGroup } from './types';
import { useUndoable } from './hooks/useUndoable';

// Constants
const CM_PER_INCH = 2.54;
const DEFAULT_FABRIC_WIDTH_CM = 100;
const DEFAULT_FABRIC_HEIGHT_CM = 150;
const DEFAULT_COUNT = 14;
const STORAGE_KEY = 'kanavice-studio-state';

// Group colors for visual distinction
const GROUP_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
];

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// Undoable state shape
interface UndoableState {
  fabric: FabricSettings;
  patterns: PatternItem[];
  groups: PatternGroup[];
}

// Validate and parse raw project data (used by both localStorage and import)
const parseProjectData = (data: Record<string, unknown>): UndoableState | null => {
  if (!data.fabric || !Array.isArray(data.patterns)) return null;
  const f = data.fabric as Record<string, unknown>;
  if (typeof f.widthCm !== 'number' || typeof f.heightCm !== 'number' || typeof f.count !== 'number') return null;
  if (f.count <= 0 || f.widthCm <= 0 || f.heightCm <= 0) return null;

  const validPatterns = (data.patterns as Record<string, unknown>[]).filter(p =>
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.widthStitches === 'number' && (p.widthStitches as number) > 0 &&
    typeof p.heightStitches === 'number' && (p.heightStitches as number) > 0 &&
    typeof p.offsetX === 'number' &&
    typeof p.offsetY === 'number'
  );
  if (validPatterns.length === 0) return null;

  return {
    fabric: { widthCm: f.widthCm, heightCm: f.heightCm, count: f.count },
    patterns: validPatterns.map(p => ({
      id: p.id as string,
      name: p.name as string,
      widthStitches: p.widthStitches as number,
      heightStitches: p.heightStitches as number,
      offsetX: Math.max(0, p.offsetX as number),
      offsetY: Math.max(0, p.offsetY as number),
      imageSrc: null,
      opacity: typeof p.opacity === 'number' ? p.opacity : 0.9,
      flipHorizontal: p.flipHorizontal === true,
      flipVertical: p.flipVertical === true,
      locked: p.locked === true,
      color: typeof p.color === 'string' ? p.color : undefined,
    })),
    groups: Array.isArray(data.groups) ? (data.groups as Record<string, unknown>[]).filter(g =>
      typeof g.id === 'string' && typeof g.name === 'string' && Array.isArray(g.patternIds)
    ) as unknown as PatternGroup[] : [],
  };
};

// Load saved state from localStorage
const loadSavedState = (): UndoableState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return parseProjectData(JSON.parse(saved));
    }
  } catch { /* ignore */ }
  return null;
};

const getInitialState = (): UndoableState => {
  const saved = loadSavedState();
  if (saved) return saved;
  return {
    fabric: { widthCm: DEFAULT_FABRIC_WIDTH_CM, heightCm: DEFAULT_FABRIC_HEIGHT_CM, count: DEFAULT_COUNT },
    patterns: [{
      id: generateId(), name: 'Desen 1', widthStitches: 150, heightStitches: 200,
      offsetX: 50, offsetY: 50, imageSrc: null, opacity: 0.9,
      flipHorizontal: false, flipVertical: false, locked: false,
    }],
    groups: [],
  };
};

export default function App() {
  // Compute initial state once (lazy initializer ensures single call)
  const [initialState] = useState(getInitialState);

  // Core undoable state
  const {
    state: appState,
    set: setAppState,
    update: updateAppState,
    commitFrom,
    undo, redo, reset,
    canUndo, canRedo,
  } = useUndoable<UndoableState>(initialState);

  const { fabric, patterns, groups } = appState;

  // Ref for accessing current state in event handlers
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  // Non-undoable state
  const [selectedPatternIds, setSelectedPatternIds] = useState<string[]>(
    () => initialState.patterns.length > 0 ? [initialState.patterns[0].id] : []
  );
  const [clipboard, setClipboard] = useState<PatternItem[]>([]);
  const [snapEnabled, setSnapEnabled] = useState(true);

  // Drag snapshot for undo history
  const dragSnapshotRef = useRef<UndoableState | null>(null);
  // Arrow key nudge debounce for undo history
  const nudgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeSnapshotRef = useRef<UndoableState | null>(null);
  // Debounced auto-save timer
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Convenience setters ---
  const setFabric = useCallback((updater: FabricSettings | ((prev: FabricSettings) => FabricSettings)) => {
    setAppState(prev => ({
      ...prev,
      fabric: typeof updater === 'function' ? updater(prev.fabric) : updater,
    }));
  }, [setAppState]);

  const setPatterns = useCallback((updater: PatternItem[] | ((prev: PatternItem[]) => PatternItem[])) => {
    setAppState(prev => ({
      ...prev,
      patterns: typeof updater === 'function' ? updater(prev.patterns) : updater,
    }));
  }, [setAppState]);

  const setGroups = useCallback((updater: PatternGroup[] | ((prev: PatternGroup[]) => PatternGroup[])) => {
    setAppState(prev => ({
      ...prev,
      groups: typeof updater === 'function' ? updater(prev.groups) : updater,
    }));
  }, [setAppState]);

  // --- localStorage autosave (debounced to avoid thrashing during drag) ---
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const data = {
        fabric: appState.fabric,
        patterns: appState.patterns.map(({ imageSrc, ...rest }) => rest),
        groups: appState.groups,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [appState]);

  // --- Core Calculations ---
  const grid = useMemo<GridCalculations>(() => {
    const stitchPerCm = fabric.count / CM_PER_INCH;
    const totalStitchesX = Math.round(fabric.widthCm * stitchPerCm);
    const totalStitchesY = Math.round(fabric.heightCm * stitchPerCm);
    const pixelsPerStitch = 4;
    return { totalStitchesX, totalStitchesY, pixelsPerStitch, stitchPerCm };
  }, [fabric]);

  // --- Auto-clamp patterns when fabric shrinks (no separate undo entry) ---
  const prevGridRef = useRef({ x: grid.totalStitchesX, y: grid.totalStitchesY });
  useEffect(() => {
    if (
      grid.totalStitchesX < prevGridRef.current.x ||
      grid.totalStitchesY < prevGridRef.current.y
    ) {
      updateAppState(prev => ({
        ...prev,
        patterns: prev.patterns.map(p => {
          const maxX = Math.max(0, grid.totalStitchesX - p.widthStitches);
          const maxY = Math.max(0, grid.totalStitchesY - p.heightStitches);
          const newWidth = Math.min(p.widthStitches, grid.totalStitchesX);
          const newHeight = Math.min(p.heightStitches, grid.totalStitchesY);
          return {
            ...p,
            widthStitches: newWidth,
            heightStitches: newHeight,
            offsetX: Math.min(p.offsetX, Math.max(0, grid.totalStitchesX - newWidth)),
            offsetY: Math.min(p.offsetY, Math.max(0, grid.totalStitchesY - newHeight)),
          };
        }),
      }));
    }
    prevGridRef.current = { x: grid.totalStitchesX, y: grid.totalStitchesY };
  }, [grid.totalStitchesX, grid.totalStitchesY, updateAppState]);

  // --- Derived ---
  const selectedPattern = useMemo(() => {
    if (selectedPatternIds.length === 0) return null;
    return patterns.find(p => p.id === selectedPatternIds[0]) || null;
  }, [patterns, selectedPatternIds]);

  const selectedPatterns = useMemo(() => {
    return patterns.filter(p => selectedPatternIds.includes(p.id));
  }, [patterns, selectedPatternIds]);

  // --- Pattern Callbacks ---
  const handleSelectPattern = useCallback((id: string, isShiftKey: boolean = false) => {
    if (isShiftKey) {
      setSelectedPatternIds(prev =>
        prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
      );
    } else {
      setSelectedPatternIds([id]);
    }
  }, []);

  const handleAddPattern = useCallback(() => {
    const newPattern: PatternItem = {
      id: generateId(),
      name: `Desen ${patterns.length + 1}`,
      widthStitches: 100, heightStitches: 100,
      offsetX: Math.round(grid.totalStitchesX / 4),
      offsetY: Math.round(grid.totalStitchesY / 4),
      imageSrc: null, opacity: 0.9,
      flipHorizontal: false, flipVertical: false, locked: false,
    };
    setPatterns(prev => [...prev, newPattern]);
    setSelectedPatternIds([newPattern.id]);
  }, [patterns.length, grid.totalStitchesX, grid.totalStitchesY, setPatterns]);

  const handleRemovePattern = useCallback((id: string) => {
    setPatterns(prev => prev.filter(p => p.id !== id));
    setSelectedPatternIds(prev => {
      const newSel = prev.filter(pid => pid !== id);
      if (newSel.length === 0) {
        const remaining = appStateRef.current.patterns.filter(p => p.id !== id);
        return remaining.length > 0 ? [remaining[0].id] : [];
      }
      return newSel;
    });
  }, [setPatterns]);

  const handleRemoveSelectedPatterns = useCallback(() => {
    setPatterns(prev => prev.filter(p => !selectedPatternIds.includes(p.id)));
    setSelectedPatternIds([]);
  }, [selectedPatternIds, setPatterns]);

  // Discrete update (creates history entry)
  const handleUpdatePattern = useCallback((id: string, updates: Partial<PatternItem>) => {
    setAppState(prev => ({
      ...prev,
      patterns: prev.patterns.map(p => p.id === id ? { ...p, ...updates } : p),
    }));
  }, [setAppState]);

  // Continuous update (no history - for drag/resize in Workspace)
  const handleUpdatePatternLive = useCallback((id: string, updates: Partial<PatternItem>) => {
    updateAppState(prev => ({
      ...prev,
      patterns: prev.patterns.map(p => p.id === id ? { ...p, ...updates } : p),
    }));
  }, [updateAppState]);

  // Batch continuous update (for multi-select drag)
  const handleUpdatePatternsLive = useCallback((updates: Array<{ id: string; changes: Partial<PatternItem> }>) => {
    updateAppState(prev => ({
      ...prev,
      patterns: prev.patterns.map(p => {
        const u = updates.find(u => u.id === p.id);
        return u ? { ...p, ...u.changes } : p;
      }),
    }));
  }, [updateAppState]);

  // Drag start/end for undo history
  const handleDragStart = useCallback(() => {
    dragSnapshotRef.current = appStateRef.current;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragSnapshotRef.current) {
      commitFrom(dragSnapshotRef.current);
      dragSnapshotRef.current = null;
    }
  }, [commitFrom]);

  const handleCenterPattern = useCallback((id: string) => {
    setPatterns(prev => prev.map(p => {
      if (p.id !== id) return p;
      return {
        ...p,
        offsetX: Math.max(0, Math.round((grid.totalStitchesX - p.widthStitches) / 2)),
        offsetY: Math.max(0, Math.round((grid.totalStitchesY - p.heightStitches) / 2))
      };
    }));
  }, [grid.totalStitchesX, grid.totalStitchesY, setPatterns]);

  // --- Copy/Paste/Duplicate ---
  const handleCopyPatterns = useCallback(() => {
    const toCopy = patterns.filter(p => selectedPatternIds.includes(p.id));
    if (toCopy.length > 0) setClipboard(toCopy.map(p => ({ ...p })));
  }, [patterns, selectedPatternIds]);

  const handlePastePatterns = useCallback(() => {
    if (clipboard.length === 0) return;
    const newPatterns: PatternItem[] = clipboard.map(p => {
      const w = Math.min(p.widthStitches, grid.totalStitchesX);
      const h = Math.min(p.heightStitches, grid.totalStitchesY);
      return {
        ...p,
        id: generateId(),
        name: `${p.name} (Kopya)`,
        widthStitches: w,
        heightStitches: h,
        offsetX: Math.max(0, Math.min(p.offsetX + 20, grid.totalStitchesX - w)),
        offsetY: Math.max(0, Math.min(p.offsetY + 20, grid.totalStitchesY - h)),
      };
    });
    setPatterns(prev => [...prev, ...newPatterns]);
    setSelectedPatternIds(newPatterns.map(p => p.id));
  }, [clipboard, grid.totalStitchesX, grid.totalStitchesY, setPatterns]);

  const handleDuplicatePatterns = useCallback(() => {
    const toDup = patterns.filter(p => selectedPatternIds.includes(p.id));
    if (toDup.length === 0) return;
    const newPatterns: PatternItem[] = toDup.map(p => {
      const w = Math.min(p.widthStitches, grid.totalStitchesX);
      const h = Math.min(p.heightStitches, grid.totalStitchesY);
      return {
        ...p,
        id: generateId(),
        name: `${p.name} (Kopya)`,
        widthStitches: w,
        heightStitches: h,
        offsetX: Math.max(0, Math.min(p.offsetX + 20, grid.totalStitchesX - w)),
        offsetY: Math.max(0, Math.min(p.offsetY + 20, grid.totalStitchesY - h)),
      };
    });
    setPatterns(prev => [...prev, ...newPatterns]);
    setSelectedPatternIds(newPatterns.map(p => p.id));
  }, [patterns, selectedPatternIds, grid.totalStitchesX, grid.totalStitchesY, setPatterns]);

  // --- Mirror/Flip ---
  const handleMirrorPatterns = useCallback((direction: 'horizontal' | 'vertical') => {
    setPatterns(prev => prev.map(p => {
      if (!selectedPatternIds.includes(p.id)) return p;
      return direction === 'horizontal'
        ? { ...p, flipHorizontal: !p.flipHorizontal }
        : { ...p, flipVertical: !p.flipVertical };
    }));
  }, [selectedPatternIds, setPatterns]);

  // --- Lock/Unlock ---
  const handleToggleLock = useCallback((id: string) => {
    setPatterns(prev => prev.map(p =>
      p.id === id ? { ...p, locked: !p.locked } : p
    ));
  }, [setPatterns]);

  // --- Z-order ---
  const handleBringToFront = useCallback(() => {
    if (selectedPatternIds.length === 0) return;
    setPatterns(prev => {
      const selected = prev.filter(p => selectedPatternIds.includes(p.id));
      const rest = prev.filter(p => !selectedPatternIds.includes(p.id));
      return [...rest, ...selected];
    });
  }, [selectedPatternIds, setPatterns]);

  const handleSendToBack = useCallback(() => {
    if (selectedPatternIds.length === 0) return;
    setPatterns(prev => {
      const selected = prev.filter(p => selectedPatternIds.includes(p.id));
      const rest = prev.filter(p => !selectedPatternIds.includes(p.id));
      return [...selected, ...rest];
    });
  }, [selectedPatternIds, setPatterns]);

  // --- Deselect all ---
  const handleDeselectAll = useCallback(() => {
    setSelectedPatternIds([]);
  }, []);

  // --- Margin Presets ---
  const handleSetMarginPreset = useCallback((preset: 'wide' | 'normal' | 'narrow' | number) => {
    const marginValue = typeof preset === 'number' ? preset : { wide: 80, normal: 50, narrow: 20 }[preset];
    setPatterns(prev => prev.map(p => {
      if (!selectedPatternIds.includes(p.id)) return p;
      return {
        ...p,
        offsetX: Math.min(marginValue, Math.max(0, grid.totalStitchesX - p.widthStitches)),
        offsetY: Math.min(marginValue, Math.max(0, grid.totalStitchesY - p.heightStitches)),
      };
    }));
  }, [selectedPatternIds, grid.totalStitchesX, grid.totalStitchesY, setPatterns]);

  // --- Groups ---
  const getPatternsBoundingBox = useCallback((patternList: PatternItem[]) => {
    if (patternList.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    const minX = Math.min(...patternList.map(p => p.offsetX));
    const minY = Math.min(...patternList.map(p => p.offsetY));
    const maxX = Math.max(...patternList.map(p => p.offsetX + p.widthStitches));
    const maxY = Math.max(...patternList.map(p => p.offsetY + p.heightStitches));
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }, []);

  const getSelectedUnits = useCallback(() => {
    const selected = patterns.filter(p => selectedPatternIds.includes(p.id));
    const selectedGroupIds = new Set<string>();
    const patternsInGroups = new Set<string>();

    groups.forEach(group => {
      const gpIds = group.patternIds.filter(id => patterns.some(p => p.id === id));
      if (gpIds.length === group.patternIds.length && gpIds.length > 0 && gpIds.every(id => selectedPatternIds.includes(id))) {
        selectedGroupIds.add(group.id);
        gpIds.forEach(id => patternsInGroups.add(id));
      }
    });

    const units: { type: 'group' | 'pattern'; id: string; patterns: PatternItem[]; bbox: ReturnType<typeof getPatternsBoundingBox> }[] = [];

    groups.forEach(group => {
      if (selectedGroupIds.has(group.id)) {
        const gp = patterns.filter(p => group.patternIds.includes(p.id));
        units.push({ type: 'group', id: group.id, patterns: gp, bbox: getPatternsBoundingBox(gp) });
      }
    });

    selected.forEach(p => {
      if (!patternsInGroups.has(p.id)) {
        units.push({ type: 'pattern', id: p.id, patterns: [p], bbox: getPatternsBoundingBox([p]) });
      }
    });

    return units;
  }, [patterns, selectedPatternIds, groups, getPatternsBoundingBox]);

  const handleDistributePatterns = useCallback((direction: 'horizontal' | 'vertical') => {
    const units = getSelectedUnits();
    if (units.length < 3) return;
    const updates = new Map<string, { offsetX?: number; offsetY?: number }>();

    if (direction === 'horizontal') {
      const sorted = [...units].sort((a, b) => a.bbox.minX - b.bbox.minX);
      const first = sorted[0], last = sorted[sorted.length - 1];
      const totalSpace = last.bbox.maxX - first.bbox.minX;
      const totalW = sorted.reduce((s, u) => s + u.bbox.width, 0);
      const gap = (totalSpace - totalW) / (sorted.length - 1);
      let cx = first.bbox.minX + first.bbox.width + gap;
      sorted.forEach((unit, i) => {
        if (i === 0 || i === sorted.length - 1) return;
        const dx = cx - unit.bbox.minX;
        unit.patterns.forEach(p => updates.set(p.id, { offsetX: Math.max(0, Math.min(Math.round(p.offsetX + dx), grid.totalStitchesX - p.widthStitches)) }));
        cx += unit.bbox.width + gap;
      });
    } else {
      const sorted = [...units].sort((a, b) => a.bbox.minY - b.bbox.minY);
      const first = sorted[0], last = sorted[sorted.length - 1];
      const totalSpace = last.bbox.maxY - first.bbox.minY;
      const totalH = sorted.reduce((s, u) => s + u.bbox.height, 0);
      const gap = (totalSpace - totalH) / (sorted.length - 1);
      let cy = first.bbox.minY + first.bbox.height + gap;
      sorted.forEach((unit, i) => {
        if (i === 0 || i === sorted.length - 1) return;
        const dy = cy - unit.bbox.minY;
        unit.patterns.forEach(p => updates.set(p.id, { offsetY: Math.max(0, Math.min(Math.round(p.offsetY + dy), grid.totalStitchesY - p.heightStitches)) }));
        cy += unit.bbox.height + gap;
      });
    }

    setPatterns(prev => prev.map(p => {
      const u = updates.get(p.id);
      return u ? { ...p, ...u } : p;
    }));
  }, [getSelectedUnits, grid.totalStitchesX, grid.totalStitchesY, setPatterns]);

  const clampOff = useCallback((p: PatternItem, ox: number, oy: number) => ({
    offsetX: Math.max(0, Math.min(Math.round(ox), grid.totalStitchesX - p.widthStitches)),
    offsetY: Math.max(0, Math.min(Math.round(oy), grid.totalStitchesY - p.heightStitches)),
  }), [grid.totalStitchesX, grid.totalStitchesY]);

  const handleAlignPatterns = useCallback((alignment: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => {
    const units = getSelectedUnits();
    if (units.length < 2) return;
    const updates = new Map<string, { offsetX?: number; offsetY?: number }>();

    switch (alignment) {
      case 'left': {
        const t = Math.min(...units.map(u => u.bbox.minX));
        units.forEach(u => { const d = t - u.bbox.minX; u.patterns.forEach(p => updates.set(p.id, clampOff(p, p.offsetX + d, p.offsetY))); });
        break;
      }
      case 'right': {
        const t = Math.max(...units.map(u => u.bbox.maxX));
        units.forEach(u => { const d = t - u.bbox.maxX; u.patterns.forEach(p => updates.set(p.id, clampOff(p, p.offsetX + d, p.offsetY))); });
        break;
      }
      case 'top': {
        const t = Math.min(...units.map(u => u.bbox.minY));
        units.forEach(u => { const d = t - u.bbox.minY; u.patterns.forEach(p => updates.set(p.id, clampOff(p, p.offsetX, p.offsetY + d))); });
        break;
      }
      case 'bottom': {
        const t = Math.max(...units.map(u => u.bbox.maxY));
        units.forEach(u => { const d = t - u.bbox.maxY; u.patterns.forEach(p => updates.set(p.id, clampOff(p, p.offsetX, p.offsetY + d))); });
        break;
      }
      case 'centerH': {
        const minX = Math.min(...units.map(u => u.bbox.minX));
        const maxX = Math.max(...units.map(u => u.bbox.maxX));
        const cx = (minX + maxX) / 2;
        units.forEach(u => { const d = cx - (u.bbox.minX + u.bbox.maxX) / 2; u.patterns.forEach(p => updates.set(p.id, clampOff(p, p.offsetX + d, p.offsetY))); });
        break;
      }
      case 'centerV': {
        const minY = Math.min(...units.map(u => u.bbox.minY));
        const maxY = Math.max(...units.map(u => u.bbox.maxY));
        const cy = (minY + maxY) / 2;
        units.forEach(u => { const d = cy - (u.bbox.minY + u.bbox.maxY) / 2; u.patterns.forEach(p => updates.set(p.id, clampOff(p, p.offsetX, p.offsetY + d))); });
        break;
      }
    }

    setPatterns(prev => prev.map(p => { const u = updates.get(p.id); return u ? { ...p, ...u } : p; }));
  }, [getSelectedUnits, clampOff, setPatterns]);

  const handleAlignToCanvas = useCallback((
    position: 'topLeft' | 'topCenter' | 'topRight' | 'centerLeft' | 'center' | 'centerRight' | 'bottomLeft' | 'bottomCenter' | 'bottomRight',
    margin: number = 0
  ) => {
    const units = getSelectedUnits();
    if (units.length === 0) return;
    const allP = units.flatMap(u => u.patterns);
    const bbox = getPatternsBoundingBox(allP);

    let tx: number, ty: number;
    if (position.includes('Left')) tx = margin;
    else if (position.includes('Right')) tx = grid.totalStitchesX - bbox.width - margin;
    else tx = (grid.totalStitchesX - bbox.width) / 2;

    if (position.includes('top')) ty = margin;
    else if (position.includes('bottom')) ty = grid.totalStitchesY - bbox.height - margin;
    else ty = (grid.totalStitchesY - bbox.height) / 2;

    const dx = tx - bbox.minX, dy = ty - bbox.minY;
    const affectedIds = new Set(allP.map(p => p.id));

    setPatterns(prev => prev.map(p => {
      if (!affectedIds.has(p.id)) return p;
      return {
        ...p,
        offsetX: Math.max(0, Math.min(Math.round(p.offsetX + dx), grid.totalStitchesX - p.widthStitches)),
        offsetY: Math.max(0, Math.min(Math.round(p.offsetY + dy), grid.totalStitchesY - p.heightStitches)),
      };
    }));
  }, [getSelectedUnits, getPatternsBoundingBox, grid, setPatterns]);

  const handleDistributeAcrossCanvas = useCallback((direction: 'horizontal' | 'vertical', margin: number = 0) => {
    const units = getSelectedUnits();
    if (units.length < 2) return;
    const sorted = direction === 'horizontal'
      ? [...units].sort((a, b) => a.bbox.minX - b.bbox.minX)
      : [...units].sort((a, b) => a.bbox.minY - b.bbox.minY);
    const totalSize = sorted.reduce((s, u) => s + (direction === 'horizontal' ? u.bbox.width : u.bbox.height), 0);
    const canvasSize = direction === 'horizontal' ? grid.totalStitchesX : grid.totalStitchesY;
    const gap = (canvasSize - margin * 2 - totalSize) / (sorted.length - 1);
    let current = margin;
    const updates = new Map<string, { offsetX?: number; offsetY?: number }>();
    sorted.forEach(unit => {
      const delta = current - (direction === 'horizontal' ? unit.bbox.minX : unit.bbox.minY);
      unit.patterns.forEach(p => {
        updates.set(p.id, direction === 'horizontal'
          ? { offsetX: Math.max(0, Math.min(Math.round(p.offsetX + delta), grid.totalStitchesX - p.widthStitches)) }
          : { offsetY: Math.max(0, Math.min(Math.round(p.offsetY + delta), grid.totalStitchesY - p.heightStitches)) });
      });
      current += (direction === 'horizontal' ? unit.bbox.width : unit.bbox.height) + gap;
    });
    setPatterns(prev => prev.map(p => { const u = updates.get(p.id); return u ? { ...p, ...u } : p; }));
  }, [getSelectedUnits, grid, setPatterns]);

  // --- Group management ---
  const handleCreateGroup = useCallback((name?: string) => {
    if (selectedPatternIds.length < 2) return;
    const gName = name || `Grup ${groups.length + 1}`;
    const newGroup: PatternGroup = {
      id: generateId(), name: gName,
      patternIds: [...selectedPatternIds],
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length],
    };
    setGroups(prev => [...prev, newGroup]);
  }, [selectedPatternIds, groups.length, setGroups]);

  const handleDeleteGroup = useCallback((groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
  }, [setGroups]);

  const handleRenameGroup = useCallback((groupId: string, newName: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: newName } : g));
  }, [setGroups]);

  const handleAddToGroup = useCallback((patternId: string, groupId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId || g.patternIds.includes(patternId)) return g;
      return { ...g, patternIds: [...g.patternIds, patternId] };
    }));
  }, [setGroups]);

  const handleRemoveFromGroup = useCallback((patternId: string, groupId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      return { ...g, patternIds: g.patternIds.filter(id => id !== patternId) };
    }).filter(g => g.patternIds.length > 0));
  }, [setGroups]);

  const handleSelectGroup = useCallback((groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (group) setSelectedPatternIds(group.patternIds.filter(id => patterns.some(p => p.id === id)));
  }, [groups, patterns]);

  const handleMoveGroup = useCallback((groupId: string, deltaX: number, deltaY: number) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    setPatterns(prev => prev.map(p => {
      if (!group.patternIds.includes(p.id)) return p;
      return {
        ...p,
        offsetX: Math.max(0, Math.min(p.offsetX + deltaX, grid.totalStitchesX - p.widthStitches)),
        offsetY: Math.max(0, Math.min(p.offsetY + deltaY, grid.totalStitchesY - p.heightStitches)),
      };
    }));
  }, [groups, grid.totalStitchesX, grid.totalStitchesY, setPatterns]);

  // --- Export/Import ---
  const handleExport = useCallback(() => {
    const data = {
      version: 1,
      fabric: appState.fabric,
      patterns: appState.patterns.map(({ imageSrc, ...rest }) => rest),
      groups: appState.groups,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kanavice-proje.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [appState]);

  const handleImport = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result;
        if (typeof result !== 'string') return;
        const newState = parseProjectData(JSON.parse(result));
        if (!newState) return;
        // Use set (not reset) so the import is undoable
        setAppState(newState);
        setSelectedPatternIds(newState.patterns.length > 0 ? [newState.patterns[0].id] : []);
      } catch { /* ignore invalid file */ }
    };
    reader.readAsText(file);
  }, [setAppState]);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;

      const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Undo/Redo - clear pending nudge timer to avoid history corruption
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (nudgeTimerRef.current) { clearTimeout(nudgeTimerRef.current); nudgeTimerRef.current = null; }
        nudgeSnapshotRef.current = null;
        undo();
        return;
      }
      if ((mod && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) || (!isMac && mod && e.key === 'y')) {
        e.preventDefault();
        if (nudgeTimerRef.current) { clearTimeout(nudgeTimerRef.current); nudgeTimerRef.current = null; }
        nudgeSnapshotRef.current = null;
        redo();
        return;
      }

      // Select All
      if (mod && e.key === 'a') {
        e.preventDefault();
        setSelectedPatternIds(appStateRef.current.patterns.map(p => p.id));
        return;
      }

      // Copy/Paste/Duplicate
      if (mod && e.key === 'c') { e.preventDefault(); handleCopyPatterns(); return; }
      if (mod && e.key === 'v') { e.preventDefault(); handlePastePatterns(); return; }
      if (mod && e.key === 'd') { e.preventDefault(); handleDuplicatePatterns(); return; }

      // Lock toggle
      if (mod && e.key === 'l') {
        e.preventDefault();
        if (selectedPatternIds.length === 1) {
          handleToggleLock(selectedPatternIds[0]);
        }
        return;
      }

      // Delete
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPatternIds.length > 0) {
        e.preventDefault();
        handleRemoveSelectedPatterns();
        return;
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedPatternIds([]);
        return;
      }

      // Arrow key nudge (1 stitch, +Shift = 10 stitches) with debounced undo
      const arrowDelta = e.shiftKey ? 10 : 1;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedPatternIds.length > 0) {
        e.preventDefault();
        const dx = e.key === 'ArrowLeft' ? -arrowDelta : e.key === 'ArrowRight' ? arrowDelta : 0;
        const dy = e.key === 'ArrowUp' ? -arrowDelta : e.key === 'ArrowDown' ? arrowDelta : 0;

        // Snapshot before first nudge in sequence
        if (!nudgeSnapshotRef.current) {
          nudgeSnapshotRef.current = appStateRef.current;
        }

        // Use continuous update (no history entry per keystroke)
        updateAppState(prev => ({
          ...prev,
          patterns: prev.patterns.map(p => {
            if (!selectedPatternIds.includes(p.id) || p.locked) return p;
            return {
              ...p,
              offsetX: Math.max(0, Math.min(p.offsetX + dx, grid.totalStitchesX - p.widthStitches)),
              offsetY: Math.max(0, Math.min(p.offsetY + dy, grid.totalStitchesY - p.heightStitches)),
            };
          }),
        }));

        // Commit to undo history after 500ms of no nudges
        if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
        nudgeTimerRef.current = setTimeout(() => {
          if (nudgeSnapshotRef.current) {
            commitFrom(nudgeSnapshotRef.current);
            nudgeSnapshotRef.current = null;
          }
        }, 500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    };
  }, [undo, redo, handleCopyPatterns, handlePastePatterns, handleDuplicatePatterns, handleRemoveSelectedPatterns, handleToggleLock, selectedPatternIds, grid.totalStitchesX, grid.totalStitchesY, updateAppState, commitFrom]);

  return (
    <div className="flex h-screen w-screen overflow-hidden flex-col md:flex-row">
      <ControlPanel
        fabric={fabric}
        setFabric={setFabric}
        patterns={patterns}
        selectedPatternIds={selectedPatternIds}
        onSelectPattern={handleSelectPattern}
        onAddPattern={handleAddPattern}
        onRemovePattern={handleRemovePattern}
        onUpdatePattern={handleUpdatePattern}
        onCenterPattern={handleCenterPattern}
        onCopyPatterns={handleCopyPatterns}
        onPastePatterns={handlePastePatterns}
        onDuplicatePatterns={handleDuplicatePatterns}
        onMirrorPatterns={handleMirrorPatterns}
        onSetMarginPreset={handleSetMarginPreset}
        onDistributePatterns={handleDistributePatterns}
        onAlignPatterns={handleAlignPatterns}
        groups={groups}
        onCreateGroup={handleCreateGroup}
        onDeleteGroup={handleDeleteGroup}
        onSelectGroup={handleSelectGroup}
        onRenameGroup={handleRenameGroup}
        onMoveGroup={handleMoveGroup}
        onAlignToCanvas={handleAlignToCanvas}
        onDistributeAcrossCanvas={handleDistributeAcrossCanvas}
        clipboard={clipboard}
        grid={grid}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onExport={handleExport}
        onImport={handleImport}
        snapEnabled={snapEnabled}
        onToggleSnap={() => setSnapEnabled(s => !s)}
        onToggleLock={handleToggleLock}
        onBringToFront={handleBringToFront}
        onSendToBack={handleSendToBack}
        onAddToGroup={handleAddToGroup}
        onRemoveFromGroup={handleRemoveFromGroup}
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Workspace
          fabric={fabric}
          patterns={patterns}
          selectedPatternIds={selectedPatternIds}
          onSelectPattern={handleSelectPattern}
          grid={grid}
          onUpdatePattern={handleUpdatePatternLive}
          onUpdatePatterns={handleUpdatePatternsLive}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          groups={groups}
          snapEnabled={snapEnabled}
          onDeselectAll={handleDeselectAll}
        />
        <StatsPanel
          fabric={fabric}
          patterns={patterns}
          selectedPatterns={selectedPatterns}
          grid={grid}
        />
      </div>
    </div>
  );
}
