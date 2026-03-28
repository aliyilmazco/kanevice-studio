# Contributing to Kanavice Studio

Thank you for your interest in contributing! This guide will help you get started.

## How to Contribute

### Reporting Bugs

1. Check [existing issues](https://github.com/aliyilmazco/kanavice-studio/issues) to avoid duplicates
2. Open a new issue using the **Bug Report** template
3. Include steps to reproduce, expected vs. actual behavior, and browser info

### Suggesting Features

1. Open an issue using the **Feature Request** template
2. Describe the use case and why it would be useful

### Submitting Code

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Ensure the build passes:
   ```bash
   npm run typecheck
   npm run build
   ```
5. Commit with a clear message:
   ```bash
   git commit -m "feat: add pattern rotation support"
   ```
6. Push and open a Pull Request

## Development Setup

```bash
git clone https://github.com/<your-username>/kanavice-studio.git
cd kanavice-studio
npm install
npm run dev
```

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Purpose |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `style:` | Formatting, no logic change |
| `refactor:` | Code change that neither fixes a bug nor adds a feature |
| `perf:` | Performance improvement |
| `chore:` | Build process or auxiliary tool changes |

## Code Style

- TypeScript strict mode is enabled
- Use functional React components with hooks
- Use `useCallback` and `useMemo` for performance-critical code
- Keep the UI language in Turkish (the app targets Turkish crafters)
- Tailwind CSS for styling -- avoid inline styles unless necessary for dynamic values

## Project Architecture

- **App.tsx** -- Central state management, keyboard shortcuts, all business logic callbacks
- **Workspace.tsx** -- Canvas rendering, zoom/pan, drag-and-drop, snap-to-grid
- **ControlPanel.tsx** -- UI controls sidebar (fabric settings, pattern list, alignment tools)
- **StatsPanel.tsx** -- Read-only stats display
- **useUndoable.ts** -- Generic undo/redo hook using `useReducer`

State is split into:
- **Undoable state** (fabric, patterns, groups) -- managed by `useUndoable`
- **Non-undoable state** (selection, clipboard, snap toggle) -- regular `useState`

## Code of Conduct

Please be respectful and constructive in all interactions. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
