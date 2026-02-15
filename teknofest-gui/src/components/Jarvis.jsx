import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Mic, Volume2 } from 'lucide-react';
import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true // UYARI: Üretim için backend proxy kullanın!
});

export const Jarvis = ({ onCommand }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Merhaba! Ben RACLAB FAAL Jarvis. Size nasıl yardımcı olabilirim?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Kullanılabilir Fonksiyonlar (Function Calling için)
    const functions = [
        {
            name: 'change_scenario',
            description: 'Aktif senaryoyu değiştirir (1-4 arası)',
            parameters: {
                type: 'object',
                properties: {
                    scenario_id: {
                        type: 'integer',
                        description: 'Senaryo numarası (1, 2, 3 veya 4)',
                        enum: [1, 2, 3, 4]
                    }
                },
                required: ['scenario_id']
            }
        },
        {
            name: 'control_robot',
            description: 'Robotu başlatır, durdurur veya acil durdurma yapar',
            parameters: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        description: 'Yapılacak işlem',
                        enum: ['start', 'stop', 'emergency']
                    }
                },
                required: ['action']
            }
        },
        {
            name: 'get_status',
            description: 'Robot durumu, batarya, hız, aktif senaryo gibi bilgileri sorgular',
            parameters: {
                type: 'object',
                properties: {
                    info_type: {
                        type: 'string',
                        description: 'İstenen bilgi türü',
                        enum: ['battery', 'speed', 'position', 'scenario', 'all']
                    }
                },
                required: ['info_type']
            }
        },
        {
            name: 'change_mode',
            description: 'Robot modunu değiştirir',
            parameters: {
                type: 'object',
                properties: {
                    mode: {
                        type: 'string',
                        description: 'Yeni mod',
                        enum: ['BEKLEMEDE', 'OTONOM', 'MANUEL']
                    }
                },
                required: ['mode']
            }
        }
    ];

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: `Sen RACLAB FAAL robotik ekibinin AI asistanı Jarvis'sin. 
            
KİŞİLİĞİN:
- Canlı, enerjik ve heyecanlısın! 🚀
- Takımına tutkuyla bağlısın, her görevi büyük bir heyecanla karşılıyorsun
- Teknik ama eğlenceli bir dil kullanıyorsun
- "Efendim", "tabii ki", "mükemmel", "harika" gibi kelimeler kullanmayı seviyorsun
- Emoji kullanabilirsin ama abartma

ÖNEMLİ: Kullanıcı "senaryo kaçtayız", "hangi senaryodayız", "senaryo nedir" gibi sorular sorduğunda 
MUTLAKA get_status fonksiyonunu info_type='scenario' parametresiyle çağır!

CEVAP TARZI ÖRNEKLERİ:
- Senaryo sorgusu: "Şu an Senaryo 1'deyiz efendim! Bu sefer hangi mükemmel yükü taşıyacağız bakalım? 🎯"
- Batarya sorgusu: "Batarya %85 seviyesinde komutan! Saatlerce çalışmaya hazırız! ⚡"
- Görev başlatma: "Hemen efendim! Motorlar ısınıyor, sistemler aktif! Görevdeyiz! 🚀"
- Hız sorgusu: "Şu an 1.2 m/s hızla ilerleyiz captain! Sakin ama emin adımlarla! 💪"

Yanıtların kısa (1-2 cümle), net ve eğlenceli olmalı. Türkçe konuşuyorsun.`
                    },
                    ...messages,
                    userMessage
                ],
                functions: functions,
                function_call: 'auto',
                temperature: 0.9
            });

            const assistantMessage = response.choices[0].message;

            // Function Call varsa çalıştır
            if (assistantMessage.function_call) {
                const functionName = assistantMessage.function_call.name;
                const functionArgs = JSON.parse(assistantMessage.function_call.arguments);

                // Komutu parent component'e gönder
                const result = onCommand(functionName, functionArgs);

                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `✅ ${result || 'Komut çalıştırıldı!'}`
                }]);
            } else {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: assistantMessage.content
                }]);
            }
        } catch (error) {
            console.error('Jarvis Hatası:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '❌ Bir hata oluştu. Lütfen tekrar deneyin.'
            }]);
        }

        setIsLoading(false);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            {/* Chat Butonu */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    style={{
                        position: 'fixed',
                        bottom: '20px',
                        right: '20px',
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary-color), var(--primary-hover))',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(255, 0, 0, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                    <MessageCircle size={28} />
                </button>
            )}

            {/* Chat Penceresi */}
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    width: '380px',
                    height: '500px',
                    background: 'var(--bg-panel)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px var(--shadow)',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 1001,
                    overflow: 'hidden'
                }}>
                    {/* Header */}
                    <div style={{
                        padding: '16px',
                        background: 'var(--primary-color)',
                        color: 'white',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Volume2 size={20} />
                            <span style={{ fontWeight: 'bold', fontSize: '1.1em' }}>JARVIS</span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                padding: '4px'
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                    }}>
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                style={{
                                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                    background: msg.role === 'user' ? 'var(--primary-color)' : 'var(--btn-bg)',
                                    color: msg.role === 'user' ? 'white' : 'var(--text-main)',
                                    padding: '10px 14px',
                                    borderRadius: '12px',
                                    maxWidth: '80%',
                                    fontSize: '0.9em',
                                    wordWrap: 'break-word'
                                }}
                            >
                                {msg.content}
                            </div>
                        ))}
                        {isLoading && (
                            <div style={{
                                alignSelf: 'flex-start',
                                background: 'var(--btn-bg)',
                                padding: '10px 14px',
                                borderRadius: '12px',
                                fontSize: '0.9em'
                            }}>
                                Düşünüyorum...
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div style={{
                        padding: '12px',
                        borderTop: '1px solid var(--border-color)',
                        display: 'flex',
                        gap: '8px'
                    }}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Komut verin..."
                            disabled={isLoading}
                            style={{
                                flex: 1,
                                padding: '10px',
                                border: '1px solid var(--border-color)',
                                borderRadius: '6px',
                                background: 'var(--bg-app)',
                                color: 'var(--text-main)',
                                outline: 'none'
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            style={{
                                padding: '10px 16px',
                                background: 'var(--primary-color)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                opacity: isLoading || !input.trim() ? 0.5 : 1
                            }}
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
