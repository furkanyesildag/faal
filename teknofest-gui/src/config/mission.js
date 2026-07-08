/* ============================================================================
 * TEKNOFEST 2026 — Sanayide Robotik Uygulamalar Yarışması
 * Otonom Forklift AMR — Kontrol Arayüzü Merkezi Konfigürasyonu
 *
 * Bu dosya; ROS2 topic isimlerini, yarışma alanı yerleşimini (Şekil 1),
 * robotun 8 durum tanımını (Görev 10) ve puanlama tablosunu (Tablo 4)
 * tek noktadan yönetir. Gerçek robota geçerken sadece bu dosyayı düzenlemek
 * yeterlidir.
 * ========================================================================== */

// ─── ROSBridge WebSocket adresi ─────────────────────────────────────────────
export const ROSBRIDGE_URL =
  import.meta.env.VITE_ROSBRIDGE_URL || 'ws://localhost:9090';

// ─── ROS2 Topic Haritası ────────────────────────────────────────────────────
// Gerçek robotta topic isimleri farklıysa yalnızca buradan değiştirin.
export const TOPICS = {
  // Navigasyon / SLAM
  odom:        { name: '/odom',                 type: 'nav_msgs/msg/Odometry' },
  map:         { name: '/map',                  type: 'nav_msgs/msg/OccupancyGrid' },
  scan:        { name: '/scan',                 type: 'sensor_msgs/msg/LaserScan' },
  globalPlan:  { name: '/plan',                 type: 'nav_msgs/msg/Path' },
  localPlan:   { name: '/local_plan',           type: 'nav_msgs/msg/Path' },

  // Görev / durum (Görev 10)
  robotState:  { name: '/robot_state',          type: 'std_msgs/msg/String' },   // 8 durumdan biri
  missionPlan: { name: '/mission_plan',         type: 'std_msgs/msg/String' },   // JSON adım listesi
  missionStat: { name: '/mission_status',       type: 'std_msgs/msg/String' },   // JSON aktif adım
  controlMode: { name: '/control_mode',         type: 'std_msgs/msg/String' },   // 'AUTO' | 'MANUAL' (robot anahtarı)

  // Algılama
  qrCode:      { name: '/qr_code',              type: 'std_msgs/msg/String' },   // JSON {data,x,y,dist} veya düz metin
  rfid:        { name: '/rfid_tag',             type: 'std_msgs/msg/String' },
  lineCam:     { name: '/line_camera/compressed', type: 'sensor_msgs/msg/CompressedImage' },
  lineOffset:  { name: '/line_offset',          type: 'std_msgs/msg/Float32' },  // çizgi merkez sapması (px veya m)
  routeDev:    { name: '/route_deviation',      type: 'std_msgs/msg/Float32' },  // rotadan sapma (m)

  // Fabrika Otomasyon Sistemi (PLC) haberleşmesi
  plcStatus:   { name: '/plc/status',           type: 'std_msgs/msg/String' },   // JSON {connected,door,waiting}
  plcMessage:  { name: '/plc/message',          type: 'std_msgs/msg/String' },   // JSON {dir:'TX'|'RX', text}

  // Güç
  battery:     { name: '/battery_state',        type: 'sensor_msgs/msg/BatteryState' },

  // Yayınlar (GUI → robot)
  guiCommand:  { name: '/gui_command',          type: 'std_msgs/msg/String' },
  cmdVel:      { name: '/cmd_vel',              type: 'geometry_msgs/msg/Twist' },
};

// ─── Robot Durumları — Görev 10 (a–h) ───────────────────────────────────────
// Robot bu tanımlardan birini /robot_state topic'inde yayınlar.
export const ROBOT_STATES = {
  IDLE:            { key: 'IDLE',            label: 'Göreve Hazır (Idle)',            icon: '🟢', color: '#22c55e', desc: 'Bekleme konumunda, göreve hazır' },
  PROCESSING:      { key: 'PROCESSING',      label: 'Görev Alındı — İşleniyor',       icon: '⚙️', color: '#3b82f6', desc: 'Görev alındı, rota hesaplanıyor' },
  MOVING_EMPTY:    { key: 'MOVING_EMPTY',    label: 'Yüksüz Hareket',                 icon: '➡️', color: '#06b6d4', desc: 'Yük alma noktasına yüksüz gidiyor' },
  MOVING_LOADED:   { key: 'MOVING_LOADED',   label: 'Yüklü Hareket',                  icon: '📦', color: '#f59e0b', desc: 'Yük ile bırakma noktasına gidiyor' },
  WAITING_PLC:     { key: 'WAITING_PLC',     label: 'PLC Komutu Bekleniyor',          icon: '🚦', color: '#a855f7', desc: 'Kapı geçiş izni bekleniyor' },
  RETURNING:       { key: 'RETURNING',       label: 'Başlangıca Dönüş',               icon: '🏠', color: '#14b8a6', desc: 'Görev tamam, bekleme noktasına dönüyor' },
  ERROR:           { key: 'ERROR',           label: 'HATA',                           icon: '❌', color: '#ef4444', desc: 'Robotta hata durumu' },
  ESTOP:           { key: 'ESTOP',           label: 'ACİL STOP',                      icon: '🛑', color: '#dc2626', desc: 'Acil durdurma aktif' },
};

export const ROBOT_STATE_ORDER = [
  'IDLE', 'PROCESSING', 'MOVING_EMPTY', 'MOVING_LOADED',
  'WAITING_PLC', 'RETURNING', 'ERROR', 'ESTOP',
];

// ─── Yarışma Alanı Yerleşimi — Şekil 1 (metre, map frame) ───────────────────
// Placeholder koordinatlar: takım kendi haritalamasından sonra buradan kalibre eder.
// ARENA kutusu ~ 18m x 14m varsayıldı.
export const ARENA = {
  width: 18,
  height: 14,
  waypoints: [
    // Başlangıç / bekleme
    { id: 'START', label: 'Başlangıç', type: 'start', x: 2.0,  y: 2.0 },

    // Alma noktaları (A1–A3) — üst sıra
    { id: 'A1', label: 'A1', type: 'pickup', x: 3.0,  y: 12.0 },
    { id: 'A2', label: 'A2', type: 'pickup', x: 5.5,  y: 12.0 },
    { id: 'A3', label: 'A3', type: 'pickup', x: 8.0,  y: 12.0 },

    // Bırakma noktaları (B1–B3) — sağ sütun
    { id: 'B1', label: 'B1', type: 'dropoff', x: 16.0, y: 11.5 },
    { id: 'B2', label: 'B2', type: 'dropoff', x: 16.0, y: 7.0  },
    { id: 'B3', label: 'B3', type: 'dropoff', x: 16.0, y: 2.5  },

    // Düğüm noktaları (d1–d6)
    { id: 'd1', label: 'd1', type: 'node', x: 3.0,  y: 4.0 },
    { id: 'd2', label: 'd2', type: 'node', x: 5.5,  y: 4.0 },
    { id: 'd3', label: 'd3', type: 'node', x: 8.0,  y: 4.0 },
    { id: 'd4', label: 'd4', type: 'node', x: 12.0, y: 7.0 },
    { id: 'd5', label: 'd5', type: 'node', x: 9.0,  y: 4.0 },
    { id: 'd6', label: 'd6', type: 'node', x: 13.5, y: 11.5 },

    // QR kod noktaları (q1–q9)
    { id: 'q1', label: 'q1', type: 'qr', x: 2.4,  y: 3.0 },
    { id: 'q2', label: 'q2', type: 'qr', x: 3.4,  y: 10.5 },
    { id: 'q3', label: 'q3', type: 'qr', x: 5.9,  y: 10.5 },
    { id: 'q4', label: 'q4', type: 'qr', x: 8.4,  y: 10.5 },
    { id: 'q5', label: 'q5', type: 'qr', x: 9.4,  y: 4.5 },   // kapı kontrol noktası
    { id: 'q7', label: 'q7', type: 'qr', x: 15.4, y: 3.0 },
    { id: 'q8', label: 'q8', type: 'qr', x: 15.4, y: 7.5 },
    { id: 'q9', label: 'q9', type: 'qr', x: 15.4, y: 12.0 },

    // Fabrika otomasyon sistemi kontrollü kapı
    { id: 'DOOR', label: 'PLC Kapı', type: 'door', x: 9.0, y: 4.5 },
  ],
};

// ─── Toleranslar — Görev 7 & 8 (ceza puanı sınırları) ───────────────────────
export const TOLERANCES = {
  routeDeviation: 0.10,  // m — rotadan max sapma (Görev 7)
  position:       0.075, // m — konum toleransı ±7.5 cm (Görev 8a)
  heading:        5.0,   // derece — yön toleransı ±5° (Görev 8b)
  qrDistance:     1.5,   // m — QR kod yük noktası öncesi mesafe (Görev 4/5)
};

// ─── Yarışma Süresi — Senaryo Adım 12 ───────────────────────────────────────
export const TIMING = {
  targetMinutes: 30,  // hedef süre
  limitMinutes:  45,  // üst limit
  earlyBonusPerMin: +1,
  latePenaltyPerMin: -1,
};

// ─── Puanlama Tablosu — Tablo 4 ─────────────────────────────────────────────
// GUI'de canlı puan panosu olarak gösterilir. Her kalem robot verisi/operatör
// onayı ile 'done | fail | pending' durumuna geçer.
export const SCORING = [
  { id: 'sunum',        label: 'Sunum',                                    points: +10, kind: 'bonus' },
  { id: 'haritalama',   label: 'Haritalama',                               points: +30, kind: 'task', topic: 'map' },
  { id: 'rota',         label: 'Rota hazırlama',                           points: +20, kind: 'task', topic: 'globalPlan' },
  { id: 'plc',          label: 'Fabrika otomasyon sistemi ile haberleşme', points: +20, kind: 'task', topic: 'plcStatus' },
  { id: 'cizgi',        label: 'Görüntü işleme ile çizgi takibi',          points: +10, kind: 'task', topic: 'lineCam' },
  { id: 'qr',           label: 'QR kod okuma',                             points: +10, kind: 'task', topic: 'qrCode' },
  { id: 'carpisma',     label: 'Çarpışma engelleme',                       points: +10, kind: 'task', topic: 'scan' },
  { id: 'kapi',         label: 'PLC ile haberleşip kontrollü kapıdan geçiş',points: +20, kind: 'task', topic: 'plcStatus' },
  { id: 'gui',          label: 'Kullanıcı arayüzü + tüm bilgiler',         points: +20, kind: 'auto' },  // bu arayüz
  { id: 'gorev',        label: 'Tanımlı görevi tamamlama',                 points: +30, kind: 'task' },
  { id: 'yerlilik',     label: 'Yerlilik',                                 points: +5,  kind: 'bonus' },
  { id: 'ozgunluk',     label: 'Özgünlük',                                 points: +5,  kind: 'bonus' },
  { id: 'sarj',         label: 'Otomatik şarj kabiliyeti',                 points: +5,  kind: 'bonus' },
];

// Ceza kalemleri (canlı sayaçlar)
export const PENALTIES = [
  { id: 'sapma',    label: 'Rota dışına sapma (>10cm)',   points: -5, maxCount: 2 },
  { id: 'tolerans', label: 'Bölge toleransı dışı',         points: -5, maxCount: 2 },
  { id: 'dusme',    label: 'Yük düşürme',                  points: 0,  maxCount: 2, note: '2. düşürmede görev başarısız' },
  { id: 'mudahale', label: 'Kontrol paneline müdahale',    points: -5, maxCount: 2 },
  { id: 'gecikme',  label: 'Görevi geç tamamlama (dk)',    points: -1, maxCount: 15 },
];

// ─── GUI komut sözlüğü ──────────────────────────────────────────────────────
export const COMMANDS = {
  START:      'start',
  STOP:       'stop',
  EMERGENCY:  'emergency',
  RESET:      'reset',
  START_MAP:  'start_mapping',
  SAVE_MAP:   'save_map',
  PLAN_ROUTE: 'plan_route',
  RESEND:     'resend_plan',
  RETURN:     'return_home',
  DOCK:       'auto_dock',
};
