#!/usr/bin/env bash
# TEKNOFEST 2026 Forklift AMR — tam yığın ayağa kaldırma
# rosbridge + simülatör + slam_toolbox + RViz (+ opsiyonel GUI)
set -e
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="${HERE}/.logs"; mkdir -p "$LOG"

source /opt/ros/humble/setup.bash

echo "[1/4] rosbridge (ws://localhost:9090)…"
ros2 launch rosbridge_server rosbridge_websocket_launch.xml > "$LOG/rosbridge.log" 2>&1 &
echo $! > "$LOG/rosbridge.pid"; sleep 2

echo "[2/4] forklift simülatörü (/odom /scan /tf + yarışma topic'leri)…"
python3 "$HERE/forklift_sim.py" > "$LOG/sim.log" 2>&1 &
echo $! > "$LOG/sim.pid"; sleep 2

echo "[3/4] slam_toolbox (gerçek /map)…"
ros2 run slam_toolbox async_slam_toolbox_node \
  --ros-args --params-file "$HERE/slam.yaml" > "$LOG/slam.log" 2>&1 &
echo $! > "$LOG/slam.pid"; sleep 3

echo "[4/4] RViz2…"
ros2 run rviz2 rviz2 -d "$HERE/forklift.rviz" > "$LOG/rviz.log" 2>&1 &
echo $! > "$LOG/rviz.pid"

echo "Hazır. Durdurmak için: $HERE/shutdown.sh"
