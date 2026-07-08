import { useEffect, useRef, useState } from 'react';
import { ARENA } from '../config/mission';

/* ============================================================================
 * DEMO / Simülasyon motoru — ROS bağlı değilken tüm arayüzü canlandırır.
 * Şartname senaryosunu (başlangıç → alma → kapı/PLC → bırakma → dönüş) baştan
 * sona oynatır. Hareket-Kabiliyet videosu ve jüri sunumu için idealdir.
 * Gerçek ROS verisiyle KARIŞMAZ: App yalnızca demo açıkken bu değerleri kullanır.
 * ========================================================================== */

const wp = (id) => ARENA.waypoints.find((w) => w.id === id);

// Basit sentetik SLAM haritası (duvarlar + engel)
function buildDemoMap() {
  const res = 0.1;
  const W = Math.round(ARENA.width / res);
  const H = Math.round(ARENA.height / res);
  const data = new Array(W * H).fill(0);
  const set = (cx, cy, v) => { if (cx >= 0 && cx < W && cy >= 0 && cy < H) data[cy * W + cx] = v; };
  // dış duvarlar
  for (let x = 0; x < W; x++) { set(x, 0, 100); set(x, H - 1, 100); }
  for (let y = 0; y < H; y++) { set(0, y, 100); set(W - 1, y, 100); }
  // orta bölme (kapı boşluğu)
  const midX = Math.round(9 / res);
  for (let y = 0; y < H; y++) {
    if (Math.abs(y - Math.round(4.5 / res)) > 6) set(midX, y, 100);
  }
  return { width: W, height: H, resolution: res, origin: { x: 0, y: 0 }, data };
}

const DEMO_PLAN = [
  { id: 1,  action: 'goto_waypoint',         desc: 'Başlangıç → düğüm d1' },
  { id: 2,  action: 'goto_waypoint',         desc: 'Alma noktasına ilerle (A2)' },
  { id: 3,  action: 'line_follower',         desc: 'QR sonrası çizgi takibi ile yaklaş' },
  { id: 4,  action: 'pick_load',             desc: 'Yükü al (palet)' },
  { id: 5,  action: 'goto_waypoint',         desc: 'q5 kapı kontrol noktasına git' },
  { id: 6,  action: 'wait_plc',              desc: 'PLC kapı geçiş izni bekle' },
  { id: 7,  action: 'goto_waypoint',         desc: 'Bırakma noktasına taşı (B2)' },
  { id: 8,  action: 'drop_load',             desc: 'Yükü bırak' },
  { id: 9,  action: 'wait_plc',              desc: 'Dönüşte kapıdan geç (PLC)' },
  { id: 10, action: 'return_home',           desc: 'Bekleme noktasına dön' },
];

// senaryo yol noktaları (id, robot state, mission step)
const ROUTE = [
  { p: 'START', state: 'IDLE',          step: 1 },
  { p: 'd1',    state: 'PROCESSING',    step: 1 },
  { p: 'd2',    state: 'MOVING_EMPTY',  step: 2 },
  { p: 'A2',    state: 'MOVING_EMPTY',  step: 3 },
  { p: 'A2',    state: 'PROCESSING',    step: 4, qr: 'q3', load: true, pause: 12 },
  { p: 'd2',    state: 'MOVING_LOADED', step: 5 },
  { p: 'd5',    state: 'MOVING_LOADED', step: 5 },
  { p: 'q5',    state: 'WAITING_PLC',   step: 6, qr: 'q5', door: true, pause: 14 },
  { p: 'd4',    state: 'MOVING_LOADED', step: 7 },
  { p: 'B2',    state: 'MOVING_LOADED', step: 7, qr: 'q8' },
  { p: 'B2',    state: 'PROCESSING',    step: 8, load: false, pause: 10 },
  { p: 'd4',    state: 'WAITING_PLC',   step: 9, door: true, pause: 10 },
  { p: 'd5',    state: 'RETURNING',     step: 10 },
  { p: 'd1',    state: 'RETURNING',     step: 10 },
  { p: 'START', state: 'IDLE',          step: 10 },
];

export function useDemo(enabled) {
  const [tick, setTick] = useState(0);
  const stateRef = useRef({
    seg: 0, t: 0, pauseLeft: 0,
    robot: { x: wp('START').x, y: wp('START').y, yaw: 0, linearVelocity: 0, angularVelocity: 0 },
    robotState: 'IDLE', step: 1, load: false, door: 'CLOSED',
    qr: { data: '--', dist: null, x: null, ts: null },
    battery: 92, msgs: [], line: 0, elapsed: 0,
  });
  const mapRef = useRef(null);
  if (enabled && !mapRef.current) mapRef.current = buildDemoMap();

  useEffect(() => {
    if (!enabled) return;
    const S = stateRef.current;
    const dt = 0.1;
    const speed = 1.1; // m/s

    const iv = setInterval(() => {
      if (S.robotState !== 'IDLE' || S.step > 1 || S.seg > 0) S.elapsed += dt;

      // duraklama (yükleme / kapı bekleme)
      if (S.pauseLeft > 0) {
        S.pauseLeft -= dt;
        S.robot.linearVelocity = 0;
        setTick((t) => t + 1);
        return;
      }

      const cur = ROUTE[S.seg];
      const nextSeg = ROUTE[Math.min(S.seg + 1, ROUTE.length - 1)];
      const from = wp(cur.p), to = wp(nextSeg.p);
      const dx = to.x - from.x, dy = to.y - from.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      S.t += (speed * dt) / dist;

      if (S.t >= 1) {
        // segment tamamlandı → sonraki
        S.t = 0;
        S.seg = Math.min(S.seg + 1, ROUTE.length - 1);
        const n = ROUTE[S.seg];
        S.robotState = n.state;
        S.step = n.step;
        if (n.qr) {
          const q = wp(n.qr);
          S.qr = { data: n.qr, dist: 1.4, x: (Math.random() - 0.5).toFixed(2), ts: Date.now() };
        }
        if (typeof n.load === 'boolean') {
          S.load = n.load;
          S.msgs = [{ dir: 'TX', text: n.load ? 'Yük alındı bildirimi' : 'Yük teslim edildi', time: new Date().toLocaleTimeString('tr-TR') }, ...S.msgs].slice(0, 40);
        }
        if (n.door) {
          S.door = 'OPENING';
          S.msgs = [
            { dir: 'RX', text: 'PLC: geçebilirsin (kapı açılıyor)', time: new Date().toLocaleTimeString('tr-TR') },
            { dir: 'TX', text: 'Kapı kontrol noktasına ulaşıldı', time: new Date().toLocaleTimeString('tr-TR') },
            ...S.msgs,
          ].slice(0, 40);
          setTimeout(() => { S.door = 'OPEN'; }, 1500);
          setTimeout(() => { S.door = 'CLOSED'; }, 5000);
        }
        if (n.pause) S.pauseLeft = n.pause * 0.1 + n.pause * 0.15; // kısa duraklama
        if (S.seg >= ROUTE.length - 1) { S.seg = 0; S.t = 0; } // döngü
      }

      // konum enterpolasyonu
      const x = from.x + dx * S.t;
      const y = from.y + dy * S.t;
      const yaw = Math.atan2(dy, dx);
      S.robot = {
        x, y, yaw,
        linearVelocity: speed * (S.pauseLeft > 0 ? 0 : 1),
        angularVelocity: 0,
      };
      S.line = Math.sin(S.elapsed * 2) * 30;
      S.battery = Math.max(60, 92 - S.elapsed * 0.05);

      setTick((t) => t + 1);
    }, 100);

    return () => clearInterval(iv);
  }, [enabled]);

  if (!enabled) return null;
  const S = stateRef.current;
  return {
    map: mapRef.current,
    odom: S.robot,
    robotState: S.robotState,
    step: S.step,
    plan: DEMO_PLAN,
    plc: { connected: true, door: S.door, waiting: S.robotState === 'WAITING_PLC', ts: Date.now() },
    messages: S.msgs,
    qr: S.qr,
    battery: { percentage: Math.round(S.battery), voltage: 24 * (S.battery / 100) + 0.5, charging: false },
    line: S.line,
    elapsed: Math.floor(S.elapsed),
    scan: makeDemoScan(S.robot),
    load: S.load,
    _tick: tick,
  };
}

// robot çevresinde sahte lidar taraması
function makeDemoScan(robot) {
  const pts = [];
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2 - Math.PI;
    let r = 3 + Math.sin(a * 3) * 0.6;
    if (i % 37 === 0) r = 1.2; // sahte engel
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return { points: pts, rangeMax: 6 };
}
