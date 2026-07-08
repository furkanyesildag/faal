#!/usr/bin/env python3
# GUI'nin yaptığı gibi rosbridge WebSocket'ine bağlanıp topic'lere abone olur.
# Gelen mesajları sayar → GUI'nin gerçekten veri aldığını kanıtlar.
import json, time, sys
from websocket import create_connection   # pip: websocket-client

SUBS = {
    '/map':          'nav_msgs/msg/OccupancyGrid',
    '/odom':         'nav_msgs/msg/Odometry',
    '/scan':         'sensor_msgs/msg/LaserScan',
    '/robot_state':  'std_msgs/msg/String',
    '/plc/status':   'std_msgs/msg/String',
    '/qr_code':      'std_msgs/msg/String',
    '/mission_plan': 'std_msgs/msg/String',
    '/battery_state':'sensor_msgs/msg/BatteryState',
}
ws = create_connection('ws://localhost:9090', timeout=15)
for topic, typ in SUBS.items():
    ws.send(json.dumps({'op': 'subscribe', 'topic': topic, 'type': typ}))

counts = {t: 0 for t in SUBS}
sample = {}
deadline = time.time() + 12
while time.time() < deadline:
    try:
        msg = json.loads(ws.recv())
    except Exception:
        break
    if msg.get('op') == 'publish':
        t = msg['topic']
        counts[t] = counts.get(t, 0) + 1
        if t not in sample:
            m = msg['msg']
            if t == '/map':
                sample[t] = f"{m['info']['width']}x{m['info']['height']} @ {m['info']['resolution']}m"
            elif t == '/odom':
                p = m['pose']['pose']['position']; sample[t] = f"x={p['x']:.2f} y={p['y']:.2f}"
            elif t == '/scan':
                sample[t] = f"{len(m['ranges'])} ışın"
            elif t == '/battery_state':
                sample[t] = f"%{m['percentage']*100:.0f}"
            else:
                sample[t] = str(m.get('data'))[:60]
ws.close()

print('\n=== GUI rosbridge yolu doğrulaması (12 sn dinleme) ===')
ok = True
for t in SUBS:
    c = counts.get(t, 0)
    flag = '✓' if c > 0 else '✗ VERİ YOK'
    if c == 0: ok = False
    print(f"  {flag}  {t:<16} {c:>4} mesaj   {sample.get(t,'')}")
print('SONUÇ:', 'TÜM TOPIC\'LER GUI\'YE AKIYOR ✓' if ok else 'EKSİK VAR ✗')
sys.exit(0 if ok else 1)
