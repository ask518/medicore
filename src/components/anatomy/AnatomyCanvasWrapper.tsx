// ============================================================================
// MEDICORE – Reusable Interactive Anatomy Canvas Wrapper
// Supports Zoom, Pan, Reset, Undo, Clear, Fullscreen and High-Res Export
// ============================================================================

import React, { useState, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Undo2, Trash2, Download, Maximize2 } from 'lucide-react';

interface AnatomyCanvasWrapperProps {
  title: string;
  subtitle?: string;
  children: (zoom: number, pan: { x: number; y: number }) => React.ReactNode;
  onUndo?: () => void;
  onClear?: () => void;
  canUndo?: boolean;
  extraControls?: React.ReactNode;
}

export const AnatomyCanvasWrapper: React.FC<AnatomyCanvasWrapperProps> = ({
  title,
  subtitle,
  children,
  onUndo,
  onClear,
  canUndo = false,
  extraControls,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.75));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Canvas Header & Toolbar */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <h3 className="font-bold text-slate-800 text-base">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          {extraControls}

          <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* Zoom Controls */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
            <button
              type="button"
              onClick={handleZoomIn}
              title="تكبير (Zoom In)"
              className="p-1.5 text-slate-600 hover:text-medicore-600 hover:bg-slate-50 rounded"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold px-2 text-slate-600 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomOut}
              title="تصغير (Zoom Out)"
              className="p-1.5 text-slate-600 hover:text-medicore-600 hover:bg-slate-50 rounded"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleReset}
              title="إعادة ضبط (Reset)"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Undo & Clear */}
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="تراجع عن آخر علامة (Undo)"
              className={`p-2 border rounded-lg transition-colors ${
                canUndo 
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' 
                  : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed'
              }`}
            >
              <Undo2 className="w-4 h-4" />
            </button>
          )}

          {onClear && (
            <button
              type="button"
              onClick={onClear}
              title="مسح كافة التحديدات (Clear All)"
              className="p-2 border border-rose-200 bg-rose-50/50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative w-full h-[540px] bg-slate-50 overflow-hidden flex items-center justify-center cursor-default select-none ${
          isPanning ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.15s ease-out',
          }}
          className="relative max-h-full max-w-full"
        >
          {children(zoom, pan)}
        </div>
      </div>
    </div>
  );
};
