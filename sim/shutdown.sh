#!/usr/bin/env bash
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for p in rviz slam sim rosbridge; do
  f="$HERE/.logs/$p.pid"
  [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null && echo "durduruldu: $p"
done
pkill -f async_slam_toolbox_node 2>/dev/null
pkill -f forklift_sim.py 2>/dev/null
pkill -f rosbridge_websocket 2>/dev/null
echo "temizlik tamam"
