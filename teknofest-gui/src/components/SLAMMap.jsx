import React, { useEffect, useRef } from 'react';

/**
 * SLAM Haritası Görselleştirme Bileşeni
 * ROS2 /map topic'inden gelen OccupancyGrid verisini canvas'a çizer
 */
const SLAMMap = ({ mapData, robot, width = 800, height = 600, theme = 'dark' }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        // Canvas'ı temizle
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!mapData) {
            // Harita yoksa placeholder
            ctx.fillStyle = theme === 'dark' ? '#0a0a0a' : '#f0f0f0';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = theme === 'dark' ? '#666' : '#999';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('SLAM Haritası Bekleniyor...', canvas.width / 2, canvas.height / 2);
            ctx.fillText('ROS2 /map topic dinleniyor', canvas.width / 2, canvas.height / 2 + 25);
            return;
        }

        // Map verisini çiz
        const { width: mapWidth, height: mapHeight, resolution, origin, data } = mapData;

        // Ölçekleme hesapla
        const scaleX = canvas.width / (mapWidth * resolution);
        const scaleY = canvas.height / (mapHeight * resolution);
        const scale = Math.min(scaleX, scaleY) * 0.9; // %90 oranında sığdır

        const offsetX = (canvas.width - mapWidth * resolution * scale) / 2;
        const offsetY = (canvas.height - mapHeight * resolution * scale) / 2;

        // Haritayı çiz (OccupancyGrid formatı)
        const imageData = ctx.createImageData(mapWidth, mapHeight);

        for (let y = 0; y < mapHeight; y++) {
            for (let x = 0; x < mapWidth; x++) {
                const index = (mapHeight - 1 - y) * mapWidth + x; // Y eksenini ters çevir
                const value = data[index];

                const pixelIndex = (y * mapWidth + x) * 4;

                if (value === -1) {
                    // Bilinmeyen alan (gri)
                    imageData.data[pixelIndex] = 127;
                    imageData.data[pixelIndex + 1] = 127;
                    imageData.data[pixelIndex + 2] = 127;
                } else if (value === 0) {
                    // Boş alan (beyaz)
                    imageData.data[pixelIndex] = 255;
                    imageData.data[pixelIndex + 1] = 255;
                    imageData.data[pixelIndex + 2] = 255;
                } else if (value === 100) {
                    // Engel (siyah)
                    imageData.data[pixelIndex] = 0;
                    imageData.data[pixelIndex + 1] = 0;
                    imageData.data[pixelIndex + 2] = 0;
                } else {
                    // Kısmi doluluk (gri tonlaması)
                    const grayValue = 255 - (value * 255 / 100);
                    imageData.data[pixelIndex] = grayValue;
                    imageData.data[pixelIndex + 1] = grayValue;
                    imageData.data[pixelIndex + 2] = grayValue;
                }

                imageData.data[pixelIndex + 3] = 255; // Alpha
            }
        }

        // ImageData'yı geçici canvas'a çiz
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = mapWidth;
        tempCanvas.height = mapHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);

        // Ana canvas'a ölçeklenmiş olarak çiz
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.scale(scale, scale);
        ctx.drawImage(tempCanvas, 0, 0, mapWidth * resolution, mapHeight * resolution);
        ctx.restore();

        // Robot pozisyonunu çiz (eğer varsa)
        if (robot && robot.x !== undefined) {
            const robotX = offsetX + ((robot.x - origin.x) / resolution) * scale;
            const robotY = offsetY + ((robot.y - origin.y) / resolution) * scale;

            ctx.save();
            ctx.translate(robotX, robotY);
            ctx.rotate(-robot.yaw); // ROS koordinat sistemi

            // Robot gövdesi (üçgen)
            const robotColor = theme === 'dark' ? '#00f3ff' : '#b00000';
            ctx.fillStyle = robotColor;
            ctx.shadowBlur = 10;
            ctx.shadowColor = robotColor;

            ctx.beginPath();
            ctx.moveTo(0, -12); // Ön
            ctx.lineTo(10, 10);
            ctx.lineTo(0, 6);
            ctx.lineTo(-10, 10);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }

    }, [mapData, robot, theme, width, height]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{ width: '100%', height: '100%', display: 'block' }}
        />
    );
};

export default SLAMMap;
