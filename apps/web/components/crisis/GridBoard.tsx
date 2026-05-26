"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import GridLayout, { type LayoutItem } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

/** Width-aware react-grid-layout wrapper (matches atlas-lovable's grid). */
export default function GridBoard({
  layout,
  cols = 12,
  rowHeight = 70,
  margin = [12, 12],
  isDraggable,
  isResizable,
  draggableHandle,
  draggableCancel,
  onLayoutChange,
  children,
}: {
  layout: LayoutItem[];
  cols?: number;
  rowHeight?: number;
  margin?: [number, number];
  isDraggable?: boolean;
  isResizable?: boolean;
  draggableHandle?: string;
  draggableCancel?: string;
  onLayoutChange?: (l: LayoutItem[]) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full">
      <GridLayout
        className="layout"
        layout={layout}
        cols={cols}
        rowHeight={rowHeight}
        width={width}
        margin={margin}
        isDraggable={isDraggable}
        isResizable={isResizable}
        draggableHandle={draggableHandle}
        draggableCancel={draggableCancel}
        compactType="vertical"
        onLayoutChange={
          onLayoutChange ? (l) => onLayoutChange(l as unknown as LayoutItem[]) : undefined
        }
      >
        {children}
      </GridLayout>
    </div>
  );
}
