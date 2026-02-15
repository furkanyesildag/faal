
import React from 'react';
import { Battery, Zap, Clock } from 'lucide-react';

export const HUD = ({ battery, speed, time, qrCode, rfid }) => {
    const isLowBat = battery < 20;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>

            {/* SENSÖRLER (ÖNEMLİ VERİLER) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="section-title">SENSÖR VERİSİ</div>

                <div className="sensor-box">
                    <div className="sensor-label"> RFID ETİKETİ</div>
                    <div className="sensor-val">{rfid}</div>
                </div>

                <div className="sensor-box">
                    <div className="sensor-label"> SON OKUNAN QR</div>
                    <div className="sensor-val">{qrCode}</div>
                </div>

                <div className="sensor-box">
                    <div className="sensor-label"> ANLIK HIZ</div>
                    <div className="sensor-val">{speed.toFixed(1)} m/s</div>
                </div>
            </div>

            {/* DURUM BİLGİLERİ */}
            <div style={{ marginTop: '16px' }}>
                <div className="section-title">DURUM</div>
                <div className="stat-row">
                    <div className="stat-item">
                        <Battery
                            size={28}
                            color={isLowBat ? 'var(--danger)' : 'var(--success)'}
                            strokeWidth={2.5}
                        />
                        <div className="stat-val" style={{ color: isLowBat ? 'var(--danger)' : 'var(--success)' }}>
                            {battery}%
                        </div>
                        <div className="stat-lbl">Batarya</div>
                    </div>

                    <div className="stat-item">
                        <Zap size={28} color="var(--primary-color)" strokeWidth={2.5} />
                        <div className="stat-val">24.2V</div>
                        <div className="stat-lbl">Voltaj</div>
                    </div>

                    <div className="stat-item">
                        <Clock size={28} color="var(--text-secondary)" strokeWidth={2.5} />
                        <div className="stat-val">{time}</div>
                        <div className="stat-lbl">Zaman</div>
                    </div>
                </div>
            </div>

        </div>
    );
};
