/* ============================================================
   Window component — draggable, resizable, focusable, closeable
   ============================================================ */

import React, { useEffect, useRef } from 'react';

function Window({ win, onFocus, onClose, onMove, onResize, onMinimize, onToggleFullscreen, children }) {
  const dragState = useRef(null);
  const opening = useRef(true);

  useEffect(() => {
    const t = setTimeout(() => { opening.current = false; }, 240);
    return () => clearTimeout(t);
  }, []);

  const startDrag = (e) => {
    if (e.target.closest(".win-dot")) return;
    if (win.fullscreen) return;
    onFocus(win.id);
    const startX = e.clientX, startY = e.clientY;
    const origX = win.x, origY = win.y;
    dragState.current = { startX, startY, origX, origY };

    const move = (ev) => {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      onMove(win.id, {
        x: Math.max(-win.w + 80, dragState.current.origX + dx),
        y: Math.max(0, dragState.current.origY + dy),
      });
    };
    const up = () => {
      dragState.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const startResize = (e, dir) => {
    e.stopPropagation();
    e.preventDefault();
    if (win.fullscreen) return;
    onFocus(win.id);
    const startX = e.clientX, startY = e.clientY;
    const origX = win.x, origY = win.y, origW = win.w, origH = win.h;
    const minW = 340, minH = 220;

    const move = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      let x = origX, y = origY, w = origW, h = origH;
      if (dir.includes("e")) w = Math.max(minW, origW + dx);
      if (dir.includes("s")) h = Math.max(minH, origH + dy);
      if (dir.includes("w")) {
        const nw = Math.max(minW, origW - dx);
        x = origX + (origW - nw);
        w = nw;
      }
      if (dir.includes("n")) {
        const nh = Math.max(minH, origH - dy);
        y = Math.max(0, origY + (origH - nh));
        h = nh;
      }
      onResize(win.id, { x, y, w, h });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onDoubleClickTitle = (e) => {
    if (e.target.closest(".win-dot")) return;
    onToggleFullscreen(win.id);
  };

  return (
    <div
      className={[
        "window",
        win.focused ? "focused" : "",
        win.minimizing ? "minimizing" : "",
        opening.current ? "opening" : "",
        win.fullscreen ? "fullscreen" : "",
      ].filter(Boolean).join(" ")}
      style={{
        left: win.x, top: win.y,
        width: win.w, height: win.h,
        zIndex: win.z,
      }}
      onPointerDown={() => onFocus(win.id)}
    >
      <div className="window-chrome" onPointerDown={startDrag} onDoubleClick={onDoubleClickTitle}>
        <div className="win-dots">
          <span className="win-dot r" onClick={(e) => { e.stopPropagation(); onClose(win.id); }} title="close">
            <span>×</span>
          </span>
          <span className="win-dot y" onClick={(e) => { e.stopPropagation(); onMinimize(win.id); }} title="minimize">
            <span>−</span>
          </span>
          <span className="win-dot g" onClick={(e) => { e.stopPropagation(); onToggleFullscreen(win.id); }} title={win.fullscreen ? "restore" : "fullscreen"}>
            <span>{win.fullscreen ? "↙" : "↗"}</span>
          </span>
        </div>
        <div className="win-title">{win.title}</div>
      </div>
      <div className="window-body">{children}</div>

      {!win.fullscreen && (
        <>
          <div className="resize-handle rh-n"  onPointerDown={(e) => startResize(e, "n")} />
          <div className="resize-handle rh-s"  onPointerDown={(e) => startResize(e, "s")} />
          <div className="resize-handle rh-e"  onPointerDown={(e) => startResize(e, "e")} />
          <div className="resize-handle rh-w"  onPointerDown={(e) => startResize(e, "w")} />
          <div className="resize-handle rh-nw" onPointerDown={(e) => startResize(e, "nw")} />
          <div className="resize-handle rh-ne" onPointerDown={(e) => startResize(e, "ne")} />
          <div className="resize-handle rh-sw" onPointerDown={(e) => startResize(e, "sw")} />
          <div className="resize-handle rh-se" onPointerDown={(e) => startResize(e, "se")} />
        </>
      )}
    </div>
  );
}

export { Window };
export default Window;
