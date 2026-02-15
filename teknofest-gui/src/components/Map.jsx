
import React, { useEffect, useRef } from 'react';

const Map = ({ robot, obstacles, mode, width = 800, height = 600 }) => {
  const canvasRef = useRef(null);

  // Constants for map scaling (meters to pixels)
  // Arena is 18m x 14m
  const ARENA_WIDTH_M = 18;
  const ARENA_HEIGHT_M = 14;

  // Padding
  const PADDING = 40;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Auto-scale
    const scaleX = (canvas.width - PADDING * 2) / ARENA_WIDTH_M;
    const scaleY = (canvas.height - PADDING * 2) / ARENA_HEIGHT_M;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (canvas.width - ARENA_WIDTH_M * scale) / 2;
    const offsetY = (canvas.height - ARENA_HEIGHT_M * scale) / 2;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Grid (tema-aware)
    const isLightMode = document.querySelector('[data-theme="light"]');
    ctx.strokeStyle = isLightMode ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 243, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= ARENA_WIDTH_M; x++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + x * scale, offsetY);
      ctx.lineTo(offsetX + x * scale, offsetY + ARENA_HEIGHT_M * scale);
      ctx.stroke();
    }
    for (let y = 0; y <= ARENA_HEIGHT_M; y++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + y * scale);
      ctx.lineTo(offsetX + ARENA_WIDTH_M * scale, offsetY + y * scale);
      ctx.stroke();
    }

    // Helper: Draw Rect
    const drawRect = (x, y, w, h, color, label) => {
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + x * scale, offsetY + y * scale, w * scale, h * scale);
      if (label) {
        ctx.fillStyle = 'white';
        ctx.font = '12px ' + '"Consolas"';
        ctx.textAlign = 'center';
        ctx.fillText(label, offsetX + (x + w / 2) * scale, offsetY + (y + h / 2) * scale + 4);
      }
    };

    // Draw Zones (A1-A4 Pickup) - Blue
    // Mock positions based on typical layout (edges)
    drawRect(2, 2, 1, 1, 'rgba(0, 100, 255, 0.5)', 'A1');
    drawRect(5, 2, 1, 1, 'rgba(0, 100, 255, 0.5)', 'A2');
    drawRect(8, 2, 1, 1, 'rgba(0, 100, 255, 0.5)', 'A3');
    drawRect(11, 2, 1, 1, 'rgba(0, 100, 255, 0.5)', 'A4');

    // Draw Zones (B1-B4 Dropoff) - Orange
    drawRect(2, 11, 1, 1, 'rgba(255, 165, 0, 0.5)', 'B1');
    drawRect(5, 11, 1, 1, 'rgba(255, 165, 0, 0.5)', 'B2');
    drawRect(8, 11, 1, 1, 'rgba(255, 165, 0, 0.5)', 'B3');
    drawRect(11, 11, 1, 1, 'rgba(255, 165, 0, 0.5)', 'B4');

    // Draw Start/Home - Green
    drawRect(0, 7, 1.5, 1.5, 'rgba(0, 255, 100, 0.3)', 'HOME');

    // Draw Obstacles - Red
    obstacles.forEach(obs => {
      drawRect(obs.x, obs.y, obs.w, obs.h, 'rgba(255, 0, 85, 0.6)', 'OBS');
    });

    // Draw Restricted Zone (Crosshatch) if Mapped
    if (mode !== 'MAPPING') {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
      ctx.fillRect(offsetX + 7 * scale, offsetY + 6 * scale, 4 * scale, 3 * scale);
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.strokeRect(offsetX + 7 * scale, offsetY + 6 * scale, 4 * scale, 3 * scale);
      // Add label
      ctx.fillStyle = 'rgba(255,100,100,0.8)';
      ctx.fillText('RESTRICTED', offsetX + 9 * scale, offsetY + 7.5 * scale);
    }

    // Draw Robot
    const rx = offsetX + robot.x * scale;
    const ry = offsetY + robot.y * scale;

    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(robot.rotation * Math.PI / 180);

    // Robot Body (tema-aware renk)
    const robotColor = isLightMode ? '#b00000' : '#00f3ff';
    ctx.fillStyle = robotColor;
    ctx.shadowBlur = 15;
    ctx.shadowColor = robotColor;
    ctx.beginPath();
    ctx.moveTo(0, -15); // Nose
    ctx.lineTo(12, 12);
    ctx.lineTo(0, 8);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();

    // Sensor Field (Cone)
    ctx.fillStyle = 'rgba(0, 243, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 80, -Math.PI / 4, Math.PI / 4); // 45 degree cone
    ctx.closePath();
    ctx.fill();

    ctx.restore();

  }, [robot, obstacles, mode, width, height]);

  return (
    <div className="map-view">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
};

export default Map;
