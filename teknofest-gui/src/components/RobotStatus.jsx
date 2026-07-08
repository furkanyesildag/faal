import React from 'react';
import { ROBOT_STATES, ROBOT_STATE_ORDER } from '../config/mission';

/**
 * Robot Durum Paneli — Şartname Görev 10 (a–h)
 * Robotun /robot_state topic'inden gelen 8 durumundan aktif olanı büyük olarak,
 * geri kalanını mini rozet dizisi olarak gösterir.
 */
export const RobotStatus = ({ state, controlMode }) => {
  const current = ROBOT_STATES[state] || ROBOT_STATES.IDLE;
  const isManual = controlMode === 'MANUAL';

  return (
    <div className="rs-panel">
      <div className="section-title">
        ROBOT DURUMU
        <span className={`rs-mode ${isManual ? 'manual' : 'auto'}`}>
          {isManual ? 'MANUEL' : 'OTONOM'}
        </span>
      </div>

      {/* Aktif durum — büyük kart */}
      <div className="rs-active" style={{ '--rs-color': current.color }}>
        <span className="rs-active-dot" />
        <div className="rs-active-body">
          <div className="rs-active-label">{current.label}</div>
          <div className="rs-active-desc">{current.desc}</div>
        </div>
        <div className="rs-pulse" />
      </div>

      {/* 8 durum rozet dizisi */}
      <div className="rs-grid">
        {ROBOT_STATE_ORDER.map((k) => {
          const s = ROBOT_STATES[k];
          const active = k === state;
          return (
            <div
              key={k}
              className={`rs-chip ${active ? 'active' : ''}`}
              style={{ '--rs-color': s.color }}
              title={s.desc}
            >
              <span className="rs-chip-dot" />
              <span className="rs-chip-label">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RobotStatus;
