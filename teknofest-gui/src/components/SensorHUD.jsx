import React from 'react';
import { Battery, BatteryCharging, Zap, QrCode, Gauge, Navigation, MapPin, RotateCw } from 'lucide-react';
import { TOLERANCES } from '../config/mission';

const rad2deg = (r) => (r * 180) / Math.PI;

/**
 * Sensör / Telemetri HUD — QR, hız, konum, yön, batarya, voltaj.
 * Şartname Görev 10: "okunan qr kod bilgisi" + robot telemetrisi.
 */
export const SensorHUD = ({ qr, speed, odom, battery, routeDeviation }) => {
  const pct = battery.percentage;
  const lowBat = pct != null && pct < 20;
  const devBad = routeDeviation > TOLERANCES.routeDeviation;

  return (
    <div className="hud">
      <div className="section-title">SENSÖR & TELEMETRİ</div>

      {/* QR kod — büyük */}
      <div className="hud-qr">
        <div className="hud-qr-head"><QrCode size={16} /> SON OKUNAN QR</div>
        <div className="hud-qr-val">{qr.data || '--'}</div>
        {qr.dist != null && (
          <div className="hud-qr-sub">
            uzaklık {Number(qr.dist).toFixed(2)} m
            {qr.x != null && ` · konum Δx ${Number(qr.x).toFixed(2)}`}
          </div>
        )}
      </div>

      {/* Metrik ızgara */}
      <div className="hud-grid">
        <div className="hud-cell">
          <Gauge size={18} />
          <div className="hud-cell-val">{Number(speed || 0).toFixed(2)}</div>
          <div className="hud-cell-lbl">m/s hız</div>
        </div>
        <div className={`hud-cell ${devBad ? 'bad' : ''}`}>
          <Navigation size={18} />
          <div className="hud-cell-val">{Number(routeDeviation || 0).toFixed(3)}</div>
          <div className="hud-cell-lbl">m sapma</div>
        </div>
        <div className="hud-cell">
          <MapPin size={18} />
          <div className="hud-cell-val">{Number(odom.x || 0).toFixed(2)},{Number(odom.y || 0).toFixed(2)}</div>
          <div className="hud-cell-lbl">konum x,y</div>
        </div>
        <div className="hud-cell">
          <RotateCw size={18} />
          <div className="hud-cell-val">{Number(rad2deg(odom.yaw || 0)).toFixed(0)}°</div>
          <div className="hud-cell-lbl">yön</div>
        </div>
      </div>

      {/* Güç */}
      <div className="hud-power">
        <div className="hud-power-item">
          {battery.charging
            ? <BatteryCharging size={26} color="var(--success)" />
            : <Battery size={26} color={lowBat ? 'var(--danger)' : 'var(--success)'} />}
          <div className="hud-power-val" style={{ color: lowBat ? 'var(--danger)' : 'var(--success)' }}>
            {pct != null ? `${pct}%` : '--'}
          </div>
          <div className="hud-power-lbl">{battery.charging ? 'Şarj' : 'Batarya'}</div>
        </div>
        <div className="hud-power-item">
          <Zap size={26} color="var(--primary-color)" />
          <div className="hud-power-val">
            {battery.voltage != null ? `${battery.voltage.toFixed(1)}V` : '--'}
          </div>
          <div className="hud-power-lbl">Voltaj</div>
        </div>
      </div>
    </div>
  );
};

export default SensorHUD;
