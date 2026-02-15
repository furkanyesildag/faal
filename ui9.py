#!/usr/bin/env python3
import rospy
from PyQt5 import QtWidgets, QtCore
from PyQt5.QtGui import QPixmap, QImage, QFont, QFontDatabase
from nav_msgs.msg import Odometry, OccupancyGrid
from geometry_msgs.msg import Twist
from sensor_msgs.msg import Image
from ui5 import Ui_MainWindow
import tf.transformations as tf
import math
from cv_bridge import CvBridge
import cv2
import numpy as np
import os

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
        
        self.base_width = 1087
        self.base_height = 778
        self.last_scale = 1.0
        
        self.load_custom_font()
 
        self.timer = QtCore.QTimer()
        self.timer.timeout.connect(self.update_gui)
        self.timer.start(100)
 
        self.start_resize_timer()
 
        self.cmd_vel_pub = rospy.Publisher('/cmd_vel', Twist, queue_size=10)
 
        self.ui.pushButton_9.pressed.connect(self.move_leftward)
        self.ui.pushButton_9.released.connect(self.stop_robot)
        self.ui.pushButton_7.pressed.connect(self.move_forward)
        self.ui.pushButton_7.released.connect(self.stop_robot)
        self.ui.pushButton_6.pressed.connect(self.move_backward)
        self.ui.pushButton_6.released.connect(self.stop_robot)
        self.ui.pushButton_3.pressed.connect(self.move_rightward)
        self.ui.pushButton_3.released.connect(self.stop_robot)    
        self.ui.pushButton_8.pressed.connect(self.stop_robot)
        self.ui.pushButton_11.pressed.connect(self.stop_robot)

        self.map_data = None  
         
        self.add_background_image()
        
        QtCore.QTimer.singleShot(100, self.update_all_fonts)

    def load_custom_font(self):
        """Proje klasöründeki custom fontu yükle"""
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            font_dir = os.path.join(current_dir, "fonts")
            
            print(f"Font klasörü araniyor: {font_dir}")
            
            if os.path.exists(font_dir):
                for font_file in os.listdir(font_dir):
                    if font_file.endswith('.ttf') or font_file.endswith('.otf'):
                        font_path = os.path.join(font_dir, font_file)
                        print(f"Font dosyası bulundu: {font_file}")
                        font_id = QFontDatabase.addApplicationFont(font_path)
                        if font_id != -1:
                            font_families = QFontDatabase.applicationFontFamilies(font_id)
                            print(f"Font başarıyla yüklendi: {font_families}")
                        else:
                            print(f"Font yüklenemedi: {font_path}")
            else:
                print(f"Font klasörü bulunamadı: {font_dir}")
                print("Lütfen 'fonts' klasörü oluşturun ve TTF dosyalarını içine koyun")
                
        except Exception as e:
            print(f"Custom font yükleme hatası: {e}")

    def get_scale_factor(self):
        """Mevcut pencere boyutuna göre ölçek faktörünü hesapla"""
        current_width = self.main_window.width()
        current_height = self.main_window.height()
        
        width_ratio = current_width / self.base_width
        height_ratio = current_height / self.base_height
        
        scale = min(width_ratio, height_ratio)
        
        if scale < 0.6:
            scale = 0.6
        elif scale > 2.5:
            scale = 2.5
            
        return scale

    def update_all_fonts(self):
        """Tüm fontları ve HTML içeriklerini güncelle"""
        scale = self.get_scale_factor()
        
        if abs(scale - self.last_scale) < 0.05:
            return
            
        self.last_scale = scale
        
        try:
            title_size = max(20, int(40 * scale))  
            title_font = QFont("Big Shoulders Stencil", title_size)
            
            title_font.setBold(True)
            title_font.setWeight(QFont.Black)  
            title_font.setStretch(QFont.Expanded)  
            available_families = QFontDatabase().families()
            big_shoulders_available = any("Big Shoulders" in family for family in available_families)
            
            if not big_shoulders_available:
                print("Big Shoulders Stencil bulunamadı, Arial Black kullanılıyor")
                title_font = QFont("Arial Black", title_size)
                title_font.setBold(True)
                title_font.setWeight(QFont.Black)
            else:
                print("Big Shoulders Stencil fontu kullanılıyor - BOLD")
            
            self.ui.label_14.setFont(title_font)
            self.ui.label_14.setText(f'<html><head/><body><p align="center"><span style="font-size:{title_size}pt; color:#c14829; font-weight:1000;">RACLAB FAAL TAKIMI SERVİS ROBOTU<br/></span></p></body></html>')
            
            subtitle_size = max(8, int(12 * scale))  
            subtitle_font = QFont("Arial", subtitle_size)
            subtitle_font.setBold(True)
            
            self.ui.label_3.setFont(subtitle_font)
            self.ui.label_3.setText(f'<html><head/><body><p align="center"><span style="font-size:{subtitle_size}pt; color:#c14829;">SENARYO SEÇİMİ<br/></span></p></body></html>')
            
            self.ui.label_8.setFont(subtitle_font)
            self.ui.label_8.setText(f'<html><head/><body><p align="center"><span style="font-size:{subtitle_size}pt; color:#c14829;">ARAÇ MANUEL KONTROL <br/></span></p></body></html>')
            
            self.ui.label_23.setFont(subtitle_font)
            self.ui.label_23.setText(f'<html><head/><body><p align="center"><span style="font-size:{subtitle_size}pt; color:#c14829;">ARAÇ KONUM BİLGİLERİ<br/></span></p></body></html>')
            
            self.ui.label_26.setFont(subtitle_font)
            self.ui.label_26.setText(f'<html><head/><body><p align="center"><span style="font-size:{subtitle_size}pt; color:#c14829;">ARAÇ HIZ DEĞERLERİ<br/></span></p></body></html>')
            
            self.ui.label_30.setFont(subtitle_font)
            self.ui.label_30.setText(f'<html><head/><body><p align="center"><span style="font-size:{subtitle_size}pt; color:#c14829;">ARAÇ DURUMU<br/></span></p></body></html>')
            
            self.ui.label_35.setFont(subtitle_font)
            self.ui.label_35.setText(f'<html><head/><body><p align="center"><span style="font-size:{subtitle_size}pt; color:#c14829;">SON OKUNAN QR KOD<br/></span></p></body></html>')
            
            self.ui.label_41.setFont(subtitle_font)
            self.ui.label_41.setText(f'<html><head/><body><p align="center"><span style="font-size:{subtitle_size}pt; color:#c14829;">HARİTA GÖRÜNTÜSÜ<br/></span></p></body></html>')
            
            normal_size = max(7, int(11 * scale)) 
            normal_font = QFont("Arial", normal_size)
            
            normal_labels = [
                self.ui.location_x, self.ui.location_y, self.ui.yav,
                self.ui.linear_velocity, self.ui.angular_velocity,
                self.ui.car_situtation, self.ui.qr, self.ui.timer,
                self.ui.timer1, self.ui.change1
            ]
            
            for label in normal_labels:
                if hasattr(label, 'setFont'):
                    label.setFont(normal_font)
                    
            button_size = max(8, int(10 * scale))  
            button_font = QFont("Arial", button_size)
            
            buttons = [
                self.ui.pushButton, self.ui.pushButton_2, self.ui.pushButton_3,
                self.ui.pushButton_4, self.ui.pushButton_5, self.ui.pushButton_6,
                self.ui.pushButton_7, self.ui.pushButton_8, self.ui.pushButton_9,
                self.ui.pushButton_11
            ]
            
            for button in buttons:
                if hasattr(button, 'setFont'):
                    button.setFont(button_font)
                    
        except Exception as e:
            print(f"Font güncelleme hatası: {e}")

    def start_resize_timer(self):
        self.resize_timer = QtCore.QTimer(self)
        self.resize_timer.timeout.connect(self.check_window_size)
        self.resize_timer.start(200)  

    def check_window_size(self):
        """Pencere boyutu değişimini kontrol et"""
        new_size = self.main_window.size()
        self.update_background_image(new_size)
        self.update_all_fonts()

    def update_background_image(self, new_size):
        """Arkaplan resmini güncelle"""
        if hasattr(self, 'background_label') and self.background_label is not None:
            if not self.background_label.pixmap() or not self.background_label.pixmap().isNull():
                self.background_label.setGeometry(0, 0, new_size.width(), new_size.height())

    def add_background_image(self):
        """Arkaplan resmi ekle"""
        self.background_label = QtWidgets.QLabel(self.ui.centralwidget)
        self.background_label.setObjectName("background_label")

        try:
            pixmap = QPixmap("/home/ubuntum2/Downloads/backgraund.jpeg")   
            if not pixmap.isNull():
                self.background_label.setPixmap(pixmap)
                self.background_label.lower()
                self.background_label.setScaledContents(True)
                self.background_label.setGeometry(0, 0, self.main_window.width(), self.main_window.height())
        except Exception as e:
            print(f"Arkaplan resmi yükleme hatası: {e}")

    def resizeEvent(self, event):
        """Pencere boyutu değiştiğinde çağrılır"""
        super().resizeEvent(event)
        QtCore.QTimer.singleShot(50, self.update_all_fonts)

    def update_gui(self):
        yaw_degrees = math.degrees(self.yaw)
        self.ui.location_x.setText(f"X: {self.x:.2f}")
        self.ui.location_y.setText(f"Y: {self.y:.2f}")
        self.ui.yav.setText(f"Yaw: {yaw_degrees:.2f}°")
        self.ui.linear_velocity.setText(f"Linear Velocity: {self.linear_velocity:.2f} m/s")
        self.ui.angular_velocity.setText(f"Angular Velocity: {self.angular_velocity:.2f} rad/s")
 
        if self.map_data is not None:
            self.update_map(self.map_data)

    def update_values(self, x, y, yaw, linear_velocity, angular_velocity):
        self.x = x
        self.y = y
        self.yaw = yaw
        self.linear_velocity = linear_velocity
        self.angular_velocity = angular_velocity

    def update_map(self, data):
        """nav_msgs/OccupancyGrid'den QLabel'e görselleştirme (RViz benzeri)"""
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

            image = QImage(img.data, width, height, img.strides[0], QImage.Format_Grayscale8)
            pixmap = QPixmap.fromImage(image)
            pixmap = pixmap.scaled(self.ui.map.size(), QtCore.Qt.KeepAspectRatio, QtCore.Qt.SmoothTransformation)

            self.ui.map.setPixmap(pixmap)
            self.ui.map.setAlignment(QtCore.Qt.AlignCenter)

        except Exception as e:
            print(f"Harita güncelleme hatası: {e}")


    def move_forward(self):
        twist = Twist()
        twist.linear.x = 0.5
        twist.angular.z = 0.0
        self.cmd_vel_pub.publish(twist)

    def move_backward(self):
        twist = Twist()
        twist.linear.x = -0.5
        twist.angular.z = 0.0
        self.cmd_vel_pub.publish(twist)

    def move_leftward(self):
        twist = Twist()
        twist.angular.z = -0.5
        self.cmd_vel_pub.publish(twist)

    def move_rightward(self):
        twist = Twist()
        twist.angular.z = 0.5
        self.cmd_vel_pub.publish(twist)

    def stop_robot(self):
        twist = Twist()
        twist.linear.x = 0.0
        twist.angular.z = 0.0
        self.cmd_vel_pub.publish(twist)


def odom_callback(msg, updater):
    x = msg.pose.pose.position.x
    y = msg.pose.pose.position.y
    orientation_q = msg.pose.pose.orientation
    orientation_list = [orientation_q.x, orientation_q.y, orientation_q.z, orientation_q.w]
    _, _, yaw = tf.euler_from_quaternion(orientation_list)
    linear_velocity = msg.twist.twist.linear.x
    angular_velocity = msg.twist.twist.angular.z
    updater.update_values(x, y, yaw, linear_velocity, angular_velocity)

def map_callback(msg, updater):
    updater.map_data = msg


def main():
    import sys
    rospy.init_node('odom_listener', anonymous=True)
    app = QtWidgets.QApplication(sys.argv)
    MainWindow = QtWidgets.QMainWindow()
    ui = Ui_MainWindow()
    ui.setupUi(MainWindow)
    updater = OdomGuiUpdater(MainWindow, ui)   
 
    rospy.Subscriber("/odom", Odometry, odom_callback, callback_args=updater)
    rospy.Subscriber("/map", OccupancyGrid, map_callback, callback_args=updater)
 
    timer = QtCore.QTimer()
    timer.timeout.connect(lambda: rospy.rostime.wallsleep(0.01))
    timer.start(10)

    MainWindow.show()
    sys.exit(app.exec_())

if __name__ == "__main__":
    main()