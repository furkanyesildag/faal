
import React from 'react';

export const Controls = ({ onStart, onStop, onEmergency, mode, setMode }) => {
    return (
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>

            {/* SOL: MOD SEÇİMİ */}
            <div className="control-group">
                <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    style={{ padding: '10px', borderRadius: '4px', background: 'var(--bg-app)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}
                >
                    <option value="BEKLEMEDE">BEKLEMEDE</option>
                    <option value="OTONOM">OTONOM SÜRÜŞ</option>
                    <option value="MANUEL">MANUEL KONTROL</option>
                </select>
            </div>

            {/* ORTA: OPERASYON */}
            <div className="control-group">
                <button className="btn-ctrl btn-start" onClick={onStart}>BAŞLAT</button>
                <button className="btn-ctrl" onClick={onStop}>DURAKLAT</button>
            </div>

            {/* SAĞ: ACİL */}
            <div className="control-group">
                <button className="btn-emergency" onClick={onEmergency}>ACİL DURDUR</button>
            </div>

        </div>
    );
};
