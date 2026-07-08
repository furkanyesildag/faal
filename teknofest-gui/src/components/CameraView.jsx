import React from 'react';
import { Camera, CameraOff } from 'lucide-react';

/**
 * Kamera / Çizgi Takip Görünümü — Şartname Görev 4 (görüntü işleme ile çizgi takibi).
 * /line_camera/compressed görüntüsünü ve algılanan çizgi merkez sapmasını gösterir.
 */
export const CameraView = ({ src, lineOffset = 0 }) => {
  // sapma -1..+1 aralığına normalize (px/m fark etmez, görsel gösterge)
  const norm = Math.max(-1, Math.min(1, lineOffset / 100));
  const centered = Math.abs(lineOffset) < 8;

  return (
    <div className="cam-panel">
      <div className="section-title">
        ÇİZGİ TAKİP KAMERASI
        <span className={`cam-dot ${src ? 'on' : 'off'}`} />
      </div>

      <div className="cam-frame">
        {src ? (
          <img src={src} alt="line camera" className="cam-img" />
        ) : (
          <div className="cam-placeholder">
            <CameraOff size={34} />
            <span>Kamera akışı yok</span>
            <small>/line_camera/compressed</small>
          </div>
        )}

        {/* çizgi hedef göstergesi */}
        {src && (
          <>
            <div className="cam-center-line" />
            <div
              className={`cam-line-marker ${centered ? 'ok' : ''}`}
              style={{ left: `${50 + norm * 42}%` }}
            />
          </>
        )}
      </div>

      <div className="cam-meta">
        <Camera size={14} />
        <span>Merkez sapması:</span>
        <b className={centered ? 'pos' : 'neg'}>{Number(lineOffset).toFixed(0)} px</b>
        <span className={`cam-state ${centered ? 'ok' : 'warn'}`}>
          {centered ? 'ÇİZGİ MERKEZDE' : norm < 0 ? '◀ SOLA KAY' : 'SAĞA KAY ▶'}
        </span>
      </div>
    </div>
  );
};

export default CameraView;
