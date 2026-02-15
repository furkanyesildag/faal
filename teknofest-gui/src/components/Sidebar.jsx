
import React from 'react';

export const Sidebar = ({ activeScenario, onSelectScenario, tasks, logs }) => {
    return (
        <>
            <div className="section-title">SENARYO SEÇİMİ</div>
            <div>
                {[1, 2, 3, 4].map((id) => (
                    <button
                        key={id}
                        className={`scenario-btn ${activeScenario === id ? 'active' : ''}`}
                        onClick={() => onSelectScenario(id)}
                    >
                        SENARYO {id}
                    </button>
                ))}
            </div>

            <div className="section-title" style={{ marginTop: '20px' }}>GÖREV DURUMU</div>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '15px' }}>
                {tasks.map((task, idx) => (
                    <div key={idx} className="task-item">
                        <span className="task-location">{task.location}</span>
                        <span style={{ flex: 1, marginLeft: '10px', fontSize: '0.85em', color: 'var(--text-secondary)' }}>
                            {task.description}
                        </span>
                        <span className={`task-status ${task.status === 'TAMAMLANDI' ? 'done' : 'waiting'}`}>
                            {task.status}
                        </span>
                    </div>
                ))}
                {tasks.length === 0 && (
                    <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', padding: '15px', textAlign: 'center' }}>
                        Senaryo seçilmedi
                    </div>
                )}
            </div>

            <div className="section-title">SİSTEM LOGLARI</div>
            <div className="console-log">
                {logs.map((log, i) => (
                    <div key={i} style={{ marginBottom: '2px' }}>
                        <span style={{ color: '#666' }}>[{log.time}]</span>{' '}
                        <span style={{ color: log.msg.includes('ACİL') ? '#f00' : '#0f0' }}>{log.msg}</span>
                    </div>
                ))}
            </div>
        </>
    );
};
