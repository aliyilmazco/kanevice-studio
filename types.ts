export interface FabricSettings {
  widthCm: number;
  heightCm: number;
  count: number; // e.g., 14ct, 16ct, 18ct
}

export interface PatternItem {
  id: string;
  name: string;
  widthStitches: number;
  heightStitches: number;
  offsetX: number; // Stitches from left
  offsetY: number; // Stitches from top
  imageSrc: string | null;
  opacity: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  locked?: boolean;
  color?: string; // Hex color for non-image patterns
}

export interface GridCalculations {
  totalStitchesX: number;
  totalStitchesY: number;
  pixelsPerStitch: number; // For visualization scaling
  stitchPerCm: number;
}

export interface PatternGroup {
  id: string;
  name: string;
  patternIds: string[];
  color: string; // Hex color for visual distinction
}
