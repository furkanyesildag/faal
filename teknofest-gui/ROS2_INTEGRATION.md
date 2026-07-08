# RACLAB · FAAL — Otonom Forklift AMR · ROS2 Entegrasyonu

TEKNOFEST 2026 **Sanayide Robotik Uygulamalar Yarışması** için otonom forklift
AMR kontrol arayüzü. Bu arayüz, şartname **Görev 10** ve **Tablo 4** (Final
Değerlendirme Kriterleri) gereksinimlerinin tamamını karşılayacak şekilde
tasarlanmıştır ve tüm verisini ROS2 / RViz / Gazebo dünyasından `rosbridge`
üzerinden alır.

---

## 1. Kurulum

```bash
sudo apt install ros-humble-rosbridge-suite
# arayüz
cd teknofest-gui && npm install && npm run dev   # http://localhost:5173
# rosbridge (robot ya da PC üzerinde)
ros2 launch rosbridge_server rosbridge_websocket_launch.xml   # ws://localhost:9090
```

Bağlantı adresini değiştirmek için `.env`:

```
VITE_ROSBRIDGE_URL=ws://<ROBOT_IP>:9090
VITE_GEMINI_API_KEY=<jarvis-asistanı-için-opsiyonel>
```

Tüm topic isimleri ve alan yerleşimi **tek dosyadan** yönetilir:
`src/config/mission.js`.

---

## 2. Şartname → Arayüz → Topic eşlemesi

### Görev 10 — Zorunlu arayüz bilgileri
| Şartname maddesi | Arayüz paneli | ROS2 Topic | Mesaj tipi |
|---|---|---|---|
| Forklift durum bilgisi (8 durum a–h) | **Robot Durumu** | `/robot_state` | `std_msgs/String` |
| Görev durum bilgisi | **Görev Planı** | `/mission_plan`, `/mission_status` | `std_msgs/String` (JSON) |
| Okunan QR kod bilgisi | **Sensör HUD** | `/qr_code` | `std_msgs/String` |
| PLC haberleşme durumu | **Fabrika Otomasyon (PLC)** | `/plc/status` | `std_msgs/String` (JSON) |
| Alınıp verilen mesajlar | **PLC mesaj günlüğü** | `/plc/message` | `std_msgs/String` (JSON) |
| Uzaktan manuel kontrol | **Kontroller → Teleop** | `/cmd_vel` (yayın), `/control_mode` (anahtar) | `geometry_msgs/Twist`, `std_msgs/String` |

> Uzaktan teleop **yalnızca** `/control_mode = MANUAL` iken açılır. Robot
> anahtarı `AUTO` yayınladığında uzaktan kontrol arayüzde kilitlenir (şartname
> gereği).

### 8 Robot Durumu (`/robot_state` içinde yayınlanacak anahtarlar)
`IDLE` · `PROCESSING` · `MOVING_EMPTY` · `MOVING_LOADED` · `WAITING_PLC` ·
`RETURNING` · `ERROR` · `ESTOP`

### Tablo 4 kriterleri → veri kaynağı (canlı puan panosu)
| Kriter | Puan | Kaynak |
|---|---|---|
| Haritalama | +30 | `/map` (OccupancyGrid) yayını |
| Rota hazırlama | +20 | `/plan` (nav_msgs/Path) yayını |
| PLC ile haberleşme | +20 | `/plc/status.connected` |
| Görüntü işleme ile çizgi takibi | +10 | `/line_camera/compressed`, `/line_offset` |
| QR kod okuma | +10 | `/qr_code` |
| Çarpışma engelleme | +10 | `/scan` (LaserScan) |
| Kontrollü kapıdan geçiş | +20 | `/plc/status.door` |
| Görevi tamamlama | +30 | `/mission_status.step_id` |
| Süre (erken/geç) | ±dk | arayüz sayacı (30 dk hedef / 45 dk limit) |
| Rota sapma / bölge toleransı | −5 | `/route_deviation`, tolerans halkası |

---

## 3. Beklenen Topic'ler (tam liste)

| Topic | Tip | Açıklama | Kaynak |
|---|---|---|---|
| `/odom` | `nav_msgs/Odometry` | Konum, yön, hız | EKF / ros2_control |
| `/map` | `nav_msgs/OccupancyGrid` | SLAM haritası | slam_toolbox |
| `/scan` | `sensor_msgs/LaserScan` | 2D lidar (haritalama + çarpışma) | lidar sürücüsü |
| `/plan` | `nav_msgs/Path` | Planlanan global rota | Nav2 |
| `/robot_state` | `std_msgs/String` | 8 durumdan biri | görev yöneticisi |
| `/control_mode` | `std_msgs/String` | `AUTO` / `MANUAL` anahtarı | donanım anahtarı |
| `/mission_plan` | `std_msgs/String` | JSON `[{id,action,desc}]` | görev yöneticisi |
| `/mission_status` | `std_msgs/String` | JSON `{step_id,action,desc}` | görev yöneticisi |
| `/qr_code` | `std_msgs/String` | metin veya JSON `{data,x,y,dist}` | görüntü işleme |
| `/line_camera/compressed` | `sensor_msgs/CompressedImage` | çizgi takip kamerası | kamera |
| `/line_offset` | `std_msgs/Float32` | çizgi merkez sapması | görüntü işleme |
| `/route_deviation` | `std_msgs/Float32` | rotadan sapma (m) | kontrolcü |
| `/plc/status` | `std_msgs/String` | JSON `{connected,door,waiting}` | PLC köprüsü |
| `/plc/message` | `std_msgs/String` | JSON `{dir:'TX'\|'RX',text}` | PLC köprüsü |
| `/battery_state` | `sensor_msgs/BatteryState` | şarj / voltaj | BMS |
| `/gui_command` | `std_msgs/String` | arayüzden komut (start/stop/…) | **GUI yayınlar** |
| `/cmd_vel` | `geometry_msgs/Twist` | manuel teleop | **GUI yayınlar** |

### GUI komutları (`/gui_command`)
`start` · `stop` · `emergency` · `reset` · `start_mapping` · `save_map` ·
`plan_route` · `return_home` · `auto_dock` · `resend_plan`

---

## 4. Hızlı test (ROS olmadan görmek için)

Arayüzde sağ üstteki **DEMO** düğmesi, şartname senaryosunun tamamını
(başlangıç → alma → PLC/kapı → bırakma → dönüş) simüle ederek tüm panelleri
canlandırır. Hareket-Kabiliyet videosu ve jüri sunumu için idealdir.

### Gerçek veri ile test örnekleri
```bash
# Robot durumu
ros2 topic pub /robot_state std_msgs/String "{data: 'MOVING_LOADED'}"

# Kontrol modu (teleop kilidini açar)
ros2 topic pub /control_mode std_msgs/String "{data: 'MANUAL'}"

# QR (konumlu)
ros2 topic pub /qr_code std_msgs/String "{data: '{\"data\":\"A2\",\"dist\":1.4,\"x\":-0.03}'}"

# PLC durumu + mesaj
ros2 topic pub /plc/status  std_msgs/String "{data: '{\"connected\":true,\"door\":\"OPEN\",\"waiting\":false}'}"
ros2 topic pub /plc/message std_msgs/String "{data: '{\"dir\":\"RX\",\"text\":\"gecebilirsin\"}'}"

# Görev planı + aktif adım
ros2 topic pub /mission_plan   std_msgs/String "{data: '[{\"id\":1,\"action\":\"goto_waypoint\",\"desc\":\"A2ye git\"}]'}"
ros2 topic pub /mission_status std_msgs/String "{data: '{\"step_id\":1,\"action\":\"goto_waypoint\",\"desc\":\"A2ye git\"}'}"
```

`/gui_command` ve `/cmd_vel` topic'lerini robot tarafında dinleyip görev
yöneticisine bağlamak takımın sorumluluğundadır.

---

## 5. Yarışma alanı kalibrasyonu (Şekil 1)

`src/config/mission.js → ARENA.waypoints` içindeki A1–A3, B1–B3, düğüm (d1–d6),
QR (q1–q9) ve kapı koordinatları **placeholder**'dır. Takım, kendi
haritalamasını tamamladıktan sonra bu koordinatları map frame'e göre günceller;
harita üzerindeki işaretler otomatik olarak doğru yere oturur.

**TEKNOFEST 2026 · RACLAB · FAAL** 🚀
