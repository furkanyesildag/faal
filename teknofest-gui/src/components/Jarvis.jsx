import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { COMMANDS, ROBOT_STATES } from '../config/mission';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// ─── Türkçe niyet ayrıştırıcı — Gemini olmadan da çalışır ───────────────────
// Dönüş: { command?: '/gui_command verisi', reply: 'kullanıcıya cevap' }
function parseIntent(text, s) {
  const t = text.toLocaleLowerCase('tr').trim();
  const has = (...w) => w.some((x) => t.includes(x));
  const stateLabel = ROBOT_STATES[s.state]?.label || s.state;

  // ── ACİL (en yüksek öncelik) ──
  if (has('acil', 'acİl', 'emergency', 'imdat') || (has('hemen', 'derhal') && has('dur')))
    return { command: COMMANDS.EMERGENCY, reply: 'ACİL STOP etkinleştirildi. Tüm hareket durduruldu.' };

  // ── Durum sorguları (komuttan önce; "durum" ≠ "durdur") ──
  if (has('neredey', 'konum', 'nerdes', 'neredes', 'pozisyon', 'nerede'))
    return { reply: `Konumum: X ${s.x.toFixed(2)} m, Y ${s.y.toFixed(2)} m, yön ${s.yawDeg.toFixed(0)} derece.` };
  if (has('batarya', 'pil', 'şarj durum', 'sarj durum', 'doluluk', 'ne kadar şarj'))
    return { reply: `Batarya yüzde ${Math.round(s.battery)}${s.charging ? ' (şarj oluyor)' : ''}.` };
  if (has('hız', 'hiz', 'ne kadar hızlı', 'kaç m/s'))
    return { reply: `Anlık hızım ${Number(s.speed).toFixed(2)} m/s.` };
  if (has('qr', 'kare kod', 'karekod'))
    return { reply: `Son okunan QR: ${s.qr || '--'}.` };
  if (has('kapı', 'kapi', 'plc', 'fabrika', 'otomasyon'))
    return { reply: `PLC ${s.plcConnected ? 'bağlı' : 'bağlı değil'}, kapı ${s.door === 'OPEN' ? 'AÇIK' : s.door === 'OPENING' ? 'açılıyor' : 'KAPALI'}.` };
  if (has('hangi adım', 'kaçıncı', 'adım', 'görev nerede', 'ilerleme'))
    return { reply: `Görev adımı ${s.step}/${s.totalSteps}. Durum: ${stateLabel}.` };
  if (has('ne yapıyor', 'durumun', 'durum ne', 'statü', 'statu', 'vaziyet', 'ne durumda'))
    return { reply: `Durumum: ${stateLabel}. Konum X ${s.x.toFixed(1)}, Y ${s.y.toFixed(1)}.` };
  if (has('mod', 'manuel mi', 'otonom mu'))
    return { reply: `Kontrol modu: ${s.mode === 'MANUAL' ? 'MANUEL' : 'OTONOM'}.` };

  // ── Mod değişimi ──
  if (has('manuel mod', 'manuel moda', 'manuele geç', 'elle kontrol'))
    return { command: 'manual', reply: 'Manuel moda geçildi. Artık uzaktan sürebilirsiniz.' };
  if (has('otonom mod', 'otomatik mod', 'otonoma geç', 'oto moda'))
    return { command: 'auto', reply: 'Otonom moda geçildi.' };

  // ── Hedefe git ──
  if (has('git', 'gid', 'gel', 'yönel', 'var ', 'ulaş', 'taşı', 'götür')) {
    const m = t.toUpperCase().match(/\b([AB][123])\b|\bD[1-6]\b/);
    let tgt = m ? m[0] : null;
    if (!tgt && has('başlang', 'baslang', 'eve', 'bekleme', 'ev ')) tgt = 'START';
    if (tgt) return { command: `goto:${tgt}`, reply: `${tgt} noktasına gidiyorum.` };
    return { reply: 'Hangi noktaya gideyim? (A1-A3, B1-B3, d1-d6 veya "başlangıç")' };
  }

  // ── Operasyon komutları ──
  if (has('başlat', 'baslat', 'start', 'çalıştır', 'calistir', 'harekete geç', 'göreve başla'))
    return { command: COMMANDS.START, reply: 'Görev başlatıldı.' };
  if (has('duraklat', 'durdur', 'bekle', 'dur ') || t === 'dur')
    return { command: COMMANDS.STOP, reply: 'Durakladım.' };
  if (has('sıfırla', 'sifirla', 'reset', 'başa al', 'başa dön'))
    return { command: COMMANDS.RESET, reply: 'Sıfırlandım, başlangıç konumundayım.' };
  if (has('eve dön', 'eve don', 'başlangıca', 'baslangica', 'geri dön', 'bekleme nokta', 'return'))
    return { command: COMMANDS.RETURN, reply: 'Bekleme noktasına dönüyorum.' };
  if (has('şarj', 'sarj', 'dock', 'doldur', 'istasyon'))
    return { command: COMMANDS.DOCK, reply: 'Otomatik şarj istasyonuna gidiyorum.' };
  if (has('harita', 'mapping', 'haritala'))
    return { command: COMMANDS.START_MAP, reply: 'Haritalama modunu başlattım.' };

  if (has('yardım', 'ne yapabilir', 'komut', 'help'))
    return { reply: 'Komutlar: "başlat / durdur / acil dur / sıfırla / eve dön / şarj", "A2\'ye git", "neredesin", "batarya", "durumun ne", "manuel moda geç".' };

  return null; // yerel eşleşme yok → Gemini'ye devret
}

export const Jarvis = ({ sendCommand, robotStatus }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Merhaba, ben Jarvis. Robotu yazılı yönetebilir, canlı durumu sorabilirsiniz. Örnek: "A2\'ye git", "neredesin", "acil dur".' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const push = (role, content) => setMessages((p) => [...p, { role, content }]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    const userText = input.trim();
    push('user', userText);
    setInput('');

    // 1) Yerel niyet ayrıştırma (Gemini gerekmez, her zaman çalışır)
    const intent = parseIntent(userText, robotStatus);
    if (intent) {
      if (intent.command && typeof sendCommand === 'function') sendCommand(intent.command);
      push('assistant', intent.reply);
      return;
    }

    // 2) Açık uçlu sorular → Gemini (varsa)
    if (!GEMINI_API_KEY) {
      push('assistant', 'Bunu tam anlayamadım. "yardım" yazarsanız komutları sıralarım efendim.');
      return;
    }
    setIsLoading(true);
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const s = robotStatus;
      const prompt = `Sen RACLAB FAAL otonom forklift robotunun yardımcı asistanı Jarvis'sin. Kısa (1-2 cümle), enerjik ve teknik cevap ver.
CANLI VERİLER:
- Durum: ${ROBOT_STATES[s.state]?.label || s.state}
- Konum: X ${s.x.toFixed(2)}, Y ${s.y.toFixed(2)}, yön ${s.yawDeg.toFixed(0)}°
- Hız: ${Number(s.speed).toFixed(2)} m/s · Batarya %${Math.round(s.battery)}
- Kontrol modu: ${s.mode} · PLC: ${s.plcConnected ? 'bağlı' : 'yok'} · Kapı: ${s.door}
- Son QR: ${s.qr} · Görev adımı: ${s.step}/${s.totalSteps}`;
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite', systemInstruction: prompt });
      const res = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 200 },
      });
      push('assistant', res.response.text());
    } catch (e) {
      push('assistant', `Hata: ${e.message}`);
    }
    setIsLoading(false);
  };

  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };

  return (
    <>
      {!isOpen && (
        <button className="jarvis-fab" onClick={() => setIsOpen(true)} title="Jarvis asistan">
          <Bot size={26} />
        </button>
      )}
      {isOpen && (
        <div className="jarvis-panel">
          <div className="jarvis-head">
            <div className="jarvis-head-title"><Bot size={18} /> JARVIS</div>
            <button className="jarvis-x" onClick={() => setIsOpen(false)}><X size={18} /></button>
          </div>
          <div className="jarvis-body">
            {messages.map((m, i) => (
              <div key={i} className={`jarvis-msg ${m.role}`}>{m.content}</div>
            ))}
            {isLoading && <div className="jarvis-msg assistant">Analiz ediliyor...</div>}
            <div ref={endRef} />
          </div>
          <div className="jarvis-input">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
              placeholder={"Komut / soru: A2'ye git, neredesin…"} disabled={isLoading} />
            <button onClick={handleSend} disabled={isLoading || !input.trim()}><Send size={17} /></button>
          </div>
        </div>
      )}
    </>
  );
};

export default Jarvis;
