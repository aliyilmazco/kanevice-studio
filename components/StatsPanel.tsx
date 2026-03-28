import React from 'react';
import { FabricSettings, PatternItem, GridCalculations } from '../types';
import { ArrowRightLeft, ArrowUpFromLine, Maximize, Ruler, Layers } from 'lucide-react';

interface StatsPanelProps {
  fabric: FabricSettings;
  patterns: PatternItem[];
  selectedPatterns: PatternItem[];
  grid: GridCalculations;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ fabric, patterns, selectedPatterns, grid }) => {
  // Use first selected pattern for single-pattern stats display
  const selectedPattern = selectedPatterns.length > 0 ? selectedPatterns[0] : null;

  // Conversions
  const stitchToCm = (stitch: number) => (stitch / Math.max(0.001, grid.stitchPerCm)).toFixed(1);

  // Calculate margins for selected pattern
  const marginLeft = selectedPattern ? selectedPattern.offsetX : 0;
  const marginTop = selectedPattern ? selectedPattern.offsetY : 0;
  const marginRight = selectedPattern
    ? grid.totalStitchesX - selectedPattern.widthStitches - selectedPattern.offsetX
    : grid.totalStitchesX;
  const marginBottom = selectedPattern
    ? grid.totalStitchesY - selectedPattern.heightStitches - selectedPattern.offsetY
    : grid.totalStitchesY;

  return (
    <div className="h-48 bg-white border-t border-gray-200 p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] grid grid-cols-1 md:grid-cols-4 gap-6 overflow-y-auto">

      {/* Summary */}
      <div className="border-r border-gray-100 pr-4">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
          <Maximize className="w-4 h-4 text-blue-500" />
          Toplam Alan
        </h3>
        <div className="space-y-1 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Genişlik:</span>
            <span className="font-semibold text-gray-900">{fabric.widthCm} cm / {grid.totalStitchesX} ilmek</span>
          </div>
          <div className="flex justify-between">
            <span>Yükseklik:</span>
            <span className="font-semibold text-gray-900">{fabric.heightCm} cm / {grid.totalStitchesY} ilmek</span>
          </div>
          <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              Desen:
            </span>
            <span className="font-semibold text-indigo-600">{patterns.length} adet</span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            1 cm ≈ {grid.stitchPerCm.toFixed(1)} ilmek ({fabric.count} CT)
          </div>
        </div>
      </div>

      {/* Selected Pattern Info or Empty State */}
      {selectedPattern ? (
        <>
          {/* Margins X */}
          <div className="border-r border-gray-100 pr-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
              <ArrowRightLeft className="w-4 h-4 text-green-500" />
              Yatay Boşluklar
            </h3>
            <div className="space-y-2">
              <div className="bg-gray-50 p-2 rounded flex justify-between items-center">
                <span className="text-xs font-medium text-gray-500">Sol</span>
                <div className="text-right">
                  <div className="font-bold text-gray-800">{stitchToCm(marginLeft)} cm</div>
                  <div className="text-xs text-gray-400">{Math.round(marginLeft)} ilmek</div>
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded flex justify-between items-center">
                <span className="text-xs font-medium text-gray-500">Sağ</span>
                <div className="text-right">
                  <div className="font-bold text-gray-800">{stitchToCm(marginRight)} cm</div>
                  <div className="text-xs text-gray-400">{Math.round(marginRight)} ilmek</div>
                </div>
              </div>
            </div>
          </div>

          {/* Margins Y */}
          <div className="border-r border-gray-100 pr-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
              <ArrowUpFromLine className="w-4 h-4 text-purple-500" />
              Dikey Boşluklar
            </h3>
            <div className="space-y-2">
              <div className="bg-gray-50 p-2 rounded flex justify-between items-center">
                <span className="text-xs font-medium text-gray-500">Üst</span>
                <div className="text-right">
                  <div className="font-bold text-gray-800">{stitchToCm(marginTop)} cm</div>
                  <div className="text-xs text-gray-400">{Math.round(marginTop)} ilmek</div>
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded flex justify-between items-center">
                <span className="text-xs font-medium text-gray-500">Alt</span>
                <div className="text-right">
                  <div className="font-bold text-gray-800">{stitchToCm(marginBottom)} cm</div>
                  <div className="text-xs text-gray-400">{Math.round(marginBottom)} ilmek</div>
                </div>
              </div>
            </div>
          </div>

          {/* Pattern Info */}
          <div className="pl-2">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-3">
              <Ruler className="w-4 h-4 text-orange-500" />
              {selectedPatterns.length > 1 ? 'Seçili Desenler' : selectedPattern.name}
              {selectedPatterns.length > 1 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                  {selectedPatterns.length} desen
                </span>
              )}
            </h3>
            {selectedPatterns.length > 1 ? (
              <div className="space-y-2 text-sm">
                {(() => {
                  const minX = Math.min(...selectedPatterns.map(p => p.offsetX));
                  const minY = Math.min(...selectedPatterns.map(p => p.offsetY));
                  const maxX = Math.max(...selectedPatterns.map(p => p.offsetX + p.widthStitches));
                  const maxY = Math.max(...selectedPatterns.map(p => p.offsetY + p.heightStitches));
                  const bboxW = maxX - minX;
                  const bboxH = maxY - minY;
                  const coverage = ((selectedPatterns.reduce((sum, p) => sum + p.widthStitches * p.heightStitches, 0)) / (grid.totalStitchesX * grid.totalStitchesY) * 100);
                  return (
                    <>
                      <div className="flex justify-between items-center border-b border-dashed border-gray-200 pb-2">
                        <span className="text-gray-500">Bounding Box</span>
                        <span className="font-medium text-gray-900">{bboxW} x {bboxH} ilmek</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-dashed border-gray-200 pb-2">
                        <span className="text-gray-500">Kaplama</span>
                        <span className="font-medium text-gray-900">%{coverage.toFixed(1)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center border-b border-dashed border-gray-200 pb-2">
                  <span className="text-gray-500">Genişlik</span>
                  <span className="font-medium text-gray-900">{selectedPattern.widthStitches} ilmek ({stitchToCm(selectedPattern.widthStitches)} cm)</span>
                </div>
                <div className="flex justify-between items-center border-b border-dashed border-gray-200 pb-2">
                  <span className="text-gray-500">Yükseklik</span>
                  <span className="font-medium text-gray-900">{selectedPattern.heightStitches} ilmek ({stitchToCm(selectedPattern.heightStitches)} cm)</span>
                </div>
                {selectedPattern.widthStitches > grid.totalStitchesX || selectedPattern.heightStitches > grid.totalStitchesY ? (
                  <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2 font-semibold">
                    Şablon kumaştan büyük!
                  </div>
                ) : (
                  <div className="text-xs text-green-600 bg-green-50 p-2 rounded mt-2 font-semibold">
                    Kumaşa sığıyor
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="col-span-3 flex items-center justify-center text-gray-400">
          {patterns.length === 0 ? (
            <span>Desen ekleyin</span>
          ) : (
            <span>Detayları görmek için bir desen seçin</span>
          )}
        </div>
      )}

    </div>
  );
};
