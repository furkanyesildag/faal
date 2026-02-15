import { useEffect, useState, useRef } from 'react';
import ROSLIB from 'roslib';

/**
 * ROS2 Humble Bağlantısı için Hook
 * ROSBridge WebSocket üzerinden ROS2'ye bağlanır
 */
export const useROS2Connection = (url = 'ws://localhost:9090') => {
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);
    const rosRef = useRef(null);

    useEffect(() => {
        // ROS bağlantısı oluştur
        const ros = new ROSLIB.Ros({
            url: url
        });

        ros.on('connection', () => {
            console.log('✅ ROS2 Humble bağlantısı başarılı!');
            setIsConnected(true);
            setError(null);
        });

        ros.on('error', (err) => {
            console.error('❌ ROS2 bağlantı hatası:', err);
            setError(err.message || 'Bağlantı hatası');
            setIsConnected(false);
        });

        ros.on('close', () => {
            console.log('🔌 ROS2 bağlantısı kapandı');
            setIsConnected(false);
        });

        rosRef.current = ros;

        // Cleanup
        return () => {
            if (ros) {
                ros.close();
            }
        };
    }, [url]);

    return { ros: rosRef.current, isConnected, error };
};

/**
 * Odometry Topic Subscriber Hook
 * /odom topic'inden X, Y, Yaw, Linear/Angular Velocity okur
 */
export const useOdometry = (ros, topicName = '/odom') => {
    const [odometry, setOdometry] = useState({
        x: 0,
        y: 0,
        yaw: 0,
        linearVelocity: 0,
        angularVelocity: 0
    });

    useEffect(() => {
        if (!ros) return;

        const odomTopic = new ROSLIB.Topic({
            ros: ros,
            name: topicName,
            messageType: 'nav_msgs/Odometry'
        });

        odomTopic.subscribe((message) => {
            // Position
            const x = message.pose.pose.position.x;
            const y = message.pose.pose.position.y;

            // Quaternion to Euler (Yaw)
            const orientation = message.pose.pose.orientation;
            const yaw = Math.atan2(
                2.0 * (orientation.w * orientation.z + orientation.x * orientation.y),
                1.0 - 2.0 * (orientation.y * orientation.y + orientation.z * orientation.z)
            );

            // Velocities
            const linearVelocity = message.twist.twist.linear.x;
            const angularVelocity = message.twist.twist.angular.z;

            setOdometry({
                x: x,
                y: y,
                yaw: yaw,
                linearVelocity: linearVelocity,
                angularVelocity: angularVelocity
            });
        });

        return () => {
            odomTopic.unsubscribe();
        };
    }, [ros, topicName]);

    return odometry;
};

/**
 * SLAM Map (OccupancyGrid) Subscriber Hook
 * /map topic'inden harita verilerini okur
 */
export const useMap = (ros, topicName = '/map') => {
    const [mapData, setMapData] = useState(null);

    useEffect(() => {
        if (!ros) return;

        const mapTopic = new ROSLIB.Topic({
            ros: ros,
            name: topicName,
            messageType: 'nav_msgs/OccupancyGrid'
        });

        mapTopic.subscribe((message) => {
            setMapData({
                width: message.info.width,
                height: message.info.height,
                resolution: message.info.resolution,
                origin: {
                    x: message.info.origin.position.x,
                    y: message.info.origin.position.y
                },
                data: message.data
            });
        });

        return () => {
            mapTopic.unsubscribe();
        };
    }, [ros, topicName]);

    return mapData;
};

/**
 * QR Code Topic Subscriber (Custom mesaj)
 * /qr_code topic'inden son okunan QR'ı alır
 */
export const useQRCode = (ros, topicName = '/qr_code') => {
    const [qrCode, setQRCode] = useState('--');

    useEffect(() => {
        if (!ros) return;

        const qrTopic = new ROSLIB.Topic({
            ros: ros,
            name: topicName,
            messageType: 'std_msgs/String'
        });

        qrTopic.subscribe((message) => {
            setQRCode(message.data);
        });

        return () => {
            qrTopic.unsubscribe();
        };
    }, [ros, topicName]);

    return qrCode;
};

/**
 * RFID Topic Subscriber (Custom mesaj)
 */
export const useRFID = (ros, topicName = '/rfid_tag') => {
    const [rfid, setRfid] = useState('--');

    useEffect(() => {
        if (!ros) return;

        const rfidTopic = new ROSLIB.Topic({
            ros: ros,
            name: topicName,
            messageType: 'std_msgs/String'
        });

        rfidTopic.subscribe((message) => {
            setRfid(message.data);
        });

        return () => {
            rfidTopic.unsubscribe();
        };
    }, [ros, topicName]);

    return rfid;
};
