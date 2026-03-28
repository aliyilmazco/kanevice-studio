import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { FabricSettings, PatternItem, GridCalculations, PatternGroup } from '../types';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Lock } from 'lucide-react';

// Snap threshold in stitches - patterns will snap when within this distance
const SNAP_THRESHOLD = 8;

// Zoom constants
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 10;
const ZOOM_FACTOR = 1.15;  // multiplicative step for button zoom
const PADDING = 40;         // canvas padding (px)

const clampScale = (s: number): number => Math.min(Math.max(s, ZOOM_MIN), ZOOM_MAX);

// Compute centering padding for a given scale
const computePad = (
  s: number,
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number
) => ({
  left: Math.max(PADDING, (containerWidth - naturalWidth * s) / 2),
  top: Math.max(PADDING, (containerHeight - naturalHeight * s) / 2),
});

interface ResizeState {
  patternId: string;
  handle: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  startMouseX: number;
  startMouseY: number;
  startWidth: number;
  startHeight: number;
  startOffsetX: number;
  startOffsetY: number;
  aspectRatio: number;
}

interface HandlerContext {
  patterns: PatternItem[];
  selectedPatternIds: string[];
  scale: number;
  pixelsPerStitch: number;
  totalStitchesX: number;
  totalStitchesY: number;
  onSelectPattern: (id: string, isShiftKey?: boolean) => void;
  onUpdatePattern: (id: string, updates: Partial<PatternItem>) => void;
  onUpdatePatterns: (updates: Array<{ id: string; changes: Partial<PatternItem> }>) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDeselectAll: () => void;
  getSnapPoints: (excludeIds: string | string[]) => { snapX: number[]; snapY: number[] };
  calculateSnap: (pattern: PatternItem, rawX: number, rawY: number, snapPoints: { snapX: number[]; snapY: number[] }) => { x: number; y: number; guidesX: number[]; guidesY: number[] };
  clampOffset: (x: number, y: number, pattern: PatternItem) => { x: number; y: number };
  snapEnabled: boolean;
}

interface WorkspaceProps {
  fabric: FabricSettings;
  patterns: PatternItem[];
  selectedPatternIds: string[];
  onSelectPattern: (id: string, isShiftKey?: boolean) => void;
  grid: GridCalculations;
  onUpdatePattern: (id: string, updates: Partial<PatternItem>) => void;
  onUpdatePatterns: (updates: Array<{ id: string; changes: Partial<PatternItem> }>) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  groups: PatternGroup[];
  snapEnabled: boolean;
  onDeselectAll: () => void;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  fabric,
  patterns,
  selectedPatternIds,
  onSelectPattern,
  grid,
  onUpdatePattern,
  onUpdatePatterns,
  onDragStart,
  onDragEnd,
  groups,
  snapEnabled,
  onDeselectAll
}) => {
  // Scale state with ref for sync access in event handlers
  const scaleRef = useRef(1);
  const [scale, _setScale] = useState(1);
  const setScale = useCallback((v: number | ((prev: number) => number)) => {
    _setScale(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      scaleRef.current = next;
      return next;
    });
  }, []);

  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Resize state with ref
  const [resizing, _setResizing] = useState<ResizeState | null>(null);
  const resizingRef = useRef<ResizeState | null>(null);
  const setResizing = useCallback((v: ResizeState | null) => {
    resizingRef.current = v;
    _setResizing(v);
  }, []);

  const [activeGuides, setActiveGuides] = useState<{
    vertical: number[];
    horizontal: number[];
  }>({ vertical: [], horizontal: [] });

  const containerRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });
  // Multi-select drag: stores start offsets for all dragged patterns
  const startOffsets = useRef<Map<string, { x: number; y: number }>>(new Map());
  const lastTouchDistance = useRef<number | null>(null);
  const pendingScrollRef = useRef<{ left: number; top: number } | null>(null);

  // Container size tracking
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerSizeRef = useRef({ width: 0, height: 0 });

  // Natural (unscaled) canvas dimensions
  const naturalWidth = grid.totalStitchesX * grid.pixelsPerStitch;
  const naturalHeight = grid.totalStitchesY * grid.pixelsPerStitch;
  const naturalWidthRef = useRef(naturalWidth);
  const naturalHeightRef = useRef(naturalHeight);
  naturalWidthRef.current = naturalWidth;
  naturalHeightRef.current = naturalHeight;

  // Computed padding for JSX rendering
  const padLeft = Math.max(PADDING, (containerSize.width - naturalWidth * scale) / 2);
  const padTop = Math.max(PADDING, (containerSize.height - naturalHeight * scale) / 2);

  // Helper that reads from refs (for use in event handlers)
  const computePadForScale = useCallback((s: number) => computePad(
    s,
    containerSizeRef.current.width,
    containerSizeRef.current.height,
    naturalWidthRef.current,
    naturalHeightRef.current
  ), []);

  // Calculate max offset for a pattern
  const getMaxOffset = useCallback((pattern: PatternItem) => ({
    x: Math.max(0, Math.floor(grid.totalStitchesX - pattern.widthStitches)),
    y: Math.max(0, Math.floor(grid.totalStitchesY - pattern.heightStitches))
  }), [grid.totalStitchesX, grid.totalStitchesY]);

  // Clamp offset values within boundaries
  const clampOffset = useCallback((x: number, y: number, pattern: PatternItem) => {
    const max = getMaxOffset(pattern);
    return {
      x: Math.max(0, Math.min(x, max.x)),
      y: Math.max(0, Math.min(y, max.y))
    };
  }, [getMaxOffset]);

  // Get snap points from other patterns and canvas (accepts single ID or array)
  const getSnapPoints = useCallback((excludeIds: string | string[]) => {
    const excludeSet = new Set(Array.isArray(excludeIds) ? excludeIds : [excludeIds]);
    const snapX: number[] = [];
    const snapY: number[] = [];

    // Canvas snap points (edges and center)
    snapX.push(0, grid.totalStitchesX / 2, grid.totalStitchesX);
    snapY.push(0, grid.totalStitchesY / 2, grid.totalStitchesY);

    // Other patterns' snap points
    patterns.forEach(p => {
      if (excludeSet.has(p.id)) return;
      snapX.push(p.offsetX, p.offsetX + p.widthStitches / 2, p.offsetX + p.widthStitches);
      snapY.push(p.offsetY, p.offsetY + p.heightStitches / 2, p.offsetY + p.heightStitches);
    });

    return { snapX, snapY };
  }, [patterns, grid.totalStitchesX, grid.totalStitchesY]);

  // Calculate snap position and active guides
  const calculateSnap = useCallback((
    pattern: PatternItem,
    rawX: number,
    rawY: number,
    snapPoints: { snapX: number[]; snapY: number[] }
  ): { x: number; y: number; guidesX: number[]; guidesY: number[] } => {
    let snappedX = rawX;
    let snappedY = rawY;
    const guidesX: number[] = [];
    const guidesY: number[] = [];

    const dragLeft = rawX;
    const dragRight = rawX + pattern.widthStitches;
    const dragCenterX = rawX + pattern.widthStitches / 2;
    const dragTop = rawY;
    const dragBottom = rawY + pattern.heightStitches;
    const dragCenterY = rawY + pattern.heightStitches / 2;

    let closestXDist = SNAP_THRESHOLD + 1;
    for (const sx of snapPoints.snapX) {
      const leftDist = Math.abs(dragLeft - sx);
      if (leftDist <= SNAP_THRESHOLD && leftDist < closestXDist) {
        snappedX = sx;
        closestXDist = leftDist;
        guidesX.length = 0;
        guidesX.push(sx);
      }
      const rightDist = Math.abs(dragRight - sx);
      if (rightDist <= SNAP_THRESHOLD && rightDist < closestXDist) {
        snappedX = sx - pattern.widthStitches;
        closestXDist = rightDist;
        guidesX.length = 0;
        guidesX.push(sx);
      }
      const centerDist = Math.abs(dragCenterX - sx);
      if (centerDist <= SNAP_THRESHOLD && centerDist < closestXDist) {
        snappedX = sx - pattern.widthStitches / 2;
        closestXDist = centerDist;
        guidesX.length = 0;
        guidesX.push(sx);
      }
    }

    let closestYDist = SNAP_THRESHOLD + 1;
    for (const sy of snapPoints.snapY) {
      const topDist = Math.abs(dragTop - sy);
      if (topDist <= SNAP_THRESHOLD && topDist < closestYDist) {
        snappedY = sy;
        closestYDist = topDist;
        guidesY.length = 0;
        guidesY.push(sy);
      }
      const bottomDist = Math.abs(dragBottom - sy);
      if (bottomDist <= SNAP_THRESHOLD && bottomDist < closestYDist) {
        snappedY = sy - pattern.heightStitches;
        closestYDist = bottomDist;
        guidesY.length = 0;
        guidesY.push(sy);
      }
      const centerDist = Math.abs(dragCenterY - sy);
      if (centerDist <= SNAP_THRESHOLD && centerDist < closestYDist) {
        snappedY = sy - pattern.heightStitches / 2;
        closestYDist = centerDist;
        guidesY.length = 0;
        guidesY.push(sy);
      }
    }

    return { x: snappedX, y: snappedY, guidesX, guidesY };
  }, []);

  // Fit to view calculation
  const calculateFitScale = useCallback(() => {
    if (!containerRef.current) return 1;
    const { clientWidth, clientHeight } = containerRef.current;
    const padding = 60;
    const fabricPixelWidth = grid.totalStitchesX * grid.pixelsPerStitch;
    const fabricPixelHeight = grid.totalStitchesY * grid.pixelsPerStitch;

    const scaleX = (clientWidth - padding) / fabricPixelWidth;
    const scaleY = (clientHeight - padding) / fabricPixelHeight;

    return clampScale(Math.min(scaleX, scaleY));
  }, [grid.totalStitchesX, grid.totalStitchesY, grid.pixelsPerStitch]);

  // Handler context ref - gives event handlers access to current values
  const ctxRef = useRef<HandlerContext>(null!);
  ctxRef.current = {
    patterns, selectedPatternIds, scale: scaleRef.current,
    pixelsPerStitch: grid.pixelsPerStitch,
    totalStitchesX: grid.totalStitchesX, totalStitchesY: grid.totalStitchesY,
    onSelectPattern, onUpdatePattern, onUpdatePatterns, onDragStart, onDragEnd, onDeselectAll,
    getSnapPoints, calculateSnap, clampOffset, snapEnabled,
  };

  // --- ResizeObserver for container size tracking ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        containerSizeRef.current = { width, height };
        setContainerSize({ width, height });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // --- Scroll restoration on scale change ---
  useLayoutEffect(() => {
    if (pendingScrollRef.current && containerRef.current) {
      containerRef.current.scrollLeft = Math.max(0, pendingScrollRef.current.left);
      containerRef.current.scrollTop = Math.max(0, pendingScrollRef.current.top);
      pendingScrollRef.current = null;
    }
  }, [scale]);

  // --- Initial fit + auto refit on fabric size change ---
  const initialFitDone = useRef(false);
  const prevGridDims = useRef({ x: grid.totalStitchesX, y: grid.totalStitchesY });

  useEffect(() => {
    if (!initialFitDone.current) {
      setScale(calculateFitScale());
      initialFitDone.current = true;
    } else if (
      prevGridDims.current.x !== grid.totalStitchesX ||
      prevGridDims.current.y !== grid.totalStitchesY
    ) {
      setScale(calculateFitScale());
    }
    prevGridDims.current = { x: grid.totalStitchesX, y: grid.totalStitchesY };
  }, [grid.totalStitchesX, grid.totalStitchesY, calculateFitScale, setScale]);

  // --- Wheel zoom with zoom-to-cursor ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const oldScale = scaleRef.current;
        const factor = Math.pow(1.005, -e.deltaY);
        const newScale = clampScale(oldScale * factor);
        if (newScale === oldScale) return;

        const oldPad = computePadForScale(oldScale);
        const newPad = computePadForScale(newScale);

        // Content-space point under cursor
        const contentX = (container.scrollLeft + cursorX - oldPad.left) / oldScale;
        const contentY = (container.scrollTop + cursorY - oldPad.top) / oldScale;

        // Scroll to keep that point under cursor
        pendingScrollRef.current = {
          left: contentX * newScale + newPad.left - cursorX,
          top: contentY * newScale + newPad.top - cursorY,
        };

        setScale(newScale);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [computePadForScale, setScale]);

  // --- Mouse drag handlers (multi-select aware) ---
  const handleMouseDown = useCallback((e: React.MouseEvent, patternId: string) => {
    if (resizingRef.current) return;
    const pattern = patterns.find(p => p.id === patternId);
    if (!pattern || pattern.locked) return;
    e.preventDefault();
    e.stopPropagation();

    // Call onDragStart for undo history
    onDragStart();

    setDraggingId(patternId);
    onSelectPattern(patternId, e.shiftKey);
    startPos.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { x: pattern.offsetX, y: pattern.offsetY };

    // Store start offsets for all selected patterns (multi-select drag)
    startOffsets.current.clear();
    const currentSelected = selectedPatternIds.includes(patternId)
      ? selectedPatternIds
      : [patternId];
    patterns.forEach(p => {
      if (currentSelected.includes(p.id) && !p.locked) {
        startOffsets.current.set(p.id, { x: p.offsetX, y: p.offsetY });
      }
    });
  }, [patterns, selectedPatternIds, onSelectPattern, onDragStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingId) return;
    const ctx = ctxRef.current;
    const pattern = ctx.patterns.find((p) => p.id === draggingId);
    if (!pattern) return;

    const dx = e.clientX - startPos.current.x;
    const dy = e.clientY - startPos.current.y;
    const dStitchX = dx / scaleRef.current / ctx.pixelsPerStitch;
    const dStitchY = dy / scaleRef.current / ctx.pixelsPerStitch;

    // Primary pattern raw position
    const primaryStart = startOffsets.current.get(draggingId) || startOffset.current;
    const rawX = primaryStart.x + dStitchX;
    const rawY = primaryStart.y + dStitchY;

    // Snap calculation (exclude all dragged patterns)
    const draggedIds = Array.from(startOffsets.current.keys());
    let snappedDX = dStitchX;
    let snappedDY = dStitchY;

    if (ctx.snapEnabled && !e.shiftKey) {
      const snapPoints = ctx.getSnapPoints(draggedIds);
      const { x: snappedX, y: snappedY, guidesX, guidesY } = ctx.calculateSnap(
        pattern, rawX, rawY, snapPoints
      );
      setActiveGuides({ vertical: guidesX, horizontal: guidesY });
      snappedDX = snappedX - primaryStart.x;
      snappedDY = snappedY - primaryStart.y;
    } else {
      setActiveGuides({ vertical: [], horizontal: [] });
      snappedDX = dStitchX;
      snappedDY = dStitchY;
    }

    // Apply delta to all dragged patterns
    if (startOffsets.current.size > 1) {
      const updates: Array<{ id: string; changes: Partial<PatternItem> }> = [];
      startOffsets.current.forEach((offset, id) => {
        const p = ctx.patterns.find((pp) => pp.id === id);
        if (!p) return;
        const clamped = ctx.clampOffset(Math.round(offset.x + snappedDX), Math.round(offset.y + snappedDY), p);
        updates.push({ id, changes: { offsetX: clamped.x, offsetY: clamped.y } });
      });
      ctx.onUpdatePatterns(updates);
    } else {
      const clamped = ctx.clampOffset(Math.round(primaryStart.x + snappedDX), Math.round(primaryStart.y + snappedDY), pattern);
      ctx.onUpdatePattern(pattern.id, { offsetX: clamped.x, offsetY: clamped.y });
    }
  }, [draggingId]);

  const handleMouseUp = useCallback(() => {
    if (draggingId || resizingRef.current) {
      ctxRef.current.onDragEnd();
    }
    setDraggingId(null);
    setResizing(null);
    setActiveGuides({ vertical: [], horizontal: [] });
    startOffsets.current.clear();
  }, [draggingId, setResizing]);

  // --- Resize handle mousedown ---
  const handleResizeStart = useCallback((
    e: React.MouseEvent,
    patternId: string,
    handle: ResizeState['handle']
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const pattern = patterns.find(p => p.id === patternId);
    if (!pattern || pattern.locked) return;
    onDragStart(); // For undo history
    setResizing({
      patternId,
      handle,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startWidth: pattern.widthStitches,
      startHeight: pattern.heightStitches,
      startOffsetX: pattern.offsetX,
      startOffsetY: pattern.offsetY,
      aspectRatio: pattern.imageSrc ? pattern.widthStitches / pattern.heightStitches : 0,
    });
    onSelectPattern(patternId, false);
  }, [patterns, setResizing, onSelectPattern, onDragStart]);

  // --- Global mouse event listeners (drag + resize) ---
  useEffect(() => {
    if (!draggingId && !resizing) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const rs = resizingRef.current;
      if (rs) {
        const ctx = ctxRef.current;
        const pattern = ctx.patterns.find((p) => p.id === rs.patternId);
        if (!pattern) return;

        const dxStitches = (e.clientX - rs.startMouseX) / scaleRef.current / ctx.pixelsPerStitch;
        const dyStitches = (e.clientY - rs.startMouseY) / scaleRef.current / ctx.pixelsPerStitch;

        let newWidth = rs.startWidth;
        let newHeight = rs.startHeight;
        let newOffsetX = rs.startOffsetX;
        let newOffsetY = rs.startOffsetY;

        switch (rs.handle) {
          case 'bottomRight':
            newWidth = rs.startWidth + dxStitches;
            newHeight = rs.startHeight + dyStitches;
            break;
          case 'bottomLeft':
            newWidth = rs.startWidth - dxStitches;
            newHeight = rs.startHeight + dyStitches;
            newOffsetX = rs.startOffsetX + rs.startWidth - newWidth;
            break;
          case 'topRight':
            newWidth = rs.startWidth + dxStitches;
            newHeight = rs.startHeight - dyStitches;
            newOffsetY = rs.startOffsetY + rs.startHeight - newHeight;
            break;
          case 'topLeft':
            newWidth = rs.startWidth - dxStitches;
            newHeight = rs.startHeight - dyStitches;
            newOffsetX = rs.startOffsetX + rs.startWidth - newWidth;
            newOffsetY = rs.startOffsetY + rs.startHeight - newHeight;
            break;
        }

        // Aspect ratio lock for image patterns
        if (pattern.imageSrc && rs.aspectRatio > 0 && isFinite(rs.aspectRatio)) {
          const ar = rs.aspectRatio;
          newHeight = newWidth / ar;
          if (rs.handle === 'topLeft' || rs.handle === 'bottomLeft') {
            newOffsetX = rs.startOffsetX + rs.startWidth - newWidth;
          }
          if (rs.handle === 'topLeft' || rs.handle === 'topRight') {
            newOffsetY = rs.startOffsetY + rs.startHeight - newHeight;
          }
          // Min size preserving aspect ratio
          if (newWidth < 10) {
            newWidth = 10;
            newHeight = 10 / ar;
          }
          if (newHeight < 10) {
            newHeight = 10;
            newWidth = 10 * ar;
          }
        } else {
          // Free resize - independent min size
          newWidth = Math.max(10, newWidth);
          newHeight = Math.max(10, newHeight);
        }

        // Canvas bounds - clamp offset then dimensions
        newOffsetX = Math.max(0, Math.min(newOffsetX, ctx.totalStitchesX - 10));
        newOffsetY = Math.max(0, Math.min(newOffsetY, ctx.totalStitchesY - 10));
        newWidth = Math.min(newWidth, ctx.totalStitchesX - newOffsetX);
        newHeight = Math.min(newHeight, ctx.totalStitchesY - newOffsetY);

        ctx.onUpdatePattern(rs.patternId, {
          widthStitches: Math.round(newWidth),
          heightStitches: Math.round(newHeight),
          offsetX: Math.round(newOffsetX),
          offsetY: Math.round(newOffsetY),
        });
      } else {
        handleMouseMove(e);
      }
    };

    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault(); // prevent scroll during resize/drag
      const touch = e.touches[0];
      handleGlobalMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
    };
    const handleGlobalTouchEnd = () => {
      handleGlobalMouseUp();
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
    document.addEventListener('touchend', handleGlobalTouchEnd);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [draggingId, resizing, handleMouseMove, handleMouseUp]);

  // --- Container-level touch handlers (pinch zoom + pattern drag) ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchDragPatternId: string | null = null;
    let touchStartPos = { x: 0, y: 0 };
    let touchStartOffset = { x: 0, y: 0 };
    let touchStartOffsets = new Map<string, { x: number; y: number }>();
    let isPinching = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        isPinching = true;
        touchDragPatternId = null;
        touchStartOffsets.clear();
        setDraggingId(null);
        setActiveGuides({ vertical: [], horizontal: [] });
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDistance.current = Math.sqrt(dx * dx + dy * dy);
        e.preventDefault();
      } else if (e.touches.length === 1 && !isPinching) {
        const target = e.touches[0].target as HTMLElement;
        const patternEl = target.closest('[data-pattern-id]') as HTMLElement | null;
        if (patternEl) {
          const patternId = patternEl.getAttribute('data-pattern-id')!;
          const ctx = ctxRef.current;
          const pattern = ctx.patterns.find((p) => p.id === patternId);
          if (pattern && !pattern.locked) {
            ctx.onDragStart();
            touchDragPatternId = patternId;
            setDraggingId(patternId);
            ctx.onSelectPattern(patternId, false);
            touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            touchStartOffset = { x: pattern.offsetX, y: pattern.offsetY };
            // Multi-select touch drag
            touchStartOffsets.clear();
            const selected = ctx.selectedPatternIds.includes(patternId)
              ? ctx.selectedPatternIds : [patternId];
            ctx.patterns.forEach((p) => {
              if (selected.includes(p.id) && !p.locked) {
                touchStartOffsets.set(p.id, { x: p.offsetX, y: p.offsetY });
              }
            });
          }
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistance.current !== null) {
        // Pinch zoom with zoom-to-center
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const scaleFactor = distance / lastTouchDistance.current;
        lastTouchDistance.current = distance;

        // Pinch center relative to container
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = container.getBoundingClientRect();
        const localX = centerX - rect.left;
        const localY = centerY - rect.top;

        const oldScale = scaleRef.current;
        const newScale = clampScale(oldScale * scaleFactor);
        if (newScale !== oldScale) {
          const oldPad = computePadForScale(oldScale);
          const newPad = computePadForScale(newScale);
          const contentX = (container.scrollLeft + localX - oldPad.left) / oldScale;
          const contentY = (container.scrollTop + localY - oldPad.top) / oldScale;
          pendingScrollRef.current = {
            left: contentX * newScale + newPad.left - localX,
            top: contentY * newScale + newPad.top - localY,
          };
          setScale(newScale);
        }
      } else if (e.touches.length === 1 && touchDragPatternId && !isPinching) {
        // Single finger drag (multi-select aware)
        const ctx = ctxRef.current;
        const pattern = ctx.patterns.find((p) => p.id === touchDragPatternId);
        if (!pattern) return;

        const touch = e.touches[0];
        const tdx = touch.clientX - touchStartPos.x;
        const tdy = touch.clientY - touchStartPos.y;
        const dStitchX = tdx / scaleRef.current / ctx.pixelsPerStitch;
        const dStitchY = tdy / scaleRef.current / ctx.pixelsPerStitch;

        const primaryStart = touchStartOffsets.get(touchDragPatternId) || touchStartOffset;
        const rawX = primaryStart.x + dStitchX;
        const rawY = primaryStart.y + dStitchY;

        let snappedDX = dStitchX;
        let snappedDY = dStitchY;
        const draggedIds = Array.from(touchStartOffsets.keys());

        if (ctx.snapEnabled) {
          const snapPoints = ctx.getSnapPoints(draggedIds);
          const { x: snappedX, y: snappedY, guidesX, guidesY } = ctx.calculateSnap(
            pattern, rawX, rawY, snapPoints
          );
          setActiveGuides({ vertical: guidesX, horizontal: guidesY });
          snappedDX = snappedX - primaryStart.x;
          snappedDY = snappedY - primaryStart.y;
        } else {
          setActiveGuides({ vertical: [], horizontal: [] });
        }

        if (touchStartOffsets.size > 1) {
          const updates: Array<{ id: string; changes: Partial<PatternItem> }> = [];
          touchStartOffsets.forEach((offset, id) => {
            const p = ctx.patterns.find((pp) => pp.id === id);
            if (!p) return;
            const clamped = ctx.clampOffset(Math.round(offset.x + snappedDX), Math.round(offset.y + snappedDY), p);
            updates.push({ id, changes: { offsetX: clamped.x, offsetY: clamped.y } });
          });
          ctx.onUpdatePatterns(updates);
        } else {
          const clamped = ctx.clampOffset(Math.round(primaryStart.x + snappedDX), Math.round(primaryStart.y + snappedDY), pattern);
          ctx.onUpdatePattern(pattern.id, { offsetX: clamped.x, offsetY: clamped.y });
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        // All fingers lifted - full cleanup
        if (touchDragPatternId) {
          ctxRef.current.onDragEnd();
        }
        isPinching = false;
        touchDragPatternId = null;
        touchStartOffsets.clear();
        setDraggingId(null);
        setActiveGuides({ vertical: [], horizontal: [] });
        lastTouchDistance.current = null;
      }
      // When going from 2 -> 1 finger, isPinching stays true to prevent accidental drag
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [computePadForScale, setScale]);

  // --- Zoom controls with scroll preservation ---
  const zoomToCenter = useCallback((direction: 'in' | 'out') => {
    const container = containerRef.current;
    if (!container) return;
    const oldScale = scaleRef.current;
    const newScale = clampScale(direction === 'in' ? oldScale * ZOOM_FACTOR : oldScale / ZOOM_FACTOR);
    if (newScale === oldScale) return;

    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;

    const oldPad = computePadForScale(oldScale);
    const newPad = computePadForScale(newScale);

    const contentX = (container.scrollLeft + centerX - oldPad.left) / oldScale;
    const contentY = (container.scrollTop + centerY - oldPad.top) / oldScale;

    pendingScrollRef.current = {
      left: contentX * newScale + newPad.left - centerX,
      top: contentY * newScale + newPad.top - centerY,
    };

    setScale(newScale);
  }, [computePadForScale, setScale]);

  const handleZoomIn = useCallback(() => zoomToCenter('in'), [zoomToCenter]);
  const handleZoomOut = useCallback(() => zoomToCenter('out'), [zoomToCenter]);

  const handleFitToView = useCallback(() => {
    pendingScrollRef.current = { left: 0, top: 0 };
    setScale(calculateFitScale());
  }, [calculateFitScale, setScale]);

  const handleResetZoom = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      const nw = naturalWidthRef.current;
      const nh = naturalHeightRef.current;
      const pad = computePad(1, container.clientWidth, container.clientHeight, nw, nh);
      const totalW = nw + pad.left + PADDING;
      const totalH = nh + pad.top + PADDING;
      pendingScrollRef.current = {
        left: Math.max(0, (totalW - container.clientWidth) / 2),
        top: Math.max(0, (totalH - container.clientHeight) / 2),
      };
    }
    setScale(1);
  }, [setScale]);

  // --- Zoom keyboard shortcuts (Ctrl++/-/0) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleFitToView();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleFitToView]);

  // Get group for a pattern
  const getPatternGroup = useCallback((patternId: string): PatternGroup | undefined => {
    return groups.find(g => g.patternIds.includes(patternId));
  }, [groups]);

  return (
    <div className="flex-1 relative" style={{ minHeight: 0 }}>
      {/* Controls Overlay - positioned within workspace, non-scrolling */}
      <div className="absolute top-4 right-4 flex gap-2 z-30 pointer-events-auto">
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white rounded-md shadow-md hover:bg-gray-50 text-gray-700 transition-colors"
          title="Uzaklaştır"
          aria-label="Uzaklaştır"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={handleResetZoom}
          className="p-2 bg-white rounded-md shadow-md text-sm font-bold min-w-[3rem] text-center hover:bg-gray-50 transition-colors cursor-pointer"
          title="%100'e sıfırla"
          aria-label={`Zoom: ${Math.round(scale * 100)}%, tıklayın sıfırlamak için`}
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white rounded-md shadow-md hover:bg-gray-50 text-gray-700 transition-colors"
          title="Yakınlaştır"
          aria-label="Yakınlaştır"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={handleFitToView}
          className="p-2 bg-white rounded-md shadow-md hover:bg-gray-50 text-gray-700 transition-colors"
          title="Sığdır"
          aria-label="Ekrana sığdır"
        >
          <Maximize className="w-5 h-5" />
        </button>
        <button
          onClick={handleResetZoom}
          className="p-2 bg-white rounded-md shadow-md hover:bg-gray-50 text-gray-700 transition-colors"
          title="%100"
          aria-label="Zoom'u %100'e sıfırla"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Pattern count indicator */}
      <div className="absolute top-4 left-4 z-30 bg-white rounded-md shadow-md px-3 py-2">
        <span className="text-sm font-medium text-gray-700">
          {patterns.length} desen
        </span>
      </div>

      {/* Scrollable canvas container */}
      <div
        ref={containerRef}
        className="absolute inset-0 bg-gray-100 overflow-auto select-none"
      >
      {/* Canvas wrapper - padding-based centering, no flex center */}
      <div
        className="min-w-full min-h-full"
        style={{
          width: naturalWidth * scale + padLeft + PADDING,
          height: naturalHeight * scale + padTop + PADDING,
          paddingLeft: padLeft,
          paddingTop: padTop,
          paddingRight: PADDING,
          paddingBottom: PADDING,
        }}
      >
        {/* The Fabric */}
        {(() => {
          // Adaptive grid: choose grid density based on zoom so lines stay visible
          const pps = grid.pixelsPerStitch;
          const effectivePx = pps * scale; // on-screen size of 1 stitch
          let minorStep: number, majorStep: number;
          if (effectivePx >= 3) {
            minorStep = 1;   majorStep = 10;
          } else if (effectivePx * 10 >= 3) {
            minorStep = 10;  majorStep = 50;
          } else if (effectivePx * 50 >= 3) {
            minorStep = 50;  majorStep = 200;
          } else {
            minorStep = 100; majorStep = 500;
          }
          const minorSize = pps * minorStep;
          const majorSize = pps * majorStep;

          return (
        <div
        onClick={(e) => { if (e.target === e.currentTarget) onDeselectAll(); }}
        className="bg-white shadow-2xl relative box-content border-4 border-gray-300 flex-shrink-0"
        style={{
          width: naturalWidth,
          height: naturalHeight,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          backgroundImage: `
            linear-gradient(#bbb 1px, transparent 1px),
            linear-gradient(90deg, #bbb 1px, transparent 1px),
            linear-gradient(#ddd 1px, transparent 1px),
            linear-gradient(90deg, #ddd 1px, transparent 1px)
          `,
          backgroundSize: `
            ${majorSize}px ${majorSize}px,
            ${majorSize}px ${majorSize}px,
            ${minorSize}px ${minorSize}px,
            ${minorSize}px ${minorSize}px
          `
        }}
      >
        {/* Center Crosshair (Fabric) */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-red-400 opacity-60" style={{ marginLeft: '-1px' }}></div>
          <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-red-400 opacity-60" style={{ marginTop: '-1px' }}></div>
        </div>

        {/* Smart Guides - shown during drag */}
        {(activeGuides.vertical.length > 0 || activeGuides.horizontal.length > 0) && (
          <>
            {activeGuides.vertical.map((x, i) => (
              <div
                key={`guide-v-${i}`}
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: x * grid.pixelsPerStitch - 1,
                  width: 2,
                  background: 'linear-gradient(to bottom, #ec4899, #f472b6, #ec4899)',
                  zIndex: 100,
                  boxShadow: '0 0 8px rgba(236, 72, 153, 0.8)',
                }}
              />
            ))}
            {activeGuides.horizontal.map((y, i) => (
              <div
                key={`guide-h-${i}`}
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  top: y * grid.pixelsPerStitch - 1,
                  height: 2,
                  background: 'linear-gradient(to right, #ec4899, #f472b6, #ec4899)',
                  zIndex: 100,
                  boxShadow: '0 0 8px rgba(236, 72, 153, 0.8)',
                }}
              />
            ))}
          </>
        )}

        {/* Dimension Lines for Selected Pattern */}
        {selectedPatternIds.length > 0 && (() => {
          const selected = patterns.find(p => p.id === selectedPatternIds[0]);
          if (!selected) return null;

          const pps = grid.pixelsPerStitch;
          const left = selected.offsetX * pps;
          const top = selected.offsetY * pps;
          const right = (grid.totalStitchesX - selected.offsetX - selected.widthStitches) * pps;
          const bottom = (grid.totalStitchesY - selected.offsetY - selected.heightStitches) * pps;
          const patternRight = (selected.offsetX + selected.widthStitches) * pps;
          const patternBottom = (selected.offsetY + selected.heightStitches) * pps;
          const patternCenterY = top + (selected.heightStitches * pps) / 2;
          const patternCenterX = left + (selected.widthStitches * pps) / 2;

          return (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
              {/* Left margin line */}
              {selected.offsetX > 0 && (
                <div
                  className="absolute flex items-center"
                  style={{ left: 0, top: patternCenterY - 10, width: left, height: 20 }}
                >
                  <div className="h-[2px] bg-orange-500 flex-1 relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3 bg-orange-500"></div>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-3 bg-orange-500"></div>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[10px] px-1 rounded font-bold">
                    {selected.offsetX}
                  </div>
                </div>
              )}

              {/* Right margin line */}
              {right > 0 && (
                <div
                  className="absolute flex items-center"
                  style={{ left: patternRight, top: patternCenterY - 10, width: right, height: 20 }}
                >
                  <div className="h-[2px] bg-orange-500 flex-1 relative">
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3 bg-orange-500"></div>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-3 bg-orange-500"></div>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 bg-orange-500 text-white text-[10px] px-1 rounded font-bold">
                    {Math.round(grid.totalStitchesX - selected.offsetX - selected.widthStitches)}
                  </div>
                </div>
              )}

              {/* Top margin line */}
              {selected.offsetY > 0 && (
                <div
                  className="absolute flex flex-col items-center"
                  style={{ left: patternCenterX - 10, top: 0, width: 20, height: top }}
                >
                  <div className="w-[2px] bg-purple-500 flex-1 relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-3 bg-purple-500"></div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-3 bg-purple-500"></div>
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2 bg-purple-500 text-white text-[10px] px-1 rounded font-bold">
                    {selected.offsetY}
                  </div>
                </div>
              )}

              {/* Bottom margin line */}
              {bottom > 0 && (
                <div
                  className="absolute flex flex-col items-center"
                  style={{ left: patternCenterX - 10, top: patternBottom, width: 20, height: bottom }}
                >
                  <div className="w-[2px] bg-purple-500 flex-1 relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-3 bg-purple-500"></div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-3 bg-purple-500"></div>
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2 bg-purple-500 text-white text-[10px] px-1 rounded font-bold">
                    {Math.round(grid.totalStitchesY - selected.offsetY - selected.heightStitches)}
                  </div>
                </div>
              )}

              {/* Distance to other patterns */}
              {patterns.filter(p => p.id !== selectedPatternIds[0]).flatMap(other => {
                const otherLeft = other.offsetX * pps;
                const otherTop = other.offsetY * pps;
                const otherRight = (other.offsetX + other.widthStitches) * pps;
                const otherBottom = (other.offsetY + other.heightStitches) * pps;

                const lines: React.ReactNode[] = [];

                // Horizontal distance
                if (patternRight <= otherLeft) {
                  const dist = other.offsetX - selected.offsetX - selected.widthStitches;
                  const lineY = Math.max(top, otherTop) + Math.min(patternBottom - top, otherBottom - otherTop) / 2;
                  lines.push(
                    <div
                      key={`h-${other.id}`}
                      className="absolute flex items-center"
                      style={{ left: patternRight, top: lineY - 10, width: otherLeft - patternRight, height: 20 }}
                    >
                      <div className="h-[2px] bg-green-500 flex-1 relative">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3 bg-green-500"></div>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-3 bg-green-500"></div>
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] px-1 rounded font-bold whitespace-nowrap">
                        {dist}
                      </div>
                    </div>
                  );
                } else if (left >= otherRight) {
                  const dist = selected.offsetX - other.offsetX - other.widthStitches;
                  const lineY = Math.max(top, otherTop) + Math.min(patternBottom - top, otherBottom - otherTop) / 2;
                  lines.push(
                    <div
                      key={`h-${other.id}`}
                      className="absolute flex items-center"
                      style={{ left: otherRight, top: lineY - 10, width: left - otherRight, height: 20 }}
                    >
                      <div className="h-[2px] bg-green-500 flex-1 relative">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-3 bg-green-500"></div>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-3 bg-green-500"></div>
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] px-1 rounded font-bold whitespace-nowrap">
                        {dist}
                      </div>
                    </div>
                  );
                }

                // Vertical distance
                if (patternBottom <= otherTop) {
                  const dist = other.offsetY - selected.offsetY - selected.heightStitches;
                  const lineX = Math.max(left, otherLeft) + Math.min(patternRight - left, otherRight - otherLeft) / 2;
                  lines.push(
                    <div
                      key={`v-${other.id}`}
                      className="absolute flex flex-col items-center"
                      style={{ left: lineX - 10, top: patternBottom, width: 20, height: otherTop - patternBottom }}
                    >
                      <div className="w-[2px] bg-green-500 flex-1 relative">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-3 bg-green-500"></div>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-3 bg-green-500"></div>
                      </div>
                      <div className="absolute top-1/2 -translate-y-1/2 bg-green-500 text-white text-[10px] px-1 rounded font-bold whitespace-nowrap">
                        {dist}
                      </div>
                    </div>
                  );
                } else if (top >= otherBottom) {
                  const dist = selected.offsetY - other.offsetY - other.heightStitches;
                  const lineX = Math.max(left, otherLeft) + Math.min(patternRight - left, otherRight - otherLeft) / 2;
                  lines.push(
                    <div
                      key={`v-${other.id}`}
                      className="absolute flex flex-col items-center"
                      style={{ left: lineX - 10, top: otherBottom, width: 20, height: top - otherBottom }}
                    >
                      <div className="w-[2px] bg-green-500 flex-1 relative">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-3 bg-green-500"></div>
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-3 bg-green-500"></div>
                      </div>
                      <div className="absolute top-1/2 -translate-y-1/2 bg-green-500 text-white text-[10px] px-1 rounded font-bold whitespace-nowrap">
                        {dist}
                      </div>
                    </div>
                  );
                }

                return lines;
              })}
            </div>
          );
        })()}

        {/* All Patterns */}
        {patterns.map((pattern, patternIndex) => {
          const isSelected = selectedPatternIds.includes(pattern.id);
          const isDragging = draggingId === pattern.id;
          const patternGroup = getPatternGroup(pattern.id);

          // Calculate flip transform
          const flipTransform = [
            pattern.flipHorizontal ? 'scaleX(-1)' : '',
            pattern.flipVertical ? 'scaleY(-1)' : ''
          ].filter(Boolean).join(' ');

          return (
            <div
              key={pattern.id}
              data-pattern-id={pattern.id}
              onMouseDown={(e) => handleMouseDown(e, pattern.id)}
              style={{
                position: 'absolute',
                left: pattern.offsetX * grid.pixelsPerStitch,
                top: pattern.offsetY * grid.pixelsPerStitch,
                width: pattern.widthStitches * grid.pixelsPerStitch,
                height: pattern.heightStitches * grid.pixelsPerStitch,
                opacity: pattern.opacity,
                cursor: pattern.locked ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                zIndex: isSelected ? 10 + patternIndex : patternIndex + 1
              }}
              className="group"
            >
              {/* Pattern Background/Image */}
              {pattern.imageSrc ? (
                <img
                  src={pattern.imageSrc}
                  alt={pattern.name}
                  className="w-full h-full object-fill select-none pointer-events-none block"
                  draggable={false}
                  style={{ transform: flipTransform || undefined }}
                />
              ) : (
                <div
                  className={`w-full h-full border-2 border-dashed flex items-center justify-center ${
                    pattern.color
                      ? 'border-current'
                      : isSelected ? 'bg-indigo-500/30 border-indigo-600' : 'bg-gray-500/20 border-gray-500'
                  }`}
                  style={{
                    transform: flipTransform || undefined,
                    ...(pattern.color ? { backgroundColor: pattern.color + '4D', borderColor: pattern.color, color: pattern.color } : {}),
                  }}
                >
                  <span className={`font-bold text-sm whitespace-nowrap px-2 ${
                    isSelected ? 'text-indigo-700' : 'text-gray-600'
                  }`}>
                    {pattern.name}
                    {(pattern.flipHorizontal || pattern.flipVertical) && (
                      <span className="ml-1 text-xs opacity-60">
                        {pattern.flipHorizontal && '↔'}
                        {pattern.flipVertical && '↕'}
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Selection border and group indicator */}
              <div
                className={`absolute inset-0 pointer-events-none border-2 ${
                  isSelected ? 'border-blue-500' : patternGroup ? 'border-opacity-50' : 'border-transparent'
                }`}
                style={!isSelected && patternGroup ? { borderColor: patternGroup.color, borderStyle: 'dashed' } : undefined}
              >
                {isSelected && (
                  <>
                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-blue-500 opacity-70" style={{ marginLeft: '-0.5px' }}></div>
                    <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-blue-500 opacity-70" style={{ marginTop: '-0.5px' }}></div>
                  </>
                )}
                {/* Group color indicator */}
                {patternGroup && (
                  <div
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: patternGroup.color }}
                    title={patternGroup.name}
                  />
                )}
                {/* Lock indicator */}
                {pattern.locked && (
                  <div className="absolute top-1 right-1 bg-gray-800/70 text-white rounded p-0.5" title="Kilitli">
                    <Lock className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Hover/Selected info - flip below when at top edge */}
              <div className={`absolute left-0 text-[11px] bg-black/80 text-white px-2 py-0.5 rounded whitespace-nowrap shadow-md ${
                isSelected ? 'block' : 'hidden group-hover:block'
              }`}
                style={pattern.offsetY < 2 ? { top: '100%', marginTop: 4 } : { bottom: '100%', marginBottom: 4 }}
              >
                {pattern.name}: {pattern.widthStitches} x {pattern.heightStitches}
                {pattern.locked && ' 🔒'}
              </div>

              {/* Interactive resize handles for selected pattern (mouse + touch) */}
              {isSelected && !pattern.locked && (
                <>
                  {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map(handle => {
                    const isTop = handle.includes('top');
                    const isLeft = handle.includes('Left');
                    const cursor = (handle === 'topLeft' || handle === 'bottomRight') ? 'nwse-resize' : 'nesw-resize';
                    return (
                      <div
                        key={handle}
                        className={`absolute bg-blue-500 rounded-full border-2 border-white shadow ${
                          isTop ? '-top-1' : '-bottom-1'
                        } ${isLeft ? '-left-1' : '-right-1'}`}
                        style={{ cursor, zIndex: 20, width: 12, height: 12, touchAction: 'none' }}
                        onMouseDown={(e) => handleResizeStart(e, pattern.id, handle)}
                        onTouchStart={(e) => {
                          if (e.touches.length !== 1) return;
                          e.stopPropagation();
                          const touch = e.touches[0];
                          const syntheticEvent = {
                            preventDefault: () => e.preventDefault(),
                            stopPropagation: () => e.stopPropagation(),
                            clientX: touch.clientX,
                            clientY: touch.clientY,
                          } as React.MouseEvent;
                          handleResizeStart(syntheticEvent, pattern.id, handle);
                        }}
                      />
                    );
                  })}
                </>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {patterns.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-gray-400 text-lg font-medium">
              Desen eklemek için "Ekle" butonuna tıklayın
            </div>
          </div>
        )}
      </div>
          );
        })()}
      </div>
      </div>
    </div>
  );
};
