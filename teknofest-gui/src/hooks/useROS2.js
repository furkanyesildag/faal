import { useEffect, useState, useRef, useCallback } from 'react';
import * as ROSLIB from 'roslib';

/* ============================================================================
 * ROS2 Humble — rosbridge_suite (WebSocket) bağlantı katmanı
 * TEKNOFEST 2026 Otonom Forklift AMR arayüzü için tüm topic aboneleri ve
 * yayıncıları burada toplanmıştır.
 * ========================================================================== */

// ─── Bağlantı ───────────────────────────────────────────────────────────────
export const useROS2Connection = (url) => {
  const [ros, setRos] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const retryRef = useRef(null);

  useEffect(() => {
    let closedByUs = false;
    let instance = null;

    const connect = () => {
      instance = new ROSLIB.Ros({ url });

      instance.on('connection', () => {
        setIsConnected(true);
        setError(null);
        setRos(instance);
      });
      instance.on('error', (err) => {
        setError(err?.message || 'Bağlantı hatası');
        setIsConnected(false);
      });
      instance.on('close', () => {
        setIsConnected(false);
        setRos(null);
        // Otomatik yeniden bağlanma (2sn)
        if (!closedByUs) retryRef.current = setTimeout(connect, 2000);
      });
    };

    connect();
    return () => {
      closedByUs = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      instance?.close();
    };
  }, [url]);

  return { ros, isConnected, error };
};

// ─── Genel amaçlı topic abonesi ─────────────────────────────────────────────
const useTopic = (ros, topicDef, handler, deps = []) => {
  const cbRef = useRef(handler);
  cbRef.current = handler;

  useEffect(() => {
    if (!ros || !topicDef) return;
    const topic = new ROSLIB.Topic({
      ros,
      name: topicDef.name,
      messageType: topicDef.type,
    });
    const sub = (msg) => cbRef.current(msg);
    topic.subscribe(sub);
    return () => topic.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ros, topicDef?.name, topicDef?.type, ...deps]);
};

// yaw çıkarımı (quaternion → euler Z)
const quatToYaw = (q) =>
  Math.atan2(
    2.0 * (q.w * q.z + q.x * q.y),
    1.0 - 2.0 * (q.y * q.y + q.z * q.z)
  );

// ─── Odometry ───────────────────────────────────────────────────────────────
export const useOdometry = (ros, topicDef) => {
  const [odom, setOdom] = useState({
    x: 0, y: 0, yaw: 0, linearVelocity: 0, angularVelocity: 0, fresh: false,
  });
  useTopic(ros, topicDef, (m) => {
    const p = m.pose.pose.position;
    const o = m.pose.pose.orientation;
    setOdom({
      x: p.x,
      y: p.y,
      yaw: quatToYaw(o),
      linearVelocity: Number(m.twist.twist.linear.x),
      angularVelocity: Number(m.twist.twist.angular.z),
      fresh: true,
    });
  });
  return odom;
};

// ─── OccupancyGrid (SLAM haritası) ──────────────────────────────────────────
export const useMap = (ros, topicDef) => {
  const [mapData, setMapData] = useState(null);
  useTopic(ros, topicDef, (m) => {
    setMapData({
      width: m.info.width,
      height: m.info.height,
      resolution: m.info.resolution,
      origin: { x: m.info.origin.position.x, y: m.info.origin.position.y },
      data: m.data,
    });
  });
  return mapData;
};

// ─── LaserScan (2D lidar) ───────────────────────────────────────────────────
// Robot base_link'e göre kartezyen noktalar döndürür.
export const useLaserScan = (ros, topicDef) => {
  const [scan, setScan] = useState(null);
  useTopic(ros, topicDef, (m) => {
    const pts = [];
    const n = m.ranges.length;
    for (let i = 0; i < n; i++) {
      const r = m.ranges[i];
      if (!isFinite(r) || r < m.range_min || r > m.range_max) continue;
      const a = m.angle_min + i * m.angle_increment;
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    setScan({ points: pts, rangeMax: m.range_max });
  });
  return scan;
};

// ─── Path (planlanan rota) ──────────────────────────────────────────────────
export const usePath = (ros, topicDef) => {
  const [path, setPath] = useState([]);
  useTopic(ros, topicDef, (m) => {
    setPath((m.poses || []).map((p) => [p.pose.position.x, p.pose.position.y]));
  });
  return path;
};

// ─── std_msgs/String (düz metin) ────────────────────────────────────────────
export const useStringTopic = (ros, topicDef, initial = '--') => {
  const [val, setVal] = useState(initial);
  useTopic(ros, topicDef, (m) => setVal(m.data));
  return val;
};

// ─── std_msgs/Float32 ───────────────────────────────────────────────────────
export const useFloatTopic = (ros, topicDef, initial = 0) => {
  const [val, setVal] = useState(initial);
  useTopic(ros, topicDef, (m) => setVal(Number(m.data)));
  return val;
};

// ─── QR kodu (düz metin ya da JSON {data,x,y,dist}) ─────────────────────────
export const useQRCode = (ros, topicDef) => {
  const [qr, setQr] = useState({ data: '--', x: null, y: null, dist: null, ts: null });
  useTopic(ros, topicDef, (m) => {
    let parsed = { data: m.data };
    try {
      const j = JSON.parse(m.data);
      if (j && typeof j === 'object') parsed = j;
    } catch { /* düz metin */ }
    setQr({
      data: parsed.data ?? String(m.data),
      x: parsed.x ?? null,
      y: parsed.y ?? null,
      dist: parsed.dist ?? null,
      ts: Date.now(),
    });
  });
  return qr;
};

// ─── Robot durumu (8 durum enum'u) ──────────────────────────────────────────
export const useRobotState = (ros, topicDef) => {
  const [state, setState] = useState('IDLE');
  useTopic(ros, topicDef, (m) => {
    const s = String(m.data || '').trim().toUpperCase();
    if (s) setState(s);
  });
  return state;
};

// ─── Kontrol modu (robot manuel/otomatik anahtarı) ──────────────────────────
export const useControlMode = (ros, topicDef) => {
  const [mode, setMode] = useState('AUTO');
  useTopic(ros, topicDef, (m) => {
    const s = String(m.data || '').trim().toUpperCase();
    if (s === 'MANUAL' || s === 'AUTO') setMode(s);
  });
  return mode;
};

// ─── BatteryState ───────────────────────────────────────────────────────────
export const useBattery = (ros, topicDef) => {
  const [bat, setBat] = useState({ percentage: null, voltage: null, charging: false });
  useTopic(ros, topicDef, (m) => {
    // percentage 0..1 gelir; yüzdeye çevir
    const pct = m.percentage != null ? Math.round(m.percentage * 100) : null;
    setBat({
      percentage: pct,
      voltage: m.voltage != null ? Number(m.voltage) : null,
      // power_supply_status: 1=charging
      charging: m.power_supply_status === 1,
    });
  });
  return bat;
};

// ─── PLC durumu (JSON) ──────────────────────────────────────────────────────
export const usePLCStatus = (ros, topicDef) => {
  const [plc, setPlc] = useState({ connected: false, door: 'CLOSED', waiting: false, ts: null });
  useTopic(ros, topicDef, (m) => {
    try {
      const j = JSON.parse(m.data);
      setPlc({
        connected: !!j.connected,
        door: j.door || 'CLOSED',
        waiting: !!j.waiting,
        ts: Date.now(),
      });
    } catch { /* geçersiz JSON */ }
  });
  return plc;
};

// ─── PLC mesaj günlüğü (TX/RX) ──────────────────────────────────────────────
export const usePLCMessages = (ros, topicDef, limit = 60) => {
  const [msgs, setMsgs] = useState([]);
  useTopic(ros, topicDef, (m) => {
    let entry;
    try {
      const j = JSON.parse(m.data);
      entry = { dir: (j.dir || 'RX').toUpperCase(), text: j.text ?? m.data };
    } catch {
      entry = { dir: 'RX', text: m.data };
    }
    entry.time = new Date().toLocaleTimeString('tr-TR');
    setMsgs((prev) => [entry, ...prev].slice(0, limit));
  });
  return msgs;
};

// ─── CompressedImage (kamera / çizgi takip) ─────────────────────────────────
export const useCompressedImage = (ros, topicDef) => {
  const [src, setSrc] = useState(null);
  useTopic(ros, topicDef, (m) => {
    const fmt = (m.format || 'jpeg').includes('png') ? 'png' : 'jpeg';
    // rosbridge byte[] alanları base64 string olarak iletir
    setSrc(`data:image/${fmt};base64,${m.data}`);
  });
  return src;
};

// ─── Yayıncılar (GUI → robot) ───────────────────────────────────────────────
export const usePublishers = (ros, topics) => {
  const cmdRef = useRef(null);
  const velRef = useRef(null);

  useEffect(() => {
    if (!ros) { cmdRef.current = null; velRef.current = null; return; }
    cmdRef.current = new ROSLIB.Topic({ ros, name: topics.guiCommand.name, messageType: topics.guiCommand.type });
    velRef.current = new ROSLIB.Topic({ ros, name: topics.cmdVel.name, messageType: topics.cmdVel.type });
    // advertise: latch benzeri davranış için
    cmdRef.current.advertise();
    velRef.current.advertise();
    return () => {
      cmdRef.current?.unadvertise();
      velRef.current?.unadvertise();
    };
  }, [ros, topics]);

  // Not: roslib 2.x ESM derlemesi ROSLIB.Message'ı dışa aktarmaz;
  // Topic.publish() düz nesne kabul eder.
  const sendCommand = useCallback((data) => {
    if (!cmdRef.current) return false;
    cmdRef.current.publish({ data });
    return true;
  }, []);

  const sendVelocity = useCallback((lin = 0, ang = 0) => {
    if (!velRef.current) return false;
    velRef.current.publish({
      linear:  { x: lin, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: ang },
    });
    return true;
  }, []);

  return { sendCommand, sendVelocity };
};
