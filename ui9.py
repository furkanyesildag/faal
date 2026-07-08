#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from PyQt5 import QtWidgets, QtCore
from PyQt5.QtGui import QPixmap, QImage, QFont, QFontDatabase
from nav_msgs.msg import Odometry, OccupancyGrid
from geometry_msgs.msg import Twist
from sensor_msgs.msg import Image
from ui5 import Ui_MainWindow
import tf_transformations as tf
import math
from cv_bridge import CvBridge
import cv2
import numpy as np
import os


class RosNode(Node):
    def __init__(self, updater):
        super().__init__('odom_listener')
        self.updater = updater

        self.cmd_vel_pub = self.create_publisher(Twist, '/cmd_vel', 10)

        self.create_subscription(Odometry, "/odom", self.odom_callback, 10)
        self.create_subscription(OccupancyGrid, "/map", self.map_callback, 10)

    def odom_callback(self, msg):
        x = msg.pose.pose.position.x
        y = msg.pose.pose.position.y
        orientation_q = msg.pose.pose.orientation
        orientation_list = [orientation_q.x, orientation_q.y,
                            orientation_q.z, orientation_q.w]
        _, _, yaw = tf.euler_from_quaternion(orientation_list)
        linear_velocity = msg.twist.twist.linear.x
        angular_velocity = msg.twist.twist.angular.z
        self.updater.update_values(x, y, yaw,
                                   linear_velocity, angular_velocity)

    def map_callback(self, msg):
        self.updater.map_data = msg


class OdomGuiUpdater(QtWidgets.QWidget):
    def __init__(self, main_window, ui):
        super().__init__(main_window)
        self.main_window = main_window
        self.ui = ui
        self.x = 0
        self.y = 0
        self.yaw = 0
        self.linear_velocity = 0
        self.angular_velocity = 0
        self.bridge = CvBridge()
        self.map_data = None

        self.ros_node = None

        self.timer = QtCore.QTimer()
        self.timer.timeout.connect(self.update_gui)
        self.timer.start(100)

    def attach_ros_node(self, node):
        self.ros_node = node

    def update_gui(self):
        yaw_degrees = math.degrees(self.yaw)
        self.ui.location_x.setText(f"X: {self.x:.2f}")
        self.ui.location_y.setText(f"Y: {self.y:.2f}")
        self.ui.yav.setText(f"Yaw: {yaw_degrees:.2f}°")
        self.ui.linear_velocity.setText(
            f"Linear Velocity: {self.linear_velocity:.2f} m/s")
        self.ui.angular_velocity.setText(
            f"Angular Velocity: {self.angular_velocity:.2f} rad/s")

        if self.map_data is not None:
            self.update_map(self.map_data)

        if self.ros_node is not None:
            rclpy.spin_once(self.ros_node, timeout_sec=0.0)

    def update_values(self, x, y, yaw, linear_velocity, angular_velocity):
        self.x = x
        self.y = y
        self.yaw = yaw
        self.linear_velocity = linear_velocity
        self.angular_velocity = angular_velocity

    def update_map(self, data):
        try:
            width = data.info.width
            height = data.info.height
            map_data = np.array(data.data, dtype=np.int8).reshape((height, width))
            map_data = np.flipud(map_data)

            img = np.zeros((height, width), dtype=np.uint8)
            img[map_data == -1] = 127
            img[map_data == 0] = 255
            img[map_data == 100] = 0

            in_range = (map_data > 0) & (map_data < 100)
            img[in_range] = 255 - (map_data[in_range] * 255 // 100)

            image = QImage(img.data, width, height,
                           img.strides[0], QImage.Format_Grayscale8)
            pixmap = QPixmap.fromImage(image)
            pixmap = pixmap.scaled(
                self.ui.map.size(),
                QtCore.Qt.KeepAspectRatio,
                QtCore.Qt.SmoothTransformation)

            self.ui.map.setPixmap(pixmap)
            self.ui.map.setAlignment(QtCore.Qt.AlignCenter)

        except Exception as e:
            print(f"Harita güncelleme hatası: {e}")

    def publish_cmd(self, linear=0.0, angular=0.0):
        if self.ros_node is None:
            return
        twist = Twist()
        twist.linear.x = linear
        twist.angular.z = angular
        self.ros_node.cmd_vel_pub.publish(twist)

    def move_forward(self):
        self.publish_cmd(0.5, 0.0)

    def move_backward(self):
        self.publish_cmd(-0.5, 0.0)

    def move_leftward(self):
        self.publish_cmd(0.0, -0.5)

    def move_rightward(self):
        self.publish_cmd(0.0, 0.5)

    def stop_robot(self):
        self.publish_cmd(0.0, 0.0)


def main():
    import sys
    rclpy.init()

    app = QtWidgets.QApplication(sys.argv)
    MainWindow = QtWidgets.QMainWindow()
    ui = Ui_MainWindow()
    ui.setupUi(MainWindow)

    updater = OdomGuiUpdater(MainWindow, ui)
    ros_node = RosNode(updater)
    updater.attach_ros_node(ros_node)

    MainWindow.show()
    exit_code = app.exec_()

    ros_node.destroy_node()
    rclpy.shutdown()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
