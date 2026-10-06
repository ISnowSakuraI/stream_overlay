import React, { useState, useEffect, useRef } from 'react';
import { useNotificationSound } from '../hooks/useNotificationSound';

const CLOSE_OPTIONS = [
  {
    value: 'minimize',
    title: 'ย่อลง System Tray',
    desc: 'ปิดหน้าต่างแต่ทำงานเบื้องหลัง — OBS Overlay ยังทำงานอยู่'
  },
  {
    value: 'exit',
    title: 'ปิดโปรแกรมทันที',
    desc: 'หยุดทุกอย่างทั้งหมดรวมถึง OBS Overlay'
  },
  {
    value: 'ask',
    title: 'ถามทุกครั้ง',
    desc: 'แสดง dialog เพื่อเลือกทุกครั้งที่กดปิดหน้าต่าง'
  }
];

export default function SettingsPage({ settings, status }) {
  const [ytVideoId, setYtVideoId]       = useState('');
  const [ytAutoConnect, setYtAutoConnect] = useState(false);
  const [twChannel, setTwChannel]       = useState('');
  const [twAutoConnect, setTwAutoConnect] = useState(true);
  const [closeBehavior, setCloseBehavior] = useState('minimize');
  // Dashboard sound settings (local state for immediate UI feedback)
  const [soundEnabled, setSoundEnabled] = useState(settings?.dashboardSound?.enabled ?? true);
  const [soundVolume, setSoundVolume]   = useState(settings?.dashboardSound?.volume ?? 0.6);
  const [msg, setMsg]   = useState({ text: '', type: '' });
  const [loaded, setLoaded] = useState(false);
  // H-6: ref-based timer to prevent setState on unmounted component
  const msgTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(msgTimerRef.current), []);

  // Sync sound settings when props change (e.g. initial load via WebSocket)
  useEffect(() => {
    if (settings?.dashboardSound) {
      setSoundEnabled(settings.dashboardSound.enabled ?? true);
      setSoundVolume(settings.dashboardSound.volume ?? 0.6);
    }
  }, [settings]);

  // Use the notification sound hook for preview
  const { playNotification } = useNotificationSound({ dashboardSound: { enabled: true, volume: soundVolume } });

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.youtube?.videoId)    setYtVideoId(d.youtube.videoId);
        if (d.youtube?.autoConnect !== undefined) setYtAutoConnect(d.youtube.autoConnect);
        if (d.twitch?.channel)     setTwChannel(d.twitch.channel);
        if (d.twitch?.autoConnect !== undefined)  setTwAutoConnect(d.twitch.autoConnect);
        if (d.closeBehavior)       setCloseBehavior(d.closeBehavior);
        if (d.dashboardSound) {
          setSoundEnabled(d.dashboardSound.enabled ?? true);
          setSoundVolume(d.dashboardSound.volume ?? 0.6);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const showMsg = (text, type) => {
    setMsg({ text, type });
    clearTimeout(msgTimerRef.current);
    msgTimerRef.current = setTimeout(() => setMsg({ text: '', type: '' }), 2800);
  };

  const patchSettings = async (patch) => {
    try {
      const cur = await fetch('/api/settings').then(r => r.json());
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cur, ...patch })
      });
    } catch (e) {
      showMsg('บันทึกไม่สำเร็จ: ' + e.message, 'error');
    }
  };

  const handleCloseChange = (val) => {
    setCloseBehavior(val);
    patchSettings({ closeBehavior: val });
    showMsg('บันทึกพฤติกรรมการปิดแล้ว', 'success');
  };

  const handleTwAutoConnect = async (val) => {
    setTwAutoConnect(val);
    await patchSettings({ twitch: { channel: twChannel, autoConnect: val } });
    showMsg(val ? 'เปิด Twitch Auto-Connect แล้ว' : 'ปิด Twitch Auto-Connect แล้ว', 'success');
  };

  const handleYtAutoConnect = async (val) => {
    setYtAutoConnect(val);
    await patchSettings({ youtube: { videoId: ytVideoId, autoConnect: val } });
    showMsg(val ? 'เปิด YouTube Auto-Connect แล้ว' : 'ปิด YouTube Auto-Connect แล้ว', 'success');
  };

  const handleSoundEnabledChange = async (val) => {
    setSoundEnabled(val);
    await patchSettings({ dashboardSound: { enabled: val, volume: soundVolume } });
    showMsg(val ? 'เปิดเสียงแจ้งเตือน Dashboard แล้ว' : 'ปิดเสียงแจ้งเตือน Dashboard แล้ว', 'success');
  };

  const handleSoundVolumeChange = async (val) => {
    setSoundVolume(val);
    await patchSettings({ dashboardSound: { enabled: soundEnabled, volume: val } });
  };

  if (!loaded) return null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ตั้งค่าระบบ</h1>
          <p className="page-subtitle">พฤติกรรมการปิดโปรแกรม Auto-Connect และเสียงแจ้งเตือน</p>
        </div>
      </div>

      {msg.text && <div className={`notify-bar ${msg.type}`}>{msg.text}</div>}

      {/* ── Dashboard Notification Sound ── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">เสียงแจ้งเตือนใน Dashboard</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>เล่นเสียงใน browser เมื่อมี Alert เข้า</span>
        </div>

        <label className="toggle-row" style={{ cursor: 'pointer', marginBottom: 'var(--space-4)' }}>
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={e => handleSoundEnabledChange(e.target.checked)}
          />
          <div>
            <div className="toggle-label">เปิดเสียงแจ้งเตือน</div>
            <div className="toggle-hint">เล่นเสียง tone ใน browser ทุกครั้งที่มี Follow / Sub / Superchat / Raid — ไม่กระทบเสียงใน OBS</div>
          </div>
        </label>

        {soundEnabled && (
          <>
            <div className="form-group">
              <label className="form-label">
                ระดับเสียง
                <span style={{ marginLeft: '8px', fontWeight: '700', color: 'var(--accent-primary)' }}>
                  {Math.round(soundVolume * 100)}%
                </span>
              </label>
              <input
                type="range" min="0" max="1" step="0.05"
                className="form-control-range"
                value={soundVolume}
                onChange={e => handleSoundVolumeChange(parseFloat(e.target.value))}
                style={{ marginTop: '4px' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">ทดสอบเสียงแต่ละประเภท</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                {[
                  { type: 'follow', label: 'Follow', color: '#3DD68A' },
                  { type: 'subscribe', label: 'Sub', color: '#8B7AFF' },
                  { type: 'superchat', label: 'Superchat', color: '#F0B040' },
                  { type: 'raid', label: 'Raid', color: '#A06BFF' },
                ].map(({ type, label, color }) => (
                  <button
                    key={type}
                    className="btn btn-secondary btn-sm"
                    onClick={() => playNotification(type)}
                    style={{ borderColor: color + '60', color }}
                  >
                    ▶ {label}
                  </button>
                ))}
              </div>
              <span className="form-hint">คลิกเพื่อได้ยินเสียงที่จะเล่นเมื่อ Alert แต่ละประเภทเข้ามา</span>
            </div>
          </>
        )}
      </div>

      {/* ── Close Behavior ── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">พฤติกรรมเมื่อกดปุ่มปิด [X]</h2>
        </div>
        <div className="radio-card-group">
          {CLOSE_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={`radio-card ${closeBehavior === opt.value ? 'selected' : ''}`}
              onClick={() => handleCloseChange(opt.value)}
            >
              <input
                type="radio"
                name="closeBehavior"
                value={opt.value}
                checked={closeBehavior === opt.value}
                onChange={() => handleCloseChange(opt.value)}
              />
              <div className="radio-card-content">
                <div className="radio-card-title">{opt.title}</div>
                <div className="radio-card-desc">{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* ── Auto-Connect Settings ── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Auto-Connect เมื่อเปิดโปรแกรม</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
            ใช้ช่องบน Dashboard เพื่อเชื่อมต่อ/เปลี่ยนช่อง
          </span>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', lineHeight: '1.6' }}>
          เปิด Auto-Connect เพื่อให้โปรแกรมเชื่อมต่อ Twitch/YouTube อัตโนมัติด้วยค่าที่ตั้งไว้ทุกครั้งที่เปิดโปรแกรม<br/>
          <span style={{ color: 'var(--text-tertiary)' }}>เพื่อเปลี่ยนช่องหรือ Video ID ให้ใช้ปุ่มเชื่อมต่อบนหน้า Dashboard</span>
        </p>

        {/* Twitch Auto-Connect */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-twitch)">
              <path d="M11.571 4.714h1.715v5.143h-1.715zm4.715 0h1.714v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
            </svg>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Twitch</span>
            <span className={`status-badge ${status?.twitch?.connected ? 'online' : 'offline'}`} style={{ marginLeft: 'auto' }}>
              <span className="status-dot" />
              {status?.twitch?.connected ? 'Live' : 'Offline'}
            </span>
          </div>
          <label className="toggle-row" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={twAutoConnect}
              onChange={e => handleTwAutoConnect(e.target.checked)}
            />
            <div>
              <div className="toggle-label">เชื่อมต่อ Twitch อัตโนมัติเมื่อเปิดโปรแกรม</div>
              {twChannel
                ? <div className="toggle-hint">ช่อง: <span style={{ color: 'var(--accent-twitch)', fontWeight: '600' }}>#{twChannel}</span></div>
                : <div className="toggle-hint" style={{ color: 'var(--accent-warning)' }}>ยังไม่ได้ตั้งช่อง — ไปเชื่อมต่อที่หน้า Dashboard ก่อน</div>
              }
            </div>
          </label>
        </div>

        <hr className="divider" />

        {/* YouTube Auto-Connect */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-youtube)">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
              <polygon points="9.545,15.568 15.818,12 9.545,8.432" fill="white"/>
            </svg>
            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>YouTube Live</span>
            <span className={`status-badge ${status?.youtube?.connected ? 'online' : 'offline'}`} style={{ marginLeft: 'auto' }}>
              <span className="status-dot" />
              {status?.youtube?.connected ? 'Live' : 'Offline'}
            </span>
          </div>
          <label className="toggle-row" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={ytAutoConnect}
              onChange={e => handleYtAutoConnect(e.target.checked)}
            />
            <div>
              <div className="toggle-label">เชื่อมต่อ YouTube อัตโนมัติเมื่อเปิดโปรแกรม</div>
              {ytVideoId
                ? <div className="toggle-hint">Video/Channel: <span style={{ color: 'var(--accent-youtube)', fontWeight: '600' }}>{ytVideoId}</span></div>
                : <div className="toggle-hint" style={{ color: 'var(--accent-warning)' }}>ยังไม่ได้ตั้ง Video ID — ไปเชื่อมต่อที่หน้า Dashboard ก่อน</div>
              }
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
