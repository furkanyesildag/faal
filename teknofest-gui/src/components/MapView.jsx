import React, { useEffect, useRef } from 'react';
import { ARENA, TOLERANCES } from '../config/mission';

/**
 * Harita Görselleştirme (RViz benzeri) — TEKNOFEST 2026 Otonom Forklift
 * Katmanlar:
 *   • OccupancyGrid (SLAM haritası, /map)
 *   • LaserScan noktaları (2D lidar, /scan) — map frame'e dönüştürülmüş
 *   • Planlanan rota (/plan)
 *   • Yarışma alanı işaretleri (A1-3, B1-3, düğüm, QR, kapı) — Şekil 1
 *   • Robot işareti (footprint + yön) ve rota sapma halkası
 */
const WP_STYLE = {
  start:   { color: '#22c55e', r: 9,  glyph: '⌂' },
  pickup:  { color: '#3b82f6', r: 8,  glyph: 'A' },
  dropoff: { color: '#f59e0b', r: 8,  glyph: 'B' },
  node:    { color: '#94a3b8', r: 4,  glyph: '' },
  qr:      { color: '#a855f7', r: 5,  glyph: '' },
  door:    { color: '#ef4444', r: 7,  glyph: '⛊' },
};

const MapView = ({
  mapData, robot, scan, path = [], theme = 'dark',
  showWaypoints = true, showLaser = true, showPath = true,
  routeDeviation = 0, width = 900, height = 640,
}) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const dark = theme === 'dark';
    ctx.fillStyle = dark ? '#070b12' : '#eef1f5';
    ctx.fillRect(0, 0, W, H);

    // ── Dünya sınırlarını belirle (harita varsa haritadan, yoksa arenadan) ──
    let minX, minY, maxX, maxY;
    if (mapData) {
      minX = mapData.origin.x;
      minY = mapData.origin.y;
      maxX = minX + mapData.width * mapData.resolution;
      maxY = minY + mapData.height * mapData.resolution;
    } else {
      minX = 0; minY = 0; maxX = ARENA.width; maxY = ARENA.height;
    }
    const worldW = Math.max(maxX - minX, 0.001);
    const worldH = Math.max(maxY - minY, 0.001);
    const pad = 28;
    const scale = Math.min((W - pad * 2) / worldW, (H - pad * 2) / worldH);
    const offX = (W - worldW * scale) / 2;
    const offY = (H - worldH * scale) / 2;

    // Dünya (m) → canvas (px). Y ekseni ters.
    const wx = (x) => offX + (x - minX) * scale;
    const wy = (y) => offY + (maxY - y) * scale;

    // ── Zemin ızgarası (1 m) ──
    ctx.strokeStyle = dark ? 'rgba(0,200,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    for (let x = Math.ceil(minX); x <= maxX; x++) {
      ctx.beginPath(); ctx.moveTo(wx(x), wy(minY)); ctx.lineTo(wx(x), wy(maxY)); ctx.stroke();
    }
    for (let y = Math.ceil(minY); y <= maxY; y++) {
      ctx.beginPath(); ctx.moveTo(wx(minX), wy(y)); ctx.lineTo(wx(maxX), wy(y)); ctx.stroke();
    }

    // ── OccupancyGrid ──
    if (mapData) {
      const { width: mw, height: mh, resolution: res, data } = mapData;
      const img = ctx.createImageData(mw, mh);
      for (let row = 0; row < mh; row++) {
        for (let col = 0; col < mw; col++) {
          const v = data[row * mw + col];
          const px = ((mh - 1 - row) * mw + col) * 4; // üst satır önce
          let g;
          if (v === -1)      { img.data[px] = dark ? 22 : 205; img.data[px+1] = dark ? 30 : 205; img.data[px+2] = dark ? 42 : 205; img.data[px+3] = 255; continue; }
          else if (v === 0)  { g = dark ? 210 : 255; }
          else if (v >= 100) { g = 0; }
          else               { g = 255 - (v * 255 / 100); }
          img.data[px] = g; img.data[px+1] = g; img.data[px+2] = g; img.data[px+3] = 255;
        }
      }
      const tmp = document.createElement('canvas');
      tmp.width = mw; tmp.height = mh;
      tmp.getContext('2d').putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.92;
      ctx.drawImage(tmp, wx(minX), wy(maxY), mw * res * scale, mh * res * scale);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = dark ? '#4b5563' : '#94a3b8';
      ctx.font = '15px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('SLAM haritası bekleniyor — /map', W / 2, 26);
    }

    // ── Planlanan rota (/plan) ──
    if (showPath && path.length > 1) {
      ctx.strokeStyle = dark ? '#00e5ff' : '#0369a1';
      ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      path.forEach(([px, py], i) => (i ? ctx.lineTo(wx(px), wy(py)) : ctx.moveTo(wx(px), wy(py))));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Yarışma alanı işaretleri (Şekil 1) ──
    if (showWaypoints) {
      // düğümleri bağlayan ince çizgiler (görsel referans)
      ctx.font = '10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ARENA.waypoints.forEach((w) => {
        const st = WP_STYLE[w.type] || WP_STYLE.node;
        const cx = wx(w.x), cy = wy(w.y);
        ctx.beginPath();
        ctx.fillStyle = st.color;
        ctx.globalAlpha = w.type === 'node' ? 0.6 : 0.9;
        if (w.type === 'qr') {
          ctx.fillRect(cx - st.r, cy - st.r, st.r * 2, st.r * 2);
        } else {
          ctx.arc(cx, cy, st.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (w.type !== 'node') {
          ctx.fillStyle = dark ? '#e5e7eb' : '#111827';
          ctx.fillText(w.label, cx, cy - st.r - 7);
        }
      });
    }

    // ── LaserScan (map frame'e dönüştür) ──
    if (showLaser && scan && robot) {
      const cy = Math.cos(robot.yaw), sy = Math.sin(robot.yaw);
      ctx.fillStyle = dark ? 'rgba(255,64,64,0.85)' : 'rgba(200,0,0,0.7)';
      for (const [lx, ly] of scan.points) {
        const gx = robot.x + lx * cy - ly * sy;
        const gy = robot.y + lx * sy + ly * cy;
        ctx.fillRect(wx(gx) - 1, wy(gy) - 1, 2, 2);
      }
    }

    // ── Robot ──
    if (robot && Number.isFinite(robot.x)) {
      const cx = wx(robot.x), cy = wy(robot.y);
      const rColor = dark ? '#00f3ff' : '#b00000';

      // rota sapma halkası (tolerans aşımında kırmızı)
      const devBad = routeDeviation > TOLERANCES.routeDeviation;
      ctx.beginPath();
      ctx.strokeStyle = devBad ? '#ef4444' : 'rgba(0,243,255,0.35)';
      ctx.lineWidth = devBad ? 3 : 1.5;
      ctx.arc(cx, cy, Math.max(TOLERANCES.routeDeviation * scale, 14), 0, Math.PI * 2);
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-robot.yaw); // canvas Y ters → yaw negatif
      ctx.fillStyle = rColor;
      ctx.shadowBlur = 12; ctx.shadowColor = rColor;
      // forklift gövdesi (ok şeklinde)
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(-10, 9); ctx.lineTo(-5, 0); ctx.lineTo(-10, -9);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // ── Ölçek çubuğu (1 m) ──
    ctx.setLineDash([]);
    ctx.strokeStyle = dark ? '#9ca3af' : '#374151';
    ctx.lineWidth = 2;
    const barY = H - 16, barX = 16;
    ctx.beginPath(); ctx.moveTo(barX, barY); ctx.lineTo(barX + scale, barY); ctx.stroke();
    ctx.fillStyle = dark ? '#9ca3af' : '#374151';
    ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('1 m', barX + scale + 6, barY + 4);
  }, [mapData, robot, scan, path, theme, showWaypoints, showLaser, showPath, routeDeviation]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};

export default MapView;
