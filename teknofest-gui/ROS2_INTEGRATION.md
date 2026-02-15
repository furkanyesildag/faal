# RACLAB FAAL - ROS2 Humble Entegrasyonu

## 🚀 ROS2 Kurulumu (Ubuntu 22.04)

Bu arayüz **ROS2 Humble** ile çalışmak üzere tasarlanmıştır.

### 1. ROSBridge Suite Kurulumu

ROSBridge, React arayüzü ile ROS2 arasında WebSocket bağlantısı sağlar:

```bash
sudo apt update
sudo apt install ros-humble-rosbridge-suite
```

### 2. ROSBridge Başlatma

ROS2 workspace'inizde:

```bash
# ROS2 ortamını aktifleştir
source /opt/ros/humble/setup.bash
source ~/ros2_ws/install/setup.bash

# ROSBridge WebSocket sunucusunu başlat
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

Varsayılan olarak `ws://localhost:9090` adresinde çalışır.

### 3. Gerekli ROS2 Topic'ler

Arayüzün tamamen çalışması için şu topic'lerin yayınlanması gerekir:

#### **Odometry** (`/odom`)
- **Mesaj Tipi:** `nav_msgs/Odometry`
- **Açıklama:** Robot pozisyonu (X, Y, Yaw) ve hız bilgileri
- **Yayın Frekansı:** ~10 Hz

```bash
# Test için dummy odometry
ros2 topic pub /odom nav_msgs/Odometry "{pose: {pose: {position: {x: 2.0, y: 3.0, z: 0.0}}}}" --rate 10
```

#### **SLAM Haritası** (`/map`)
- **Mesaj Tipi:** `nav_msgs/OccupancyGrid`
- **Açıklama:** SLAM harita verisi (Nav2 SLAM Toolbox'tan)
- **Yayın:** Genellikle SLAM node'u tarafından otomatik yayınlanır

```bash
# SLAM Toolbox örneği
ros2 launch slam_toolbox online_async_launch.py
```

#### **QR Code** (`/qr_code`) - Opsiyonel
- **Mesaj Tipi:** `std_msgs/String`
- **Açıklama:** Son okunan QR kod

```bash
# Test için
ros2 topic pub /qr_code std_msgs/String "{data: 'A3'}"
```

#### **RFID Tag** (`/rfid_tag`) - Opsiyonel
- **Mesaj Tipi:** `std_msgs/String`
- **Açıklama:** Son okunan RFID etiketi

```bash
# Test için
ros2 topic pub /rfid_tag std_msgs/String "{data: 'BOX-1234'}"
```

## 🖥️ React Arayüzünü Başlatma

```bash
cd teknofest-gui
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` adresine gidin.

## 🔧 ROS Bağlantı Ayarları

Varsayılan WebSocket adresi: `ws://localhost:9090`

Başka bir adres kullanmak için `src/App.jsx` dosyasında:

```javascript
const rosURL = 'ws://ROBOT_IP:9090'; // Değiştirin
```

## 📊 Çalışma Modları

### 1. **GERÇEK VERİ MODU** (ROS2 Bağlı)
- ROSBridge bağlandığında otomatik aktif olur
- Header'da `ROS2 ONLINE` gösterir (yeşil)
- Harita overlay'inde `• GERÇEK VERİ` yazar
- Tüm veriler `/odom`, `/map` vb. topic'lerden gelir

### 2. **SİMÜLASYON MODU** (ROS2 Yok)
- ROS bağlantısı yoksa otomatik aktif olur
- Header'da `OFFLINE` gösterir (turuncu)
- Harita overlay'inde `• SİMÜLASYON` yazar
- Veriler simüle edilir

## 🧪 Test Senaryosu

1. **ROSBridge'i başlatın:**
   ```bash
   ros2 launch rosbridge_server rosbridge_websocket_launch.xml
   ```

2. **Odometry yayınlayın:**
   ```bash
   ros2 topic pub /odom nav_msgs/Odometry "{
     pose: {
       pose: {
         position: {x: 5.0, y: 3.0, z: 0.0},
         orientation: {x: 0.0, y: 0.0, z: 0.0, w: 1.0}
       }
     },
     twist: {
       twist: {
         linear: {x: 0.5, y: 0.0, z: 0.0},
         angular: {x: 0.0, y: 0.0, z: 0.1}
       }
     }
   }" --rate 10
   ```

3. **React arayüzünü açın** ve header'da `ROS2 ONLINE` görmeli, haritada robot pozisyonu güncellenmelidir.

## 🎯 TEKNOFEST Yarışma Notları

- **SLAM:** Nav2 SLAM Toolbox veya Cartographer kullanımı önerilir
- **Lokalizasyon:** AMCL veya Nav2 ile pozisyon takibi
- **Sensörler:** Kamera, LiDAR, IMU verilerinin ROS2 topic'leri üzerinden yayınlanması
- **Autonomy:** Nav2 navigation stack entegrasyonu

## 📞 Destek

Sorularınız için RACLAB FAAL Takımı ile iletişime geçin.

**TEKNOFEST 2025** 🚀
