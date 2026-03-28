import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Upload, Trash2, Move, LayoutGrid, Settings, FileImage, Plus, Check, Copy, Clipboard, FlipHorizontal, FlipVertical, AlignLeft, AlignRight, AlignStartVertical, AlignEndVertical, AlignHorizontalDistributeCenter, AlignVerticalDistributeCenter, AlignCenterHorizontal, AlignCenterVertical, FolderPlus, Folder, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight, ArrowDownLeft, ArrowDownRight, Maximize2, LayoutTemplate, Undo2, Redo2, Download, Upload as UploadIcon, Magnet, Lock, Unlock, Pencil, Layers, ChevronsUp, ChevronsDown, Palette } from 'lucide-react';
import { FabricSettings, PatternItem, GridCalculations, PatternGroup } from '../types';
import { InputGroup } from './InputGroup';

interface ControlPanelProps {
  fabric: FabricSettings;
  setFabric: (updater: FabricSettings | ((prev: FabricSettings) => FabricSettings)) => void;
  patterns: PatternItem[];
  selectedPatternIds: string[];
  onSelectPattern: (id: string, isShiftKey?: boolean) => void;
  onAddPattern: () => void;
  onRemovePattern: (id: string) => void;
  onUpdatePattern: (id: string, updates: Partial<PatternItem>) => void;
  onCenterPattern: (id: string) => void;
  onCopyPatterns: () => void;
  onPastePatterns: () => void;
  onDuplicatePatterns: () => void;
  onMirrorPatterns: (direction: 'horizontal' | 'vertical') => void;
  onSetMarginPreset: (preset: 'wide' | 'normal' | 'narrow' | number) => void;
  onDistributePatterns: (direction: 'horizontal' | 'vertical') => void;
  onAlignPatterns: (alignment: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => void;
  groups: PatternGroup[];
  onCreateGroup: (name?: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onRenameGroup: (groupId: string, newName: string) => void;
  onMoveGroup: (groupId: string, deltaX: number, deltaY: number) => void;
  onAlignToCanvas: (position: 'topLeft' | 'topCenter' | 'topRight' | 'centerLeft' | 'center' | 'centerRight' | 'bottomLeft' | 'bottomCenter' | 'bottomRight', margin: number) => void;
  onDistributeAcrossCanvas: (direction: 'horizontal' | 'vertical', margin: number) => void;
  clipboard: PatternItem[];
  grid: GridCalculations;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExport: () => void;
  onImport: (file: File) => void;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  onToggleLock: (id: string) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onAddToGroup: (patternId: string, groupId: string) => void;
  onRemoveFromGroup: (patternId: string, groupId: string) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  fabric,
  setFabric,
  patterns,
  selectedPatternIds,
  onSelectPattern,
  onAddPattern,
  onRemovePattern,
  onUpdatePattern,
  onCenterPattern,
  onCopyPatterns,
  onPastePatterns,
  onDuplicatePatterns,
  onMirrorPatterns,
  onSetMarginPreset,
  onDistributePatterns,
  onAlignPatterns,
  groups,
  onCreateGroup,
  onDeleteGroup,
  onSelectGroup,
  onRenameGroup,
  onMoveGroup,
  onAlignToCanvas,
  onDistributeAcrossCanvas,
  clipboard,
  grid,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExport,
  onImport,
  snapEnabled,
  onToggleSnap,
  onToggleLock,
  onBringToFront,
  onSendToBack,
  onAddToGroup,
  onRemoveFromGroup
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const imageUrlsRef = useRef<Map<string, string>>(new Map());
  const [canvasMargin, setCanvasMargin] = useState(20);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Get first selected pattern for detail view
  const selectedPatternId = selectedPatternIds[0] || null;
  const selectedPattern = patterns.find(p => p.id === selectedPatternId);

  // Calculate unit count (groups + ungrouped patterns)
  const selectedUnitCount = React.useMemo(() => {
    const patternsInGroups = new Set<string>();
    let groupCount = 0;

    groups.forEach(group => {
      const groupPatternIds = group.patternIds.filter(id => patterns.some(p => p.id === id));
      const allSelected = groupPatternIds.every(id => selectedPatternIds.includes(id));
      if (allSelected && groupPatternIds.length > 0) {
        groupCount++;
        groupPatternIds.forEach(id => patternsInGroups.add(id));
      }
    });

    const ungroupedCount = selectedPatternIds.filter(id => !patternsInGroups.has(id)).length;
    return groupCount + ungroupedCount;
  }, [patterns, selectedPatternIds, groups]);

  // Calculate max offset values for boundary control
  const maxOffsetX = selectedPattern
    ? Math.max(0, Math.floor(grid.totalStitchesX - selectedPattern.widthStitches))
    : 0;
  const maxOffsetY = selectedPattern
    ? Math.max(0, Math.floor(grid.totalStitchesY - selectedPattern.heightStitches))
    : 0;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedPatternId) {
      // Cleanup previous URL if exists
      const oldUrl = imageUrlsRef.current.get(selectedPatternId);
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
      }

      const url = URL.createObjectURL(file);
      imageUrlsRef.current.set(selectedPatternId, url);

      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.height / img.width;
        const currentWidth = selectedPattern?.widthStitches || 200;

        onUpdatePattern(selectedPatternId, {
          imageSrc: url,
          widthStitches: currentWidth,
          heightStitches: Math.round(currentWidth * aspectRatio)
        });
      };
      img.src = url;
    }
    // Reset input
    if (e.target) e.target.value = '';
  };

  const handleRemoveImage = useCallback(() => {
    if (selectedPatternId) {
      const oldUrl = imageUrlsRef.current.get(selectedPatternId);
      if (oldUrl) {
        URL.revokeObjectURL(oldUrl);
        imageUrlsRef.current.delete(selectedPatternId);
      }
      onUpdatePattern(selectedPatternId, { imageSrc: null });
    }
  }, [selectedPatternId, onUpdatePattern]);

  const handleWidthChange = (newWidth: number) => {
    if (!selectedPattern || !selectedPatternId) return;

    if (selectedPattern.imageSrc && selectedPattern.widthStitches > 0) {
      const ratio = selectedPattern.heightStitches / selectedPattern.widthStitches;
      onUpdatePattern(selectedPatternId, {
        widthStitches: newWidth,
        heightStitches: Math.round(newWidth * ratio)
      });
    } else {
      onUpdatePattern(selectedPatternId, { widthStitches: newWidth });
    }
  };

  const handleHeightChange = (newHeight: number) => {
    if (!selectedPattern || !selectedPatternId) return;

    if (selectedPattern.imageSrc && selectedPattern.heightStitches > 0) {
      const ratio = selectedPattern.widthStitches / selectedPattern.heightStitches;
      onUpdatePattern(selectedPatternId, {
        heightStitches: newHeight,
        widthStitches: Math.round(newHeight * ratio)
      });
    } else {
      onUpdatePattern(selectedPatternId, { heightStitches: newHeight });
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    if (e.target) e.target.value = '';
  };

  const updateFabric = (key: keyof FabricSettings, val: number) => {
    setFabric(prev => ({ ...prev, [key]: val }));
  };

  const updateOffset = (axis: 'offsetX' | 'offsetY', val: number) => {
    if (!selectedPatternId) return;
    const max = axis === 'offsetX' ? maxOffsetX : maxOffsetY;
    const clampedVal = Math.max(0, Math.min(val, max));
    onUpdatePattern(selectedPatternId, { [axis]: clampedVal });
  };

  const handlePatternClick = (e: React.MouseEvent, patternId: string) => {
    onSelectPattern(patternId, e.shiftKey);
  };

  return (
    <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto shadow-lg z-10">
      <div className="p-5 border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          Proje Ayarları
        </h1>
        <p className="text-xs text-gray-500 mt-1">Kumaş ve şablon detaylarını giriniz.</p>

        {/* Toolbar: Undo/Redo, Snap, Save/Load */}
        <div className="flex items-center gap-1 mt-3 flex-wrap" role="toolbar" aria-label="Proje araçları">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
            title="Geri Al (Ctrl+Z)"
            aria-label="Geri Al"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 transition-colors"
            title="İleri Al (Ctrl+Shift+Z)"
            aria-label="İleri Al"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <button
            onClick={onToggleSnap}
            className={`p-1.5 rounded transition-colors ${
              snapEnabled
                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                : 'text-gray-400 hover:bg-gray-100'
            }`}
            title={snapEnabled ? 'Yapışma Açık' : 'Yapışma Kapalı'}
            aria-label={snapEnabled ? 'Yapışmayı kapat' : 'Yapışmayı aç'}
            aria-pressed={snapEnabled}
          >
            <Magnet className="w-4 h-4" />
          </button>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <button
            onClick={onExport}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
            title="Projeyi Dışa Aktar (JSON)"
            aria-label="Projeyi dışa aktar"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => importInputRef.current?.click()}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-600 transition-colors"
            title="Proje İçe Aktar (JSON)"
            aria-label="Proje içe aktar"
          >
            <UploadIcon className="w-4 h-4" />
          </button>
          <input
            type="file"
            ref={importInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      </div>

      <div className="p-5 space-y-6 flex-1">

        {/* Fabric Section */}
        <section>
          <h2 className="text-sm font-bold text-indigo-900 flex items-center gap-2 mb-4">
            <LayoutGrid className="w-4 h-4" />
            Kumaş (Canvas) Boyutu
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <InputGroup
              label="Genişlik"
              value={fabric.widthCm}
              onChange={(v) => updateFabric('widthCm', v)}
              unit="cm"
            />
            <InputGroup
              label="Yükseklik"
              value={fabric.heightCm}
              onChange={(v) => updateFabric('heightCm', v)}
              unit="cm"
            />
          </div>
          <div className="mt-4">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">Kumaş Sıklığı (Count)</label>
            <select
              value={fabric.count}
              onChange={(e) => updateFabric('count', Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value={11}>11 CT (4.3 ilmek/cm)</option>
              <option value={14}>14 CT (5.5 ilmek/cm)</option>
              <option value={16}>16 CT (6.3 ilmek/cm)</option>
              <option value={18}>18 CT (7.1 ilmek/cm)</option>
              <option value={20}>20 CT (7.9 ilmek/cm)</option>
              <option value={25}>25 CT (9.8 ilmek/cm)</option>
              <option value={28}>28 CT (11 ilmek/cm)</option>
            </select>
          </div>
          <div className="mt-3 p-2 bg-gray-50 rounded-md text-xs text-gray-600">
            Toplam: {grid.totalStitchesX} x {grid.totalStitchesY} ilmek
          </div>
        </section>

        <hr className="border-dashed border-gray-200" />

        {/* Patterns List Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
              <FileImage className="w-4 h-4" />
              Desenler ({patterns.length})
            </h2>
            <div className="flex gap-1">
              {clipboard.length > 0 && (
                <button
                  onClick={onPastePatterns}
                  className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs font-semibold rounded-md hover:bg-green-700 transition-colors"
                  title="Yapıştır (Ctrl+V)"
                >
                  <Clipboard className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={onAddPattern}
                className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-md hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-3 h-3" />
                Ekle
              </button>
            </div>
          </div>

          {/* Selection info */}
          {selectedPatternIds.length > 1 && (
            <div className="mb-2 p-2 bg-blue-50 rounded-md text-xs text-blue-700">
              {selectedPatternIds.length} desen seçili (Shift+Click ile çoklu seçim)
            </div>
          )}

          {/* Pattern List */}
          <div className="space-y-2 max-h-60 overflow-y-auto" role="listbox" aria-label="Desenler" aria-multiselectable="true">
            {patterns.map((pattern) => (
              <div
                key={pattern.id}
                onClick={(e) => handlePatternClick(e, pattern.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePatternClick(e as unknown as React.MouseEvent, pattern.id); } }}
                role="option"
                tabIndex={0}
                aria-selected={selectedPatternIds.includes(pattern.id)}
                className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                  selectedPatternIds.includes(pattern.id)
                    ? 'bg-indigo-100 border-2 border-indigo-500'
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                {pattern.imageSrc ? (
                  <img
                    src={pattern.imageSrc}
                    alt={pattern.name}
                    className="w-8 h-8 object-cover rounded"
                    style={{
                      transform: `scaleX(${pattern.flipHorizontal ? -1 : 1}) scaleY(${pattern.flipVertical ? -1 : 1})`
                    }}
                  />
                ) : (
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center"
                    style={{ backgroundColor: pattern.color ? pattern.color + '33' : '#c7d2fe' }}
                  >
                    <FileImage className="w-4 h-4" style={{ color: pattern.color || '#4f46e5' }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{pattern.name}</p>
                  <p className="text-xs text-gray-500">
                    {pattern.widthStitches} x {pattern.heightStitches}
                    {(pattern.flipHorizontal || pattern.flipVertical) && (
                      <span className="ml-1 text-indigo-500">
                        {pattern.flipHorizontal && '↔'}
                        {pattern.flipVertical && '↕'}
                      </span>
                    )}
                  </p>
                </div>
                {pattern.locked && (
                  <span title="Kilitli"><Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /></span>
                )}
                {selectedPatternIds.includes(pattern.id) && (
                  <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>

          {patterns.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              Henüz desen eklenmedi
            </div>
          )}
        </section>

        {/* Actions for selected patterns */}
        {selectedPatternIds.length > 0 && (
          <>
            <hr className="border-dashed border-gray-200" />

            <section>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                İşlemler {selectedPatternIds.length > 1 && `(${selectedPatternIds.length} desen)`}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onCopyPatterns}
                  className="flex items-center justify-center gap-1 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md text-xs font-semibold transition-colors"
                  title="Kopyala (Ctrl+C)"
                >
                  <Copy className="w-3 h-3" />
                  Kopyala
                </button>
                <button
                  onClick={onDuplicatePatterns}
                  className="flex items-center justify-center gap-1 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md text-xs font-semibold transition-colors"
                  title="Çoğalt (Ctrl+D)"
                >
                  <Plus className="w-3 h-3" />
                  Çoğalt
                </button>
                <button
                  onClick={() => onMirrorPatterns('horizontal')}
                  className="flex items-center justify-center gap-1 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md text-xs font-semibold transition-colors"
                  title="Yatay Çevir"
                >
                  <FlipHorizontal className="w-3 h-3" />
                  Yatay
                </button>
                <button
                  onClick={() => onMirrorPatterns('vertical')}
                  className="flex items-center justify-center gap-1 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md text-xs font-semibold transition-colors"
                  title="Dikey Çevir"
                >
                  <FlipVertical className="w-3 h-3" />
                  Dikey
                </button>
              </div>

              {/* Z-Order */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  onClick={onBringToFront}
                  className="flex items-center justify-center gap-1 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-md text-xs font-semibold transition-colors"
                  title="Öne Getir"
                >
                  <ChevronsUp className="w-3 h-3" />
                  Öne Getir
                </button>
                <button
                  onClick={onSendToBack}
                  className="flex items-center justify-center gap-1 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-md text-xs font-semibold transition-colors"
                  title="Arkaya Gönder"
                >
                  <ChevronsDown className="w-3 h-3" />
                  Arkaya Gönder
                </button>
              </div>

              {/* Margin Presets */}
              <div className="mt-4">
                <h4 className="text-xs font-medium text-gray-400 mb-2">Kenar Boşluğu Presetleri</h4>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => onSetMarginPreset('wide')}
                    className="py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded text-xs font-medium transition-colors"
                    title="80 ilmek kenar boşluğu"
                  >
                    Geniş
                  </button>
                  <button
                    onClick={() => onSetMarginPreset('normal')}
                    className="py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded text-xs font-medium transition-colors"
                    title="50 ilmek kenar boşluğu"
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => onSetMarginPreset('narrow')}
                    className="py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded text-xs font-medium transition-colors"
                    title="20 ilmek kenar boşluğu"
                  >
                    Dar
                  </button>
                </div>
              </div>

              {/* Alignment (2+ units) */}
              {selectedUnitCount >= 2 && (
                <div className="mt-4 space-y-3">
                  <h4 className="text-xs font-medium text-gray-400">Hizalama ({selectedUnitCount} birim)</h4>
                  <div className="grid grid-cols-6 gap-1">
                    <button
                      onClick={() => onAlignPatterns('left')}
                      className="p-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded transition-colors"
                      title="Sola Hizala"
                      aria-label="Sola hizala"
                    >
                      <AlignLeft className="w-3 h-3 mx-auto" />
                    </button>
                    <button
                      onClick={() => onAlignPatterns('centerH')}
                      className="p-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded transition-colors"
                      title="Yatay Ortala"
                      aria-label="Yatay ortala"
                    >
                      <AlignCenterHorizontal className="w-3 h-3 mx-auto" />
                    </button>
                    <button
                      onClick={() => onAlignPatterns('right')}
                      className="p-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded transition-colors"
                      title="Sağa Hizala"
                      aria-label="Sağa hizala"
                    >
                      <AlignRight className="w-3 h-3 mx-auto" />
                    </button>
                    <button
                      onClick={() => onAlignPatterns('top')}
                      className="p-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded transition-colors"
                      title="Üste Hizala"
                      aria-label="Üste hizala"
                    >
                      <AlignStartVertical className="w-3 h-3 mx-auto" />
                    </button>
                    <button
                      onClick={() => onAlignPatterns('centerV')}
                      className="p-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded transition-colors"
                      title="Dikey Ortala"
                      aria-label="Dikey ortala"
                    >
                      <AlignCenterVertical className="w-3 h-3 mx-auto" />
                    </button>
                    <button
                      onClick={() => onAlignPatterns('bottom')}
                      className="p-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded transition-colors"
                      title="Alta Hizala"
                      aria-label="Alta hizala"
                    >
                      <AlignEndVertical className="w-3 h-3 mx-auto" />
                    </button>
                  </div>
                </div>
              )}

              {/* Distribution (3+ units) */}
              {selectedUnitCount >= 3 && (
                <div className="mt-4 space-y-3">
                  <h4 className="text-xs font-medium text-gray-400">Eşit Dağıt ({selectedUnitCount} birim)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onDistributePatterns('horizontal')}
                      className="flex items-center justify-center gap-1 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-md text-xs font-semibold transition-colors"
                      title="Yatay Eşit Dağıt"
                    >
                      <AlignHorizontalDistributeCenter className="w-3 h-3" />
                      Yatay
                    </button>
                    <button
                      onClick={() => onDistributePatterns('vertical')}
                      className="flex items-center justify-center gap-1 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-md text-xs font-semibold transition-colors"
                      title="Dikey Eşit Dağıt"
                    >
                      <AlignVerticalDistributeCenter className="w-3 h-3" />
                      Dikey
                    </button>
                  </div>
                </div>
              )}

              {/* Canvas Alignment */}
              <div className="mt-4 space-y-3 p-3 bg-gradient-to-br from-cyan-50 to-teal-50 rounded-lg border border-cyan-200">
                <div className="flex items-center gap-2">
                  <LayoutTemplate className="w-4 h-4 text-cyan-700" />
                  <h4 className="text-xs font-semibold text-cyan-800">Canvas'a Hizala</h4>
                </div>

                {/* Margin Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-cyan-700">Kenar Boşluğu</label>
                    <span className="text-xs font-medium text-cyan-800">{canvasMargin} ilmek</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={canvasMargin}
                    onChange={(e) => setCanvasMargin(Number(e.target.value))}
                    className="w-full h-1.5 bg-cyan-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                    aria-label={`Kenar boşluğu: ${canvasMargin} ilmek`}
                  />
                </div>

                {/* 3x3 Position Grid */}
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => onAlignToCanvas('topLeft', canvasMargin)}
                    className="p-2 bg-cyan-100 text-cyan-700 hover:bg-cyan-200 rounded transition-colors"
                    title="Sol Üst"
                    aria-label="Sol üst köşeye hizala"
                  >
                    <ArrowUpLeft className="w-3.5 h-3.5 mx-auto" />
                  </button>
                  <button
                    onClick={() => onAlignToCanvas('topCenter', canvasMargin)}
                    className="p-2 bg-cyan-100 text-cyan-700 hover:bg-cyan-200 rounded transition-colors"
                    title="Üst Orta"
                    aria-label="Üst ortaya hizala"
                  >
                    <ArrowUp className="w-3.5 h-3.5 mx-auto" />
                  </button>
                  <button
                    onClick={() => onAlignToCanvas('topRight', canvasMargin)}
                    className="p-2 bg-cyan-100 text-cyan-700 hover:bg-cyan-200 rounded transition-colors"
                    title="Sağ Üst"
                    aria-label="Sağ üst köşeye hizala"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 mx-auto" />
                  </button>
                  <button
                    onClick={() => onAlignToCanvas('centerLeft', canvasMargin)}
                    className="p-2 bg-cyan-100 text-cyan-700 hover:bg-cyan-200 rounded transition-colors"
                    title="Sol Orta"
                    aria-label="Sol ortaya hizala"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mx-auto" />
                  </button>
                  <button
                    onClick={() => onAlignToCanvas('center', canvasMargin)}
                    className="p-2 bg-cyan-200 text-cyan-800 hover:bg-cyan-300 rounded transition-colors"
                    title="Tam Ortala"
                    aria-label="Tam ortala"
                  >
                    <Maximize2 className="w-3.5 h-3.5 mx-auto" />
                  </button>
                  <button
                    onClick={() => onAlignToCanvas('centerRight', canvasMargin)}
                    className="p-2 bg-cyan-100 text-cyan-700 hover:bg-cyan-200 rounded transition-colors"
                    title="Sağ Orta"
                    aria-label="Sağ ortaya hizala"
                  >
                    <ArrowRight className="w-3.5 h-3.5 mx-auto" />
                  </button>
                  <button
                    onClick={() => onAlignToCanvas('bottomLeft', canvasMargin)}
                    className="p-2 bg-cyan-100 text-cyan-700 hover:bg-cyan-200 rounded transition-colors"
                    title="Sol Alt"
                    aria-label="Sol alt köşeye hizala"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5 mx-auto" />
                  </button>
                  <button
                    onClick={() => onAlignToCanvas('bottomCenter', canvasMargin)}
                    className="p-2 bg-cyan-100 text-cyan-700 hover:bg-cyan-200 rounded transition-colors"
                    title="Alt Orta"
                    aria-label="Alt ortaya hizala"
                  >
                    <ArrowDown className="w-3.5 h-3.5 mx-auto" />
                  </button>
                  <button
                    onClick={() => onAlignToCanvas('bottomRight', canvasMargin)}
                    className="p-2 bg-cyan-100 text-cyan-700 hover:bg-cyan-200 rounded transition-colors"
                    title="Sağ Alt"
                    aria-label="Sağ alt köşeye hizala"
                  >
                    <ArrowDownRight className="w-3.5 h-3.5 mx-auto" />
                  </button>
                </div>

                {/* Canvas Distribution (2+ units) */}
                {selectedUnitCount >= 2 && (
                  <div className="pt-2 border-t border-cyan-200">
                    <h5 className="text-xs text-cyan-700 mb-2">Canvas Boyunca Dağıt</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onDistributeAcrossCanvas('horizontal', canvasMargin)}
                        className="flex items-center justify-center gap-1 py-1.5 bg-teal-100 text-teal-700 hover:bg-teal-200 rounded text-xs font-medium transition-colors"
                        title="Yatay Dağıt (Canvas)"
                      >
                        <AlignHorizontalDistributeCenter className="w-3 h-3" />
                        Yatay
                      </button>
                      <button
                        onClick={() => onDistributeAcrossCanvas('vertical', canvasMargin)}
                        className="flex items-center justify-center gap-1 py-1.5 bg-teal-100 text-teal-700 hover:bg-teal-200 rounded text-xs font-medium transition-colors"
                        title="Dikey Dağıt (Canvas)"
                      >
                        <AlignVerticalDistributeCenter className="w-3 h-3" />
                        Dikey
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* Selected Pattern Details */}
        {selectedPattern && selectedPatternIds.length === 1 && (
          <>
            <hr className="border-dashed border-gray-200" />

            <section>
              <h2 className="text-sm font-bold text-indigo-900 mb-4">
                Seçili Desen: {selectedPattern.name}
              </h2>

              {/* Pattern Name */}
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">Desen Adı</label>
                <input
                  type="text"
                  value={selectedPattern.name}
                  onChange={(e) => onUpdatePattern(selectedPatternId!, { name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              {/* Image Upload */}
              {!selectedPattern.imageSrc ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors group"
                >
                  <Upload className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 mb-1" />
                  <span className="text-sm text-gray-600 font-medium">Görsel Yükle</span>
                  <span className="text-xs text-gray-400">JPG, PNG</span>
                </div>
              ) : (
                <div className="relative group rounded-xl overflow-hidden border border-gray-200 shadow-sm mb-4">
                  <img
                    src={selectedPattern.imageSrc}
                    alt="Pattern"
                    className="w-full h-24 object-cover object-center opacity-80"
                    style={{
                      transform: `scaleX(${selectedPattern.flipHorizontal ? -1 : 1}) scaleY(${selectedPattern.flipVertical ? -1 : 1})`
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={handleRemoveImage}
                      className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 shadow-sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />

              {/* Pattern Size */}
              <div className="mt-4 grid grid-cols-2 gap-4">
                <InputGroup
                  label="Genişlik"
                  value={selectedPattern.widthStitches}
                  onChange={handleWidthChange}
                  unit="ilmek"
                />
                <InputGroup
                  label="Yükseklik"
                  value={selectedPattern.heightStitches}
                  onChange={handleHeightChange}
                  unit="ilmek"
                />
              </div>

              {/* Pattern Position */}
              <div className="mt-4 space-y-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Konumlandırma</h3>
                <div className="grid grid-cols-2 gap-2">
                  <InputGroup
                    label="Sol X"
                    value={selectedPattern.offsetX}
                    onChange={(v) => updateOffset('offsetX', v)}
                    unit="ilmek"
                    min={0}
                    max={maxOffsetX}
                  />
                  <InputGroup
                    label="Üst Y"
                    value={selectedPattern.offsetY}
                    onChange={(v) => updateOffset('offsetY', v)}
                    unit="ilmek"
                    min={0}
                    max={maxOffsetY}
                  />
                </div>

                <button
                  onClick={() => onCenterPattern(selectedPatternId!)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-md text-sm font-semibold transition-colors"
                >
                  <Move className="w-4 h-4" />
                  Otomatik Ortala
                </button>
              </div>

              {/* Pattern Color (non-image only) */}
              {!selectedPattern.imageSrc && (
                <div className="mt-4">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">
                    <Palette className="w-3 h-3 inline mr-1" />
                    Desen Rengi
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={selectedPattern.color || '#6366f1'}
                      onChange={(e) => onUpdatePattern(selectedPatternId!, { color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-300"
                      aria-label="Desen rengi seç"
                    />
                    {selectedPattern.color && (
                      <button
                        onClick={() => onUpdatePattern(selectedPatternId!, { color: undefined })}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Varsayılan
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Opacity */}
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1 block">
                  Görünürlük: {Math.round(selectedPattern.opacity * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={selectedPattern.opacity}
                  onChange={(e) => onUpdatePattern(selectedPatternId!, { opacity: Number(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  aria-label={`Görünürlük: ${Math.round(selectedPattern.opacity * 100)}%`}
                />
              </div>

              {/* Lock Toggle */}
              <button
                onClick={() => onToggleLock(selectedPatternId!)}
                className={`mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-md text-sm font-semibold transition-colors ${
                  selectedPattern.locked
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {selectedPattern.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                {selectedPattern.locked ? 'Kilidi Aç' : 'Kilitle'}
              </button>

              {/* Group membership */}
              {groups.length > 0 && (
                <div className="mt-4">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
                    Grup Üyeliği
                  </label>
                  <div className="space-y-1">
                    {groups.map(group => {
                      const isMember = group.patternIds.includes(selectedPatternId!);
                      return (
                        <div key={group.id} className="flex items-center justify-between p-1.5 rounded bg-gray-50">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: group.color }}
                            />
                            <span className="text-xs text-gray-700 truncate">{group.name}</span>
                          </div>
                          {isMember ? (
                            <button
                              onClick={() => onRemoveFromGroup(selectedPatternId!, group.id)}
                              className="text-xs text-red-600 hover:text-red-800 px-1.5 py-0.5 hover:bg-red-50 rounded transition-colors"
                            >
                              Çıkar
                            </button>
                          ) : (
                            <button
                              onClick={() => onAddToGroup(selectedPatternId!, group.id)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 px-1.5 py-0.5 hover:bg-indigo-50 rounded transition-colors"
                            >
                              Ekle
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Delete Pattern */}
              <button
                onClick={() => onRemovePattern(selectedPatternId!)}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-md text-sm font-semibold transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Deseni Sil
              </button>
            </section>
          </>
        )}

        {/* Groups Section */}
        <hr className="border-dashed border-gray-200" />
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
              <Folder className="w-4 h-4" />
              Gruplar ({groups.length})
            </h2>
            {selectedPatternIds.length >= 2 && (
              <button
                onClick={() => onCreateGroup()}
                className="flex items-center gap-1 px-2 py-1 bg-violet-600 text-white text-xs font-semibold rounded-md hover:bg-violet-700 transition-colors"
                title="Seçili desenleri grupla"
              >
                <FolderPlus className="w-3 h-3" />
                Grupla
              </button>
            )}
          </div>

          {groups.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">
              {selectedPatternIds.length >= 2
                ? 'Seçili desenleri gruplamak için "Grupla" butonuna tıklayın'
                : '2+ desen seçerek grup oluşturabilirsiniz'}
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="rounded-md bg-gray-50 border-l-4 overflow-hidden"
                  style={{ borderLeftColor: group.color }}
                >
                  {/* Group Header */}
                  <div
                    className="flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => onSelectGroup(group.id)}
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <div className="flex-1 min-w-0">
                      {editingGroupId === group.id ? (
                        <input
                          type="text"
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          onBlur={() => {
                            if (editingGroupName.trim()) {
                              onRenameGroup(group.id, editingGroupName.trim());
                            }
                            setEditingGroupId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (editingGroupName.trim()) {
                                onRenameGroup(group.id, editingGroupName.trim());
                              }
                              setEditingGroupId(null);
                            } else if (e.key === 'Escape') {
                              setEditingGroupId(null);
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="w-full text-sm font-medium text-gray-800 border border-indigo-300 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        <p className="text-sm font-medium text-gray-800 truncate">{group.name}</p>
                      )}
                      <p className="text-xs text-gray-500">{group.patternIds.length} desen</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingGroupId(group.id);
                        setEditingGroupName(group.name);
                      }}
                      className="p-1 hover:bg-indigo-100 rounded text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Grubu yeniden adlandır"
                      aria-label={`${group.name} grubunu yeniden adlandır`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteGroup(group.id);
                      }}
                      className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600 transition-colors"
                      title="Grubu sil"
                      aria-label={`${group.name} grubunu sil`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Group Movement Controls */}
                  <div className="px-2 pb-2 pt-1 border-t border-gray-200 bg-gray-100/50">
                    <p className="text-xs text-gray-400 mb-2">Grubu Taşı (10 ilmek)</p>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveGroup(group.id, -10, 0);
                        }}
                        className="p-1.5 bg-white border border-gray-200 rounded hover:bg-gray-50 text-gray-600 transition-colors"
                        title="Sola taşı"
                        aria-label="Grubu sola taşı"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveGroup(group.id, 0, -10);
                          }}
                          className="p-1.5 bg-white border border-gray-200 rounded hover:bg-gray-50 text-gray-600 transition-colors"
                          title="Yukarı taşı"
                          aria-label="Grubu yukarı taşı"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveGroup(group.id, 0, 10);
                          }}
                          className="p-1.5 bg-white border border-gray-200 rounded hover:bg-gray-50 text-gray-600 transition-colors"
                          title="Aşağı taşı"
                          aria-label="Grubu aşağı taşı"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveGroup(group.id, 10, 0);
                        }}
                        className="p-1.5 bg-white border border-gray-200 rounded hover:bg-gray-50 text-gray-600 transition-colors"
                        title="Sağa taşı"
                        aria-label="Grubu sağa taşı"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center">
          Ctrl+Z/Shift+Z Geri/İleri, Ctrl+C/V/D Kopyala/Yapıştır/Çoğalt, Ctrl+A Tümünü Seç, Ctrl+L Kilitle, Ctrl++/-/0 Zoom, Ok tuşları Taşı, Esc Seçimi Kaldır
        </p>
      </div>
    </div>
  );
};
