import React, { useEffect, useRef, useState } from 'react';
import {
  Play, Pause, OctagonAlert, RotateCcw, Map as MapIcon, Save,
  Route, Home, BatteryCharging, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square, Lock,
} from 'lucide-react';
import { COMMANDS } from '../config/mission';

/**
 * Kontrol Çubuğu — operasyon + görev komutları + uzaktan manuel teleop.
 * Şartname: uzaktan manuel kontrol yalnızca robot anahtarı MANUEL iken aktiftir
 * (AUTO modda uzaktan kontrol engellenir).
 */
export const Controls = ({ onCommand, sendVelocity, controlMode, mode, running }) => {
  const manual = controlMode === 'MANUAL';
  const [speed, setSpeed] = useState(0.25);
  const holdRef = useRef(null);

  const startDrive = (lin, ang) => {
    if (!manual) return;
    sendVelocity(lin, ang);
    holdRef.current = setInterval(() => sendVelocity(lin, ang), 100);
  };
  const stopDrive = () => {
    if (holdRef.current) { clearInterval(holdRef.current); holdRef.current = null; }
    sendVelocity(0, 0);
  };
  useEffect(() => () => holdRef.current && clearInterval(holdRef.current), []);

  // klavye teleop (W A S D / ok tuşları) — yalnız manuel
  useEffect(() => {
    if (!manual) return;
    const map = {
      w: [speed, 0], ArrowUp: [speed, 0],
      s: [-speed, 0], ArrowDown: [-speed, 0],
      a: [0, speed * 3], ArrowLeft: [0, speed * 3],
      d: [0, -speed * 3], ArrowRight: [0, -speed * 3],
    };
    const down = (e) => { const v = map[e.key]; if (v) { e.preventDefault(); sendVelocity(v[0], v[1]); } };
    const up = (e) => { if (map[e.key]) sendVelocity(0, 0); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [manual, speed, sendVelocity]);

  const holdBtn = (lin, ang, icon, key) => (
    <button
      key={key}
      className="teleop-btn"
      disabled={!manual}
      onPointerDown={() => startDrive(lin, ang)}
      onPointerUp={stopDrive}
      onPointerLeave={stopDrive}
    >{icon}</button>
  );

  return (
    <div className="controls">
      {/* Operasyon */}
      <div className="ctrl-group">
        <span className="ctrl-group-lbl">OPERASYON</span>
        <button className="btn-ctrl btn-start" onClick={() => onCommand(COMMANDS.START)} disabled={running}>
          <Play size={16} /> BAŞLAT
        </button>
        <button className="btn-ctrl" onClick={() => onCommand(COMMANDS.STOP)}>
          <Pause size={16} /> DURAKLAT
        </button>
        <button className="btn-ctrl" onClick={() => onCommand(COMMANDS.RESET)}>
          <RotateCcw size={16} /> RESET
        </button>
      </div>

      {/* Görev komutları */}
      <div className="ctrl-group">
        <span className="ctrl-group-lbl">GÖREV</span>
        <button className="btn-ctrl sm" onClick={() => onCommand(COMMANDS.START_MAP)}><MapIcon size={15} /> Harita</button>
        <button className="btn-ctrl sm" onClick={() => onCommand(COMMANDS.SAVE_MAP)}><Save size={15} /> Kaydet</button>
        <button className="btn-ctrl sm" onClick={() => onCommand(COMMANDS.PLAN_ROUTE)}><Route size={15} /> Rota</button>
        <button className="btn-ctrl sm" onClick={() => onCommand(COMMANDS.RETURN)}><Home size={15} /> Eve Dön</button>
        <button className="btn-ctrl sm" onClick={() => onCommand(COMMANDS.DOCK)}><BatteryCharging size={15} /> Şarj</button>
      </div>

      {/* Uzaktan manuel teleop */}
      <div className={`ctrl-group teleop ${manual ? '' : 'locked'}`}>
        <span className="ctrl-group-lbl">
          UZAKTAN KONTROL {manual ? '' : <Lock size={12} />}
        </span>
        {!manual && (
          <span className="teleop-lock-note">Robot anahtarı OTONOM — uzaktan kontrol kapalı</span>
        )}
        {manual && (
          <>
            <div className="teleop-pad">
              <div />{holdBtn(speed, 0, <ArrowUp size={18} />, 'up')}<div />
              {holdBtn(0, speed * 3, <ArrowLeft size={18} />, 'left')}
              <button className="teleop-btn stop" onClick={stopDrive}><Square size={16} /></button>
              {holdBtn(0, -speed * 3, <ArrowRight size={18} />, 'right')}
              <div />{holdBtn(-speed, 0, <ArrowDown size={18} />, 'down')}<div />
            </div>
            <div className="teleop-speed">
              <span>Hız {speed.toFixed(2)}</span>
              <input type="range" min="0.05" max="0.6" step="0.05"
                value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
            </div>
          </>
        )}
      </div>

      {/* Acil */}
      <div className="ctrl-group">
        <button className="btn-emergency" onClick={() => onCommand(COMMANDS.EMERGENCY)}>
          <OctagonAlert size={18} /> ACİL DURDUR
        </button>
      </div>
    </div>
  );
};

export default Controls;
