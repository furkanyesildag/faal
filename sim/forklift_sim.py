#!/usr/bin/env python3
# ============================================================================
# TEKNOFEST 2026 — Otonom Forklift AMR · Gerçek ROS2 Simülatör Node'u
# Duvarlara ışın-izleme ile GERÇEK sensor_msgs/LaserScan üretir; böylece
# slam_toolbox gerçek bir /map çıkarabilir. Ayrıca /odom, /tf ve şartnamenin
# tüm yarışma topic'lerini (robot durumu, PLC, QR, görev, batarya...) yayınlar
# ve robotu yarışma senaryosu boyunca hareket ettirir.
#   RViz + rosbridge + GUI hepsi bu node'un gerçek verisini görür.
# ============================================================================
import math, json, io
import numpy as np
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, QoSDurabilityPolicy, QoSReliabilityPolicy

from geometry_msgs.msg import TransformStamped, Twist
from nav_msgs.msg import Odometry
from sensor_msgs.msg import LaserScan, BatteryState, CompressedImage
from std_msgs.msg import String, Float32
from tf2_ros import TransformBroadcaster, StaticTransformBroadcaster

try:
    from PIL import Image, ImageDraw
    HAVE_PIL = True
except Exception:
    HAVE_PIL = False

# ─── Yarışma alanı (metre) — GUI ARENA ile aynı ─────────────────────────────
WP = {
    'START': (2.0, 2.0),
    'A1': (3.0, 11.5), 'A2': (5.5, 11.5), 'A3': (8.0, 11.5),
    'B1': (15.5, 11.5), 'B2': (15.5, 7.0), 'B3': (15.5, 2.5),
    'd1': (3.0, 4.0), 'd2': (5.5, 4.0), 'd3': (8.0, 4.0),
    'd4': (12.0, 7.0), 'd5': (9.0, 4.0), 'd6': (13.5, 11.5),
    'q5': (9.4, 4.5),
}
# senaryo: (nokta, robot_durumu, görev_adımı, [qr], [yük], [kapı], [bekle_sn])
ROUTE = [
    ('START', 'IDLE',          1, None, None,  False, 2),
    ('d1',    'PROCESSING',    1, None, None,  False, 0),
    ('d2',    'MOVING_EMPTY',  2, None, None,  False, 0),
    ('A2',    'MOVING_EMPTY',  3, 'A2', None,  False, 0),
    ('A2',    'PROCESSING',    4, None, True,  False, 3),
    ('d2',    'MOVING_LOADED', 5, None, None,  False, 0),
    ('d5',    'MOVING_LOADED', 5, None, None,  False, 0),
    ('q5',    'WAITING_PLC',   6, 'q5', None,  True,  4),
    ('d4',    'MOVING_LOADED', 7, None, None,  False, 0),
    ('B2',    'MOVING_LOADED', 7, 'B2', None,  False, 0),
    ('B2',    'PROCESSING',    8, None, False, False, 3),
    ('d4',    'WAITING_PLC',   9, None, None,  True,  3),
    ('d5',    'RETURNING',    10, None, None,  False, 0),
    ('d1',    'RETURNING',    10, None, None,  False, 0),
    ('START', 'IDLE',         10, None, None,  False, 0),
]

# ─── Dünya (statik duvarlar) — SLAM bunları haritalayacak ────────────────────
def build_walls():
    segs = []
    def rect(x0, y0, x1, y1):
        segs.extend([((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)),
                     ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))])
    rect(0, 0, 18, 14)                       # dış duvarlar
    # orta bölme + kapı boşluğu (y≈4.5)
    segs.append(((9.0, 0.0), (9.0, 3.9)))
    segs.append(((9.0, 5.1), (9.0, 14.0)))
    # birkaç engel kutusu
    rect(6.6, 8.0, 7.4, 8.8)
    rect(12.6, 9.6, 13.4, 10.4)
    return segs

WALLS = build_walls()

def ray_hit(px, py, ang, max_r):
    dx, dy = math.cos(ang), math.sin(ang)
    best = max_r
    for (ax, ay), (bx, by) in WALLS:
        ex, ey = bx - ax, by - ay
        den = dx * ey - dy * ex
        if abs(den) < 1e-9:
            continue
        t = ((ax - px) * ey - (ay - py) * ex) / den   # ışın parametresi
        u = ((ax - px) * dy - (ay - py) * dx) / den    # segment parametresi
        if t > 0 and 0 <= u <= 1 and t < best:
            best = t
    return best


class ForkliftSim(Node):
    def __init__(self):
        super().__init__('forklift_sim')
        latched = QoSProfile(depth=1, durability=QoSDurabilityPolicy.TRANSIENT_LOCAL,
                             reliability=QoSReliabilityPolicy.RELIABLE)

        self.pub_odom  = self.create_publisher(Odometry, '/odom', 10)
        self.pub_scan  = self.create_publisher(LaserScan, '/scan', 10)
        self.pub_state = self.create_publisher(String, '/robot_state', latched)
        self.pub_mode  = self.create_publisher(String, '/control_mode', latched)
        self.pub_qr    = self.create_publisher(String, '/qr_code', 10)
        self.pub_plan  = self.create_publisher(String, '/mission_plan', latched)
        self.pub_stat  = self.create_publisher(String, '/mission_status', 10)
        self.pub_plcs  = self.create_publisher(String, '/plc/status', latched)
        self.pub_plcm  = self.create_publisher(String, '/plc/message', 10)
        self.pub_line  = self.create_publisher(Float32, '/line_offset', 10)
        self.pub_dev   = self.create_publisher(Float32, '/route_deviation', 10)
        self.pub_bat   = self.create_publisher(BatteryState, '/battery_state', 10)
        self.pub_cam   = self.create_publisher(CompressedImage, '/line_camera/compressed', 10)

        self.tf  = TransformBroadcaster(self)
        self.stf = StaticTransformBroadcaster(self)
        self._static_tf()

        # başlangıç durumu
        self.seg = 0; self.t = 0.0; self.pause = 2.0
        self.x, self.y = WP['START']; self.th = 0.0
        self.load = False; self.door = 'CLOSED'; self.qr = '--'
        self.state = 'IDLE'; self.step = 1; self.batt = 92.0; self.elapsed = 0.0
        self.speed = 0.7; self.door_open_at = None
        # komut/kontrol durumu
        self.running = False        # BAŞLAT'a kadar bekler
        self.goto_target = None     # ('ID',(x,y)) → doğrudan git
        self.docking = False; self.mapping = False; self.charging = False
        self.mode = 'AUTO'          # robot anahtarı (AUTO/MANUAL)
        self.man_v = 0.0; self.man_w = 0.0; self.man_until = 0.0

        # görev planı (latched + periyodik tekrar; rosbridge volatile abone olduğu
        # için geç bağlanan GUI'ler ilk latched örneği kaçırmasın diye tekrar edilir)
        self.plan_json = json.dumps([
            {'id': 1,  'action': 'goto_waypoint', 'desc': 'Başlangıç → d1'},
            {'id': 2,  'action': 'goto_waypoint', 'desc': 'Alma noktasına ilerle (A2)'},
            {'id': 3,  'action': 'line_follower', 'desc': 'QR sonrası çizgi takibi'},
            {'id': 4,  'action': 'pick_load',     'desc': 'Yükü al (palet)'},
            {'id': 5,  'action': 'goto_waypoint', 'desc': 'q5 kapı kontrol noktası'},
            {'id': 6,  'action': 'wait_plc',      'desc': 'PLC kapı geçiş izni'},
            {'id': 7,  'action': 'goto_waypoint', 'desc': 'Bırakma noktası (B2)'},
            {'id': 8,  'action': 'drop_load',     'desc': 'Yükü bırak'},
            {'id': 9,  'action': 'wait_plc',      'desc': 'Dönüşte kapıdan geç'},
            {'id': 10, 'action': 'return_home',   'desc': 'Bekleme noktasına dön'},
        ])
        self.pub_mode.publish(String(data='AUTO'))
        self.pub_plan.publish(String(data=self.plan_json))
        self.publish_state(); self.publish_plc()

        # komut dinleyicileri (GUI → robot)
        self.create_subscription(String, '/gui_command', self.on_cmd, 10)
        self.create_subscription(Twist, '/cmd_vel', self.on_cmdvel, 10)

        self.dt = 0.1
        self.create_timer(self.dt, self.tick)            # 10 Hz hareket
        self.create_timer(0.15, self.publish_scan)       # ~6-7 Hz lidar
        self.create_timer(1.0, self.publish_slow)        # 1 Hz batarya/kamera
        self.create_timer(2.0, self.republish_latched)   # görev planı/mod tekrarı
        self.get_logger().info('Forklift simülatörü çalışıyor: /odom /scan /tf + yarışma topic\'leri')

    def republish_latched(self):
        self.pub_plan.publish(String(data=self.plan_json))
        self.pub_mode.publish(String(data=self.mode))

    # ── statik tf: base_footprint → base_scan ──
    def _static_tf(self):
        t = TransformStamped()
        t.header.stamp = self.get_clock().now().to_msg()
        t.header.frame_id = 'base_footprint'
        t.child_frame_id = 'base_scan'
        t.transform.translation.z = 0.2
        t.transform.rotation.w = 1.0
        self.stf.sendTransform(t)

    def yaw_quat(self, th):
        return (0.0, 0.0, math.sin(th / 2), math.cos(th / 2))

    def _log_msg(self, dir_, text):
        self.pub_plcm.publish(String(data=json.dumps({'dir': dir_, 'text': text})))

    def _status(self, desc):
        self.pub_stat.publish(String(data=json.dumps(
            {'step_id': self.step, 'action': self.state, 'desc': desc})))

    def on_cmd(self, msg):
        cmd = (msg.data or '').strip()
        self.get_logger().info(f'GUI komutu: {cmd}')

        if cmd == 'resend_plan':
            self.pub_plan.publish(String(data=self.plan_json))
            self._status('plan yeniden gönderildi')

        elif cmd == 'start':
            if self.state == 'ESTOP':
                self.state = 'IDLE'
            self.running = True
            if self.state == 'IDLE' and self.seg == 0:
                self.state = 'PROCESSING'
            self.publish_state(); self._status('Görev başlatıldı'); self._log_msg('TX', 'Görev başlatıldı')

        elif cmd == 'stop':
            self.running = False
            self._status('Duraklatıldı'); self._log_msg('TX', 'Robot duraklatıldı')

        elif cmd == 'emergency':
            self.running = False
            self.state = 'ESTOP'
            self.goto_target = None
            self.publish_state(); self._status('ACİL STOP'); self._log_msg('TX', 'ACİL STOP etkin')

        elif cmd == 'reset':
            self.seg = 0; self.t = 0.0; self.pause = 0.0
            self.x, self.y = WP['START']; self.th = 0.0
            self.state = 'IDLE'; self.step = 1; self.load = False
            self.door = 'CLOSED'; self.door_open_at = None
            self.running = False; self.goto_target = None; self.elapsed = 0.0
            self.publish_state(); self.publish_plc(); self._status('Sıfırlandı — başlangıç konumu')

        elif cmd == 'return_home':
            self.goto_target = ('START', WP['START'])
            self.state = 'RETURNING'; self.running = True
            self.publish_state(); self._status('Bekleme noktasına dönülüyor'); self._log_msg('TX', 'Başlangıca dönüş')

        elif cmd == 'auto_dock':
            self.goto_target = ('START', WP['START'])
            self.state = 'RETURNING'; self.running = True; self.docking = True
            self.publish_state(); self._status('Otomatik şarj istasyonuna gidiliyor')

        elif cmd.startswith('goto:'):
            tgt = cmd.split(':', 1)[1].strip().upper()
            if tgt in WP:
                self.goto_target = (tgt, WP[tgt])
                self.state = 'MOVING_LOADED' if self.load else 'MOVING_EMPTY'
                self.running = True; self.docking = False
                self.publish_state(); self._status(f'{tgt} noktasına gidiliyor')
                self._log_msg('TX', f'Hedef: {tgt}')
            else:
                self._status(f'Bilinmeyen hedef: {tgt}')

        elif cmd == 'plan_route':
            self.pub_plan.publish(String(data=self.plan_json))
            self._status('Rota yeniden planlandı')

        elif cmd == 'start_mapping':
            self.mapping = True
            self._status('Haritalama modu aktif'); self._log_msg('TX', 'Haritalama başladı')

        elif cmd == 'save_map':
            self._save_map()

        elif cmd in ('manual', 'auto') or cmd.startswith('set_mode:'):
            m = cmd.split(':', 1)[1].upper() if ':' in cmd else cmd.upper()
            self.mode = 'MANUAL' if m == 'MANUAL' else 'AUTO'
            self.pub_mode.publish(String(data=self.mode))
            self._status(f'Kontrol modu: {self.mode}'); self._log_msg('TX', f'Mod: {self.mode}')

        else:
            self.get_logger().warn(f'Tanınmayan komut: {cmd}')

    def _save_map(self):
        try:
            from slam_toolbox.srv import SaveMap
            from std_msgs.msg import String as StdStr
            cli = self.create_client(SaveMap, '/slam_toolbox/save_map')
            if cli.wait_for_service(timeout_sec=1.0):
                req = SaveMap.Request(); req.name = StdStr(data='forklift_map')
                cli.call_async(req)
                self._status('Harita kaydedildi: forklift_map'); self._log_msg('TX', 'Harita kaydedildi')
            else:
                self._status('Harita kaydetme servisi bulunamadı')
        except Exception as e:
            self.get_logger().warn(f'save_map: {e}')

    def on_cmdvel(self, msg):
        # Manuel teleop (robot anahtarı MANUAL iken GUI /cmd_vel yayınlar)
        if self.mode == 'MANUAL':
            self.man_v = float(msg.linear.x)
            self.man_w = float(msg.angular.z)
            self.man_until = self.elapsed + 0.4  # komut zaman aşımı

    def _emit_extras(self, v):
        self._publish_odom(v)
        self.pub_line.publish(Float32(data=float(math.sin(self.elapsed * 2) * 25)))
        self.pub_dev.publish(Float32(data=float(abs(math.sin(self.elapsed)) * 0.04)))

    # ── ana döngü: senaryo hareketi + odom + tf ──
    def tick(self):
        self.elapsed += self.dt

        # kapı gecikmeli açılışı
        if self.door_open_at is not None and self.elapsed >= self.door_open_at:
            self.door = 'OPEN'; self.door_open_at = None; self.publish_plc()

        # otomatik şarj (dock tamamlanınca batarya dolar)
        if self.docking and self.goto_target is None:
            self.charging = True

        # ── MANUEL teleop (robot anahtarı MANUAL) ──
        if self.mode == 'MANUAL':
            if self.elapsed <= self.man_until:
                self.th += self.man_w * self.dt
                self.x += self.man_v * math.cos(self.th) * self.dt
                self.y += self.man_v * math.sin(self.th) * self.dt
                self._emit_extras(self.man_v)
            else:
                self._emit_extras(0.0)
            return

        # ── ACİL STOP veya duraklatma: hareket yok ──
        if self.state == 'ESTOP' or not self.running:
            self._emit_extras(0.0)
            return

        # ── Doğrudan hedefe git (goto / return / dock) ──
        if self.goto_target is not None:
            name, (tx, ty) = self.goto_target
            dx, dy = tx - self.x, ty - self.y
            d = math.hypot(dx, dy)
            if d < 0.08:
                self.goto_target = None
                self.running = False          # hedefte dur (senaryoya geri sıçrama olmasın)
                self.state = 'IDLE'
                self.publish_state(); self._status(f'{name} noktasına ulaşıldı')
                self._log_msg('TX', f'{name} noktasına ulaşıldı')
                self._emit_extras(0.0)
            else:
                self.th = math.atan2(dy, dx)
                step = min(self.speed * self.dt, d)
                self.x += step * math.cos(self.th)
                self.y += step * math.sin(self.th)
                self._emit_extras(self.speed)
            return

        # ── Duraklama (yükleme/kapı) ──
        if self.pause > 0:
            self.pause -= self.dt
            self._emit_extras(0.0)
            return

        cur = ROUTE[self.seg]
        nxt = ROUTE[min(self.seg + 1, len(ROUTE) - 1)]
        fx, fy = WP[cur[0]]; tx, ty = WP[nxt[0]]
        dx, dy = tx - fx, ty - fy
        dist = math.hypot(dx, dy) or 1e-4
        self.t += (self.speed * self.dt) / dist

        if self.t >= 1.0:
            self.t = 0.0
            self.seg = min(self.seg + 1, len(ROUTE) - 1)
            n = ROUTE[self.seg]
            self.state, self.step = n[1], n[2]
            if n[3]:
                self.qr = n[3]
                self.pub_qr.publish(String(data=json.dumps(
                    {'data': n[3], 'dist': 1.4, 'x': round(float(np.random.uniform(-0.05, 0.05)), 3)})))
            if n[4] is not None:
                self.load = n[4]
                self.pub_plcm.publish(String(data=json.dumps(
                    {'dir': 'TX', 'text': 'Yük alındı' if n[4] else 'Yük teslim edildi'})))
            if n[5]:
                self.door = 'OPENING'
                self.door_open_at = self.elapsed + 1.5
                self.pub_plcm.publish(String(data=json.dumps({'dir': 'TX', 'text': 'Kapı kontrol noktasına ulaşıldı'})))
                self.pub_plcm.publish(String(data=json.dumps({'dir': 'RX', 'text': 'PLC: geçebilirsin, kapı açılıyor'})))
            self.pause = n[6]
            self.publish_state(); self.publish_plc()
            self.pub_stat.publish(String(data=json.dumps(
                {'step_id': self.step, 'action': n[1], 'desc': f'{cur[0]}→{nxt[0]}'})))
            if self.seg >= len(ROUTE) - 1:
                self.seg = 0

        self.x = fx + dx * self.t
        self.y = fy + dy * self.t
        self.th = math.atan2(dy, dx)
        self._emit_extras(self.speed)

    def _publish_odom(self, v):
        now = self.get_clock().now().to_msg()
        qx, qy, qz, qw = self.yaw_quat(self.th)
        # tf odom → base_footprint
        t = TransformStamped()
        t.header.stamp = now; t.header.frame_id = 'odom'; t.child_frame_id = 'base_footprint'
        t.transform.translation.x = self.x; t.transform.translation.y = self.y
        t.transform.rotation.x = qx; t.transform.rotation.y = qy
        t.transform.rotation.z = qz; t.transform.rotation.w = qw
        self.tf.sendTransform(t)
        # odom mesajı
        o = Odometry()
        o.header.stamp = now; o.header.frame_id = 'odom'; o.child_frame_id = 'base_footprint'
        o.pose.pose.position.x = self.x; o.pose.pose.position.y = self.y
        o.pose.pose.orientation.x = qx; o.pose.pose.orientation.y = qy
        o.pose.pose.orientation.z = qz; o.pose.pose.orientation.w = qw
        o.twist.twist.linear.x = float(v)
        self.pub_odom.publish(o)

    # ── gerçek lidar taraması (ışın-izleme) ──
    def publish_scan(self):
        n = 360
        amin, amax = -math.pi, math.pi
        ainc = (amax - amin) / n
        rmax = 12.0
        ranges = []
        for i in range(n):
            a = self.th + amin + i * ainc
            r = ray_hit(self.x, self.y, a, rmax)
            r += float(np.random.normal(0, 0.01))       # gerçekçi gürültü
            ranges.append(max(0.12, min(r, rmax)))
        s = LaserScan()
        s.header.stamp = self.get_clock().now().to_msg()
        s.header.frame_id = 'base_scan'
        s.angle_min = amin; s.angle_max = amax; s.angle_increment = ainc
        s.range_min = 0.1; s.range_max = rmax
        s.ranges = ranges
        self.pub_scan.publish(s)

    # ── batarya + kamera ──
    def publish_slow(self):
        if self.charging:
            self.batt = min(100.0, self.batt + 0.5)   # şarj oluyor
        else:
            self.batt = max(60.0, self.batt - 0.05)
        b = BatteryState()
        b.header.stamp = self.get_clock().now().to_msg()
        b.percentage = float(self.batt / 100.0)
        b.voltage = float(24.0 * self.batt / 100.0 + 0.5)
        b.power_supply_status = 1 if self.charging else 2  # 1=charging 2=discharging
        self.pub_bat.publish(b)
        if HAVE_PIL:
            self._publish_camera()

    def _publish_camera(self):
        W, H = 320, 200
        img = Image.new('RGB', (W, H), (30, 30, 34))
        d = ImageDraw.Draw(img)
        off = int(math.sin(self.elapsed * 2) * 40)
        cx = W // 2 + off
        d.rectangle([cx - 14, 0, cx + 14, H], fill=(235, 235, 235))   # takip çizgisi
        d.line([W // 2, 0, W // 2, H], fill=(90, 160, 255), width=1)  # kamera merkezi
        buf = io.BytesIO(); img.save(buf, format='JPEG', quality=70)
        m = CompressedImage()
        m.header.stamp = self.get_clock().now().to_msg()
        m.format = 'jpeg'; m.data = buf.getvalue()
        self.pub_cam.publish(m)

    def publish_state(self):
        self.pub_state.publish(String(data=self.state))

    def publish_plc(self):
        self.pub_plcs.publish(String(data=json.dumps(
            {'connected': True, 'door': self.door, 'waiting': self.state == 'WAITING_PLC'})))


def main():
    rclpy.init()
    node = ForkliftSim()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
