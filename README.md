<div align="center">

# Kanavice Studio

A visual cross-stitch pattern layout planner for fabric, prayer rugs, and embroidery projects.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?logo=vite&logoColor=white)](https://vitejs.dev/)

[Live Demo](https://kanevice.aliyilmaz.co/) | [Features](#features) | [Getting Started](#getting-started) | [Contributing](CONTRIBUTING.md)

</div>

---

## Demo

**[https://kanevice.aliyilmaz.co/](https://kanevice.aliyilmaz.co/)**

## About

**Kanavice Studio** is a browser-based visual planner for cross-stitch and embroidery projects. It helps crafters plan pattern placement on fabric, calculate spacing and margins, and visualize the final layout before starting to stitch.

The application is designed for the Turkish cross-stitch community. The UI is in **Turkish**.

## Features

### Fabric & Canvas
- **Fabric Configuration** -- Set fabric dimensions (cm) and thread count (11CT to 28CT)
- **Adaptive Grid** -- Grid density adjusts automatically when zooming out so lines stay visible at any zoom level
- **Center Crosshair** -- Visual center lines on the fabric for easy orientation

### Pattern Management
- **Multi-Pattern Support** -- Add, remove, duplicate, and manage multiple patterns on one fabric
- **Image Overlay** -- Upload pattern images with automatic aspect ratio lock
- **Mirror & Flip** -- Horizontal and vertical flip for patterns
- **Pattern Color** -- Assign custom colors to non-image patterns
- **Lock Patterns** -- Lock patterns to prevent accidental movement
- **Z-Order Control** -- Bring to front / send to back to control stacking order
- **Pattern Groups** -- Group patterns together for batch movement and alignment

### Drag & Drop
- **Visual Placement** -- Drag patterns on fabric with real-time margin calculations
- **Smart Snap Guides** -- Patterns snap to edges, centers, and other patterns with visual guide lines
- **Free Move (Shift + Drag)** -- Hold Shift while dragging to temporarily disable snap for precise free positioning
- **Multi-Select Drag** -- Select multiple patterns and move them together
- **Touch Support** -- Single finger drag and pinch-to-zoom on tablets

### Alignment & Layout
- **Pattern Alignment** -- Align selected patterns: left, right, top, bottom, center horizontal/vertical
- **Even Distribution** -- Distribute 3+ patterns evenly across horizontal or vertical axis
- **Canvas Alignment** -- Align patterns to any of the 9 canvas anchor points (corners, edges, center)
- **Canvas Distribution** -- Distribute patterns evenly across the full canvas with configurable margin
- **Margin Presets** -- Quick-set pattern offsets to wide (80), normal (50), or narrow (20) stitch margins

### Zoom & Navigation
- **Scroll Wheel Zoom** -- Ctrl/Cmd + scroll to zoom to cursor position
- **Pinch-to-Zoom** -- Two-finger pinch zoom on touch devices with zoom-to-center
- **Button Zoom** -- Zoom in, zoom out, fit-to-view, and reset to 100% buttons
- **Keyboard Zoom** -- Ctrl/Cmd + Plus/Minus/Zero shortcuts
- **Auto Fit** -- Automatically fits the view when fabric size changes

### History & Persistence
- **Undo / Redo** -- Full 50-step undo/redo history for all pattern and fabric changes
- **Smart History** -- Continuous operations (drag, nudge) are batched into single undo entries
- **Auto-Save** -- Projects auto-save to localStorage with debounced writes
- **Import / Export** -- Save and load complete projects as validated JSON files

### Stats & Info
- **Stats Panel** -- Real-time display of fabric dimensions, margins (cm and stitches), pattern sizes
- **Coverage Calculation** -- Shows total area coverage percentage for multi-selected patterns
- **Bounding Box** -- Displays combined bounding box for multi-selected patterns
- **Distance Lines** -- Visual distance indicators between selected pattern and neighbors
- **Fit Warning** -- Warns if a pattern is larger than the fabric

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/aliyilmazco/kanevice-editor.git
cd kanevice-editor

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Build for Production

```bash
npm run build
npm run preview   # Preview the production build locally
```

## Keyboard & Mouse Shortcuts

### General

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + Y` | Redo (Windows/Linux only) |

### Pattern Operations

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + C` | Copy selected patterns |
| `Ctrl/Cmd + V` | Paste copied patterns |
| `Ctrl/Cmd + D` | Duplicate selected patterns |
| `Ctrl/Cmd + A` | Select all patterns |
| `Ctrl/Cmd + L` | Toggle lock on selected pattern |
| `Delete / Backspace` | Remove selected patterns |
| `Escape` | Deselect all |

### Movement

| Shortcut | Action |
|---|---|
| `Arrow Keys` | Nudge selected patterns by 1 stitch |
| `Shift + Arrow Keys` | Nudge selected patterns by 10 stitches |
| `Drag` | Move pattern with snap-to-grid |
| `Shift + Drag` | Move pattern freely (snap disabled) |

### Selection

| Shortcut | Action |
|---|---|
| `Click` | Select a single pattern |
| `Shift + Click` | Add/remove pattern from selection |

### Zoom & View

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + +` | Zoom in |
| `Ctrl/Cmd + -` | Zoom out |
| `Ctrl/Cmd + 0` | Fit to view |
| `Ctrl/Cmd + Scroll` | Zoom to cursor position |
| `Pinch` | Zoom on touch devices |

## Tech Stack

- **[React 19](https://react.dev/)** -- UI framework
- **[TypeScript](https://www.typescriptlang.org/)** -- Type safety
- **[Vite](https://vitejs.dev/)** -- Build tool and dev server
- **[Tailwind CSS 4](https://tailwindcss.com/)** -- Utility-first styling
- **[Lucide React](https://lucide.dev/)** -- Icon library

## Project Structure

```
kanevice-editor/
├── App.tsx                  # Main application component
├── index.tsx                # Entry point
├── index.html               # HTML template
├── types.ts                 # TypeScript type definitions
├── style.css                # Global styles + Tailwind
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── components/
│   ├── ControlPanel.tsx     # Left sidebar (settings, pattern list, tools)
│   ├── Workspace.tsx        # Canvas area (grid, patterns, zoom, drag)
│   ├── StatsPanel.tsx       # Bottom stats bar (margins, dimensions)
│   └── InputGroup.tsx       # Reusable numeric input component
├── hooks/
│   └── useUndoable.ts       # Custom undo/redo state hook
└── public/
    └── favicon.svg          # App icon
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the [MIT License](LICENSE).
