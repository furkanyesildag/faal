

import React, { useState, useEffect } from 'react';
import SLAMMap from './components/SLAMMap';
import { Sidebar } from './components/Sidebar';
import { HUD } from './components/HUD';
import { Controls } from './components/Controls';
import { Jarvis } from './components/Jarvis';
import { Moon, Sun, Wifi, WifiOff } from 'lucide-react';
import { useROS2Connection, useOdometry, useMap, useQRCode, useRFID } from './hooks/useROS2';
import './styles/MissionControl.css';

// Varsayılan Senaryo Görevleri
const SCENARIOS = {
  1: [
    { id: 1, type: 'ALMA', location: 'A3', description: 'A3 Noktasından Yük Al', status: 'BEKLİYOR' },
    { id: 2, type: 'BIRAKMA', location: 'B4', description: 'B4 Noktasına Yükü Bırak', status: 'BEKLİYOR' }
  ],
  2: [
    { id: 1, type: 'ALMA', location: 'A1', description: 'A1 Noktasından Yükle', status: 'BEKLİYOR' }
  ],
  3: [],
  4: []
};

const App = () => {
  // --- ROS2 BAĞLANTISI ---
  const rosURL = 'ws://localhost:9090'; // ROSBridge WebSocket adresi
  const { ros, isConnected, error: rosError } = useROS2Connection(rosURL);

  // ROS2 Topic Subscriptions
  const odometry = useOdometry(ros, '/odom');
  const mapData = useMap(ros, '/map');
  const qrCodeROS = useQRCode(ros, '/qr_code');
  const rfidROS = useRFID(ros, '/rfid_tag');

  // --- DURUM YÖNETİMİ ---
  const [theme, setTheme] = useState('dark');
  const [useSimulation, setUseSimulation] = useState(true); // Simülasyon modu
  const [battery, setBattery] = useState(100);
  const [mode, setMode] = useState('BEKLEMEDE');
  const [activeScenario, setActiveScenario] = useState(1);
  const [tasks, setTasks] = useState(SCENARIOS[1]);
  const [logs, setLogs] = useState([{ time: '00:00:00', msg: 'Sistem hazır.' }]);
  const [timeElapsed, setTimeElapsed] = useState(0);

  // Simülasyon verileri (ROS bağlantısı yoksa)
  const [simRobot, setSimRobot] = useState({ x: 2, y: 7, rotation: 0 });
  const [simSpeed, setSimSpeed] = useState(0);
  const [simQR, setSimQR] = useState("--");
  const [simRFID, setSimRFID] = useState("--");

  // Gerçek veya simülasyon verisini kullan
  const robot = isConnected && !useSimulation ? {
    x: odometry.x,
    y: odometry.y,
    rotation: odometry.yaw * (180 / Math.PI) // Radyan'dan dereceye
  } : simRobot;

  const speed = isConnected && !useSimulation ? odometry.linearVelocity : simSpeed;
  const qrCode = isConnected && !useSimulation ? qrCodeROS : simQR;
  const rfid = isConnected && !useSimulation ? rfidROS : simRFID;

  // ROS bağlantı durumu log'u
  useEffect(() => {
    if (isConnected) {
      logEkle('✅ ROS2 Humble bağlantısı kuruldu!');
      setUseSimulation(false); // Gerçek veriye geç
    } else if (rosError) {
      logEkle(`❌ ROS2 bağlantı hatası: ${rosError}`);
      setUseSimulation(true); // Simülasyona dön
    }
  }, [isConnected, rosError]);

  // Tema Değiştirme
  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Senaryo Değişimi
  const handleScenarioChange = (scenarioId) => {
    setActiveScenario(scenarioId);
    setTasks(SCENARIOS[scenarioId] || []);
    logEkle(`Senaryo ${scenarioId} seçildi.`);
  };

  // --- SİMÜLASYON (Sadece simülasyon modunda) ---
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval;
    if (useSimulation && isRunning) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
        setBattery(prev => Math.max(0, prev - 0.02));
        setSimRobot(prev => {
          const newX = prev.x + (Math.random() - 0.4) * 0.4;
          const newY = prev.y + (Math.random() - 0.4) * 0.4;
          return {
            x: Math.min(18, Math.max(0, newX)),
            y: Math.min(14, Math.max(0, newY)),
            rotation: (prev.rotation + (Math.random() - 0.5) * 8) % 360
          };
        });
        setSimSpeed(Math.abs(Math.sin(Date.now() / 2000)) * 1.8);

        if (Math.random() > 0.99) {
          const codes = ["A1", "B2", "YOL", "ENGEL"];
          setSimQR(codes[Math.floor(Math.random() * codes.length)]);
        }
        if (Math.random() > 0.995) {
          const rfids = ["BOX-1234", "BOX-9988"];
          setSimRFID(rfids[Math.floor(Math.random() * rfids.length)]);
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [useSimulation, isRunning]);

  const logEkle = (msg) => {
    const time = new Date().toLocaleTimeString('tr-TR');
    setLogs(prev => [{ time, msg }, ...prev].slice(0, 50));
  };

  // Kontrol Handlers
  const handleStart = () => { setIsRunning(true); setMode('GÖREV'); logEkle(`Görev başlatıldı.`); };
  const handleStop = () => { setIsRunning(false); setSpeed(0); logEkle('Duraklatıldı.'); };
  const handleEmergency = () => { setIsRunning(false); setSpeed(0); setMode('ACİL'); logEkle('ACİL DURDURMA!'); alert("ACİL DURDURMA!"); };
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const ss = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
  };

  // JARVIS Komut İşleyici
  const handleJarvisCommand = (functionName, args) => {
    const scenarioNames = { 1: "Paket Toplama", 2: "Hızlı Teslimat", 3: "Engel Aşma", 4: "Hassas Taşıma" };

    switch (functionName) {
      case 'change_scenario':
        handleScenarioChange(args.scenario_id);
        return `Senaryo ${args.scenario_id} aktif! ${scenarioNames[args.scenario_id] || ''} görevi başlıyor! 🎯`;

      case 'control_robot':
        if (args.action === 'start') {
          handleStart();
          return 'Evet efendim! Motorlar çalıştı, sistemler online! Görev başlıyor! 🚀';
        } else if (args.action === 'stop') {
          handleStop();
          return 'Durduruldu captain. Güç tasarrufu modunda bekliyorum! ⏸';
        } else if (args.action === 'emergency') {
          handleEmergency();
          return '🚨 ACİL DURDURMA AKTİF! Tüm sistemler durduruldu!';
        }
        break;

      case 'get_status':
        if (args.info_type === 'battery') {
          const batEmoji = battery > 60 ? '⚡' : battery > 20 ? '🔋' : '🪫';
          return `Batarya %${Math.round(battery)} seviyesinde ${batEmoji}`;
        } else if (args.info_type === 'speed') {
          return `Şu an ${speed.toFixed(1)} m/s hızla ilerliyoruz! 💨`;
        } else if (args.info_type === 'position') {
          return `Konum: X=${robot.x.toFixed(1)}, Y=${robot.y.toFixed(1)} 📍`;
        } else if (args.info_type === 'scenario') {
          return `Şu an Senaryo ${activeScenario}'deyiz efendim! ${scenarioNames[activeScenario] || ''} görevi hazır! 🎯`;
        } else if (args.info_type === 'all') {
          return `Durum Özeti: Batarya %${Math.round(battery)}, Hız ${speed.toFixed(1)} m/s, Mod: ${mode} ✅`;
        }
        break;

      case 'change_mode':
        setMode(args.mode);
        return `${args.mode} moduna geçildi! 🎮`;

      default:
        return 'Komut anlaşılamadı efendim 🤔';
    }
  };

  return (
    <div className="app-root" data-theme={theme}>
      <div className="dashboard-grid">

        {/* HEADER */}
        <header className="panel header-area">
          <div className="logo-box left">
            <img src="/logo1.png" alt="Logo1" className="img-contain" />
          </div>

          <div className="logo-box center">
            <img src="/logo2.png" alt="Main Logo" className="img-contain main-logo" />
          </div>

          <div className="logo-box right">
            <img src="/logo3.png" alt="Logo3" className="img-contain" />

            {/* ROS Bağlantı Durumu */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginLeft: '15px',
              padding: '6px 12px',
              borderRadius: '20px',
              background: isConnected ? 'rgba(0, 255, 100, 0.1)' : 'rgba(255, 100, 0, 0.1)',
              border: `1px solid ${isConnected ? '#00ff64' : '#ff6400'}`
            }}>
              {isConnected ? <Wifi size={16} color="#00ff64" /> : <WifiOff size={16} color="#ff6400" />}
              <span style={{ fontSize: '0.75em', fontWeight: 'bold', color: isConnected ? '#00ff64' : '#ff6400' }}>
                {isConnected ? 'ROS2 ONLINE' : 'OFFLINE'}
              </span>
            </div>

            {/* Tema Butonu */}
            <button className="theme-toggle-btn" onClick={toggleTheme} title="Temayı Değiştir">
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* SOL PANEL (SIDEBAR) */}
        <aside className="panel sidebar-area">
          <Sidebar
            activeScenario={activeScenario}
            onSelectScenario={handleScenarioChange}
            tasks={tasks}
            logs={logs}
          />
        </aside>

        {/* ORTA PANEL (SLAM HARİTASI) */}
        <main className="panel map-area">
          <div className="map-wrapper">
            <SLAMMap
              mapData={useSimulation ? null : mapData}
              robot={robot}
              theme={theme}
              width={800}
              height={600}
            />
            <div className="map-stats">
              X: {robot.x.toFixed(2)} Y: {robot.y.toFixed(2)} | {robot.rotation.toFixed(0)}°
              {!useSimulation && <span style={{ marginLeft: '15px', color: '#00ff64' }}>• GERÇEK VERİ</span>}
              {useSimulation && <span style={{ marginLeft: '15px', color: '#ff6400' }}>• SİMÜLASYON</span>}
            </div>
          </div>
        </main>

        {/* SAĞ PANEL (SENSÖRLER) */}
        <aside className="panel hud-area">
          <HUD
            battery={Math.round(battery)}
            speed={speed}
            time={formatTime(timeElapsed)}
            qrCode={qrCode}
            rfid={rfid}
          />
        </aside>

        {/* ALT PANEL (KONTROLLER) */}
        <footer className="panel controls-area">
          <Controls
            onStart={handleStart}
            onStop={handleStop}
            onEmergency={handleEmergency}
            mode={mode}
            setMode={setMode}
          />
        </footer>

      </div>

      {/* JARVIS AI ASİSTAN */}
      <Jarvis onCommand={handleJarvisCommand} />

    </div>
  );
};

export default App;
