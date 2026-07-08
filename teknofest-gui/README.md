# RACLAB · FAAL — Otonom Forklift AMR · Kontrol Merkezi

TEKNOFEST 2026 **Sanayide Robotik Uygulamalar Yarışması** için geliştirilen
web tabanlı kontrol ve izleme arayüzü. Tüm verisini ROS2 / RViz / Gazebo
dünyasından `rosbridge` (WebSocket) üzerinden alır.

## Paneller (şartname Görev 10 karşılığı)
- **Robot Durumu** — 8 durum (idle, işleniyor, yüksüz/yüklü hareket, PLC bekleme, dönüş, hata, acil stop)
- **Fabrika Otomasyon (PLC)** — bağlantı + kapı durumu + alınıp verilen mesaj günlüğü
- **Harita & Navigasyon** — SLAM (OccupancyGrid) + 2D lidar + planlanan rota + alan işaretleri (A/B/düğüm/QR/kapı) + rota sapma halkası
- **Sensör / Telemetri** — okunan QR, hız, konum, yön, batarya, voltaj
- **Sistem Günlüğü** — canlı olay/komut kayıtları
- **Kontroller** — başlat/durdur/acil/reset/eve dön/şarj + manuel-kilitli teleop
- **Jarvis** — Türkçe komut ve canlı durum asistanı (Gemini opsiyonel)

## Çalıştırma
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # üretim derlemesi
```
Gerçek ROS2 test yığını (rosbridge + simülatör + slam + RViz) için `../sim/bringup.sh`.

## Konfigürasyon
- ROS köprü adresi + Gemini anahtarı: `.env`
- Topic isimleri, alan koordinatları, durumlar ve puanlama: `src/config/mission.js`

Ayrıntılı ROS2 entegrasyonu ve topic sözleşmesi için **ROS2_INTEGRATION.md**.
