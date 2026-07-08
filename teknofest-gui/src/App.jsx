import React, { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Wifi, WifiOff, Layers, Terminal } from 'lucide-react';
import * as ROSLIB from 'roslib';

import { ROSBRIDGE_URL, TOPICS, COMMANDS } from './config/mission';
import {
  useROS2Connection, useOdometry, useMap, useLaserScan, usePath,
  useFloatTopic, useQRCode, useRobotState, useControlMode,
  useBattery, usePLCStatus, usePLCMessages, usePublishers,
} from './hooks/useROS2';

import RobotStatus from './components/RobotStatus';
import PLCPanel from './components/PLCPanel';
import MapView from './components/MapView';
import SensorHUD from './components/SensorHUD';
import Controls from './components/Controls';
import { Jarvis } from './components/Jarvis';

import './styles/MissionControl.css';

const App = () => {
  // ─── ROS bağlantısı + abonelikler ────────────────────────────────────────
  const { ros, isConnected, error: rosError } = useROS2Connection(ROSBRIDGE_URL);

  const odomROS      = useOdometry(ros, TOPICS.odom);
  const mapROS       = useMap(ros, TOPICS.map);
  const scanROS      = useLaserScan(ros, TOPICS.scan);
  const pathROS      = usePath(ros, TOPICS.globalPlan);
  const robotStateR  = useRobotState(ros, TOPICS.robotState);
  const controlModeR = useControlMode(ros, TOPICS.controlMode);
  const qrROS        = useQRCode(ros, TOPICS.qrCode);
  const routeDevROS  = useFloatTopic(ros, TOPICS.routeDev, 0);
  const batteryROS   = useBattery(ros, TOPICS.battery);
  const plcROS       = usePLCStatus(ros, TOPICS.plcStatus);
  const plcMsgsROS   = usePLCMessages(ros, TOPICS.plcMessage);
  const { sendCommand, sendVelocity } = usePublishers(ros, TOPICS);

  // ─── Yerel UI durumları ──────────────────────────────────────────────────
  const [theme, setTheme]     = useState('dark');
  const [logs, setLogs]       = useState([{ time: '--:--:--', msg: 'Sistem hazir. ROS2 baglantisi bekleniyor.' }]);
  const [clock, setClock]     = useState(new Date().toLocaleTimeString('tr-TR'));
  const [tasks, setTasks]     = useState([]);
  const [activeStep, setStep] = useState(0);
  const [layers, setLayers]   = useState({ waypoints: true, laser: true, path: true });
  const [running, setRunning] = useState(false);

  const lastStepRef = useRef(-1);

  const logEkle = (msg) => {
    setLogs((prev) => [{ time: new Date().toLocaleTimeString('tr-TR'), msg }, ...prev].slice(0, 60));
  };

  // ─── Canlı ROS2 verileri ──────────────────────────────────────────────────
  const odom       = odomROS;
  const mapData    = mapROS;
  const scan       = scanROS;
  const path       = pathROS;
  const robotState = robotStateR;
  const controlMode= controlModeR;
  const qr         = qrROS;
  const routeDev   = routeDevROS;
  const battery    = batteryROS;
  const plc        = plcROS;
  const plcMsgs    = plcMsgsROS;
  const planData   = tasks;
  const stepData   = activeStep;

  // ─── Komut gönderimi (/gui_command) ───────────────────────────────────────
  const doCommand = (cmd) => {
    const ok = sendCommand(cmd);
    logEkle(ok ? `Komut gonderildi: ${cmd}` : `Komut gonderilemedi (baglanti yok): ${cmd}`);
    if (cmd === COMMANDS.START)                                setRunning(true);
    if (cmd === COMMANDS.STOP || cmd === COMMANDS.EMERGENCY ||
        cmd === COMMANDS.RESET)                                setRunning(false);
  };

  // ─── /mission_plan & /mission_status abonelikleri (yalnızca ROS modunda) ──
  useEffect(() => {
    if (!ros || !isConnected) return;
    const planT = new ROSLIB.Topic({ ros, name: TOPICS.missionPlan.name, messageType: TOPICS.missionPlan.type });
    planT.subscribe((m) => {
      try {
        const d = JSON.parse(m.data);
        if (Array.isArray(d) && d.length) setTasks((p) => (JSON.stringify(p) === JSON.stringify(d) ? p : d));
      } catch { /* ignore */ }
    });
    const statT = new ROSLIB.Topic({ ros, name: TOPICS.missionStat.name, messageType: TOPICS.missionStat.type });
    statT.subscribe((m) => {
      try {
        const d = JSON.parse(m.data);
        setStep(d.step_id);
        if (lastStepRef.current !== d.step_id) {
          logEkle(`ADIM ${d.step_id}: ${d.action || ''} - ${d.desc || ''}`);
          lastStepRef.current = d.step_id;
        }
      } catch { /* ignore */ }
    });
    return () => { planT.unsubscribe(); statT.unsubscribe(); };
  }, [ros, isConnected]);

  // ROS bağlanınca planı iste
  useEffect(() => {
    if (isConnected) {
      const t = setTimeout(() => { sendCommand(COMMANDS.RESEND); logEkle('Gorev plani istendi (resend_plan).'); }, 800);
      return () => clearTimeout(t);
    }
  }, [isConnected, sendCommand]);

  // ─── Saat + bağlantı logu ─────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString('tr-TR')), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (isConnected) logEkle('ROS2 (rosbridge) baglantisi kuruldu.');
    else if (rosError) logEkle(`Baglanti hatasi: ${rosError}`);
  }, [isConnected, rosError]);

  return (
    <div className="app-root" data-theme={theme}>
      {/* ══ HEADER ══ */}
      <header className="topbar">
        <div className="topbar-left">
          <img src="/logo1.png" className="brand-logo" alt="logo" onError={(e) => (e.target.style.display = 'none')} />
        </div>

        <div className="topbar-center">
          <img src="/logo2.png" className="brand-main" alt="teknofest" onError={(e) => (e.target.style.display = 'none')} />
        </div>

        <div className="topbar-right">
          <div className={`chip mode ${controlMode === 'MANUAL' ? 'manual' : 'auto'}`}>
            {controlMode === 'MANUAL' ? 'MANUEL' : 'OTONOM'}
          </div>
          <div className={`chip status ${isConnected ? 'online' : 'offline'}`}>
            {isConnected ? <Wifi size={15} /> : <WifiOff size={15} />}
            {isConnected ? 'ROS2 ONLINE' : 'OFFLINE'}
          </div>
          <div className="chip clock">{clock}</div>
          <button className="chip icon" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* ══ ANA IZGARA ══ */}
      <div className="main-grid">
        {/* SOL SÜTUN */}
        <aside className="col col-left">
          <RobotStatus state={robotState} controlMode={controlMode} />
          <PLCPanel plc={plc} messages={plcMsgs} />
        </aside>

        {/* ORTA SÜTUN */}
        <main className="col col-center">
          <div className="map-toolbar">
            <span className="map-toolbar-title"><Layers size={14} /> HARİTA & NAVİGASYON</span>
            <div className="layer-toggles">
              {[['waypoints', 'İşaretler'], ['laser', 'Lidar'], ['path', 'Rota']].map(([k, lbl]) => (
                <button key={k} className={`toggle ${layers[k] ? 'on' : ''}`} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div className="map-holder">
            <MapView
              mapData={mapData}
              robot={{ x: odom.x, y: odom.y, yaw: odom.yaw }}
              scan={scan}
              path={path}
              theme={theme}
              showWaypoints={layers.waypoints}
              showLaser={layers.laser}
              showPath={layers.path}
              routeDeviation={routeDev}
            />
            {/* Harita üstü canlı okuma */}
            <div className="map-hud">
              <span>x {Number(odom.x).toFixed(2)}  y {Number(odom.y).toFixed(2)}</span>
              <span>{Number(odom.linearVelocity || 0).toFixed(2)} m/s</span>
              <span className={routeDev > 0.1 ? 'bad' : ''}>sapma {Number(routeDev).toFixed(3)} m</span>
            </div>
            <MapLegend />
          </div>
        </main>

        {/* SAĞ SÜTUN — telemetri + günlük */}
        <aside className="col col-right">
          <SensorHUD qr={qr} speed={odom.linearVelocity} odom={odom} battery={battery} routeDeviation={routeDev} />
          <div className="log-strip">
            <div className="log-strip-head"><Terminal size={13} /> SİSTEM GÜNLÜĞÜ</div>
            <div className="log-strip-body">
              {logs.map((l, i) => (
                <div key={i} className="log-line"><span className="log-t">[{l.time}]</span> {l.msg}</div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ══ FOOTER: KONTROLLER ══ */}
      <footer className="bottombar">
        <Controls
          onCommand={doCommand}
          sendVelocity={sendVelocity}
          controlMode={controlMode}
          running={running}
        />
      </footer>

      {/* JARVIS — canlı robot verisi + gerçek komut gönderimi */}
      <Jarvis
        robotStatus={{
          battery: battery.percentage ?? 100,
          charging: battery.charging,
          speed: odom.linearVelocity || 0,
          x: odom.x || 0, y: odom.y || 0,
          yawDeg: (odom.yaw || 0) * 180 / Math.PI,
          mode: controlMode,
          state: robotState,
          plcConnected: plc.connected,
          door: plc.door,
          qr: qr.data,
          step: stepData,
          totalSteps: planData.length,
          lastLog: logs[0]?.msg ?? '',
          tasks: planData.length ? planData.map((t) => t.desc).join(' → ') : 'Görev bekleniyor',
        }}
        sendCommand={doCommand}
      />
    </div>
  );
};

// Harita lejantı
const MapLegend = () => (
  <div className="map-legend">
    <span><i style={{ background: '#22c55e' }} /> Başlangıç</span>
    <span><i style={{ background: '#3b82f6' }} /> Alma (A)</span>
    <span><i style={{ background: '#f59e0b' }} /> Bırakma (B)</span>
    <span><i style={{ background: '#a855f7' }} /> QR</span>
    <span><i style={{ background: '#ef4444' }} /> Kapı</span>
    <span><i style={{ background: '#ff4040' }} /> Lidar</span>
  </div>
);

export default App;
