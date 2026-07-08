import React from 'react';
import { Radio, DoorOpen, DoorClosed, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

/**
 * Fabrika Otomasyon Sistemi (PLC) Paneli — Şartname Görev 10:
 *  - "fabrika otomasyon sistemi haberleşme durumu"
 *  - "alınıp verilen mesajlar"
 * Ayrıca kontrollü kapı (Şekil 1) durumunu gösterir.
 */
export const PLCPanel = ({ plc, messages }) => {
  const doorOpen = plc.door === 'OPEN' || plc.door === 'OPENING';

  return (
    <div className="plc-panel">
      <div className="section-title">FABRİKA OTOMASYON SİSTEMİ (PLC)</div>

      {/* Durum satırı */}
      <div className="plc-status-row">
        <div className={`plc-badge ${plc.connected ? 'on' : 'off'}`}>
          <Radio size={15} />
          {plc.connected ? 'BAĞLI (Saha WiFi)' : 'BAĞLANTI YOK'}
        </div>
        <div className={`plc-badge ${doorOpen ? 'on' : 'closed'}`}>
          {doorOpen ? <DoorOpen size={15} /> : <DoorClosed size={15} />}
          KAPI: {plc.door === 'OPEN' ? 'AÇIK' : plc.door === 'OPENING' ? 'AÇILIYOR' : 'KAPALI'}
        </div>
        {plc.waiting && (
          <div className="plc-badge waiting">İZİN BEKLENİYOR</div>
        )}
      </div>

      {/* Mesaj günlüğü — TX/RX */}
      <div className="plc-log-title">ALINIP VERİLEN MESAJLAR</div>
      <div className="plc-log">
        {messages.length === 0 ? (
          <div className="plc-log-empty">Henüz mesaj yok…</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`plc-msg ${m.dir === 'TX' ? 'tx' : 'rx'}`}>
              <span className="plc-msg-dir">
                {m.dir === 'TX'
                  ? <><ArrowUpRight size={13} /> GÖNDERİLDİ</>
                  : <><ArrowDownLeft size={13} /> ALINDI</>}
              </span>
              <span className="plc-msg-text">{m.text}</span>
              <span className="plc-msg-time">{m.time}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PLCPanel;
