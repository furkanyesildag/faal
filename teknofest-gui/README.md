# RACLAB · FAAL — Otonom Forklift AMR · Kontrol Merkezi

TEKNOFEST 2026 **Sanayide Robotik Uygulamalar Yarışması** için geliştirilen
web tabanlı kontrol ve izleme arayüzü. Tüm verisini ROS2 / RViz / Gazebo
dünyasından `rosbridge` (WebSocket) üzerinden alır.

## Paneller (şartname Görev 10 + Tablo 4 karşılığı)
- **Robot Durumu** — 8 durum (idle, işleniyor, yüksüz/yüklü hareket, PLC bekleme, dönüş, hata, acil stop)
- **Görev Planı** — adım listesi + 30 dk hedef / 45 dk limit süre sayacı
- **Fabrika Otomasyon (PLC)** — bağlantı + kapı durumu + alınıp verilen mesaj günlüğü
- **Harita & Navigasyon** — SLAM (OccupancyGrid) + 2D lidar + planlanan rota + alan işaretleri (A/B/düğüm/QR/kapı) + rota sapma halkası
- **Sensör HUD** — okunan QR, hız, konum, yön, batarya, voltaj
- **Çizgi Takip Kamerası** — görüntü + merkez sapma göstergesi
- **Canlı Puan Panosu** — Tablo 4 kriterleri
- **Uzaktan Teleop** — yalnızca robot anahtarı `MANUAL` iken aktif
- **Jarvis** — Gemini destekli asistan (opsiyonel)

## Çalıştırma
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # üretim derlemesi
```
> Not: DEMO düğmesi (sağ üst) ROS bağlı değilken tüm senaryoyu simüle eder —
> Hareket-Kabiliyet videosu ve jüri sunumu için kullanışlıdır.

## Konfigürasyon
- ROS köprü adresi + Gemini anahtarı: `.env`
- Topic isimleri, alan koordinatları, durumlar ve puanlama: `src/config/mission.js`

Ayrıntılı ROS2 entegrasyonu ve topic sözleşmesi için **ROS2_INTEGRATION.md**.
