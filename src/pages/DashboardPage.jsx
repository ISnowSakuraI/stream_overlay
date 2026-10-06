import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from '../components/ChatMessage';

const YT_LOGO = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF4040">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
    <polygon points="9.545,15.568 15.818,12 9.545,8.432" fill="white"/>
  </svg>
);

const TW_LOGO = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#A06BFF">
    <path d="M11.571 4.714h1.715v5.143h-1.715zm4.715 0h1.714v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
  </svg>
);

const COPY_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);

function useCopyUrl() {
  const [copied, setCopied] = useState(null);
  const timerRef = useRef(null);
  const copy = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(null), 1500);
    });
  };
  useEffect(() => () => clearTimeout(timerRef.current), []);
  return { copied, copy };
}

export default function DashboardPage({ messages, status, viewerCount = {}, sendEvent }) {
  const [testName, setTestName] = useState('ผู้ทดสอบ');
  const [testMsg, setTestMsg] = useState('สวัสดีครับ! ทดสอบระบบแชท OBS Overlay');
  const [ytInput, setYtInput] = useState('');
  const [twInput, setTwInput] = useState('');
  const [connecting, setConnecting] = useState({ yt: false, tw: false });
  const [connMsg, setConnMsg] = useState({ text: '', type: '' });
  const { copied, copy } = useCopyUrl();
  const connMsgTimerRef = useRef(null);

  const overlayOrigin = window.location.origin;
  const chatUrl = `${overlayOrigin}/overlay/chat`;
  const alertUrl = `${overlayOrigin}/overlay/alert`;

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.twitch?.channel) setTwInput(d.twitch.channel);
        if (d.youtube?.videoId) setYtInput(d.youtube.videoId);
      })
      .catch((err) => console.error('[Dashboard] Settings fetch error:', err));
  }, []);

  useEffect(() => () => clearTimeout(connMsgTimerRef.current), []);

  const showMsg = (text, type) => {
    setConnMsg({ text, type });
    clearTimeout(connMsgTimerRef.current);
    connMsgTimerRef.current = setTimeout(() => setConnMsg({ text: '', type: '' }), 3500);
  };

  const handleConnectYT = async () => {
    if (!ytInput.trim()) return;
    setConnecting(p => ({ ...p, yt: true }));
    try {
      const res = await fetch('/api/auth/youtube/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: ytInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showMsg('เชื่อมต่อ YouTube สำเร็จ', 'success');
        // M-1: auth.js already saves the videoId server-side; no need to double-fetch/save here
      } else {
        showMsg(`YouTube: ${data.error}`, 'error');
      }
    } catch (e) {
      showMsg(`เกิดข้อผิดพลาด: ${e.message}`, 'error');
    } finally {
      setConnecting(p => ({ ...p, yt: false }));
    }
  };

  // H-4: disconnect handlers with proper error handling
  const handleDisconnectYT = async () => {
    try {
      const res = await fetch('/api/auth/youtube/disconnect', { method: 'POST' });
      if (res.ok) showMsg('ยกเลิกการเชื่อมต่อ YouTube แล้ว', 'info');
      else showMsg('ยกเลิกการเชื่อมต่อไม่สำเร็จ', 'error');
    } catch (e) {
      showMsg('เกิดข้อผิดพลาด: ' + e.message, 'error');
    }
  };

  const handleConnectTW = async () => {
    if (!twInput.trim()) return;
    setConnecting(p => ({ ...p, tw: true }));
    try {
      const res = await fetch('/api/auth/twitch/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: twInput.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showMsg('เชื่อมต่อ Twitch สำเร็จ', 'success');
        // M-1: auth.js already saves the channel server-side
      } else {
        showMsg(`Twitch: ${data.error}`, 'error');
      }
    } catch (e) {
      showMsg(`เกิดข้อผิดพลาด: ${e.message}`, 'error');
    } finally {
      setConnecting(p => ({ ...p, tw: false }));
    }
  };

  const handleDisconnectTW = async () => {
    try {
      const res = await fetch('/api/auth/twitch/disconnect', { method: 'POST' });
      if (res.ok) showMsg('ยกเลิกการเชื่อมต่อ Twitch แล้ว', 'info');
      else showMsg('ยกเลิกการเชื่อมต่อไม่สำเร็จ', 'error');
    } catch (e) {
      showMsg('เกิดข้อผิดพลาด: ' + e.message, 'error');
    }
  };

  const handleTestChat = (e) => {
    e.preventDefault();
    if (!testMsg) return;
    sendEvent('test_chat', {
      id: `test_${Date.now()}`,
      platform: 'youtube',
      author: testName || 'ผู้ทดสอบ',
      message: testMsg,
      timestamp: new Date().toISOString()
    });
  };

  const handleTestAlert = (type) => {
    sendEvent('test_alert', {
      id: `alert_${Date.now()}`,
      type,
      name: testName || 'ผู้ทดสอบ',
      amount: type === 'superchat' ? '฿ 100' : '',
      message: 'ขอบคุณที่สนับสนุนช่องนะครับ!',
      duration: 5000
    });
  };

  // M-11: two-step confirm before clearing live overlay chat (irreversible action)
  const [clearConfirm, setClearConfirm] = useState(false);
  const clearConfirmTimerRef = React.useRef(null);
  const handleClearChat = () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      clearTimeout(clearConfirmTimerRef.current);
      clearConfirmTimerRef.current = setTimeout(() => setClearConfirm(false), 3000);
    } else {
      setClearConfirm(false);
      clearTimeout(clearConfirmTimerRef.current);
      if (sendEvent) sendEvent('clear_chat', {});
    }
  };

  // L-15: auto-scroll live feed ref
  const feedRef = React.useRef(null);
  React.useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages]);

  const recentMessages = messages.slice(-15);
  const ytConnected = status.youtube?.connected;
  const twConnected = status.twitch?.connected;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">ศูนย์ควบคุมหลัก — เชื่อมต่อสตรีม, ดูแชทสด และทดสอบ Overlay</p>
        </div>
      </div>

      {/* Notification bar */}
      {connMsg.text && (
        <div className={`notify-bar ${connMsg.type}`}>{connMsg.text}</div>
      )}

      {/* ── Section 1: Connection Panel ── */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-5)' }}>

        {/* Twitch Card */}
        <div className="card card-connect card-connect-twitch">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {TW_LOGO}
              <span className="card-title">Twitch</span>
            </div>
            <span className={`status-badge ${twConnected ? 'online' : 'offline'}`}>
              <span className="status-dot" />
              {twConnected ? 'Live' : 'Offline'}
            </span>
          </div>

          {twConnected ? (
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                กำลังดึงแชทจากช่อง{' '}
                <span style={{ color: 'var(--accent-twitch)', fontWeight: '600' }}>
                  #{status.twitch?.channel || twInput || '—'}
                </span>
              </div>
              <button className="btn btn-danger btn-sm" onClick={handleDisconnectTW}>
                ยกเลิกการเชื่อมต่อ
              </button>
            </div>
          ) : (
            <div>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="ชื่อช่อง Twitch เช่น streamername"
                  value={twInput}
                  onChange={e => setTwInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConnectTW()}
                />
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConnectTW}
                disabled={connecting.tw || !twInput.trim()}
              >
                {connecting.tw && <span className="spinner" />}
                {connecting.tw ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ Twitch'}
              </button>
            </div>
          )}
        </div>

        {/* YouTube Card */}
        <div className="card card-connect card-connect-youtube">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {YT_LOGO}
              <span className="card-title">YouTube Live</span>
            </div>
            <span className={`status-badge ${ytConnected ? 'online' : 'offline'}`}>
              <span className="status-dot" />
              {ytConnected ? 'Live' : 'Offline'}
            </span>
          </div>

          {ytConnected ? (
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                กำลังดึงแชทจากสตรีมสด YouTube
              </div>
              <button className="btn btn-danger btn-sm" onClick={handleDisconnectYT}>
                ยกเลิกการเชื่อมต่อ
              </button>
            </div>
          ) : (
            <div>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Video ID / URL / @channel"
                  value={ytInput}
                  onChange={e => setYtInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConnectYT()}
                />
                <span className="form-hint">วาง Video ID, URL สตรีม หรือ @channel ได้เลย — ไม่ต้อง API Key</span>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleConnectYT}
                disabled={connecting.yt || !ytInput.trim()}
              >
                {connecting.yt && <span className="spinner" />}
                {connecting.yt ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อ YouTube'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: OBS Links + Metrics ── */}
      <div className="grid-2" style={{ marginBottom: 'var(--space-5)' }}>
        {/* OBS URLs */}
        <div className="metric-card">
          <div className="metric-label" style={{ marginBottom: '8px' }}>OBS Overlay URLs</div>
          <div className="obs-url-row">
            <span className="obs-url-label">Chat</span>
            <a href={chatUrl} target="_blank" rel="noreferrer" className="obs-url-value">/overlay/chat</a>
            <button className="btn btn-ghost btn-xs btn-icon" onClick={() => copy(chatUrl, 'chat')} title="คัดลอก">
              {copied === 'chat'
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                : COPY_ICON}
            </button>
          </div>
          <div className="obs-url-row">
            <span className="obs-url-label">Alert</span>
            <a href={alertUrl} target="_blank" rel="noreferrer" className="obs-url-value">/overlay/alert</a>
            <button className="btn btn-ghost btn-xs btn-icon" onClick={() => copy(alertUrl, 'alert')} title="คัดลอก">
              {copied === 'alert'
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-success)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                : COPY_ICON}
            </button>
          </div>
        </div>

        {/* Viewer Count + Session Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Session messages */}
          <div className="metric-card" style={{ marginBottom: 0 }}>
            <div className="metric-label">ข้อความแชท (Session)</div>
            <div className="metric-value">{messages.length}</div>
          </div>

          {/* Viewer counts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            {/* Twitch Viewer Count */}
            <div className="metric-card" style={{ marginBottom: 0 }}>
              <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--accent-twitch)">
                  <path d="M11.571 4.714h1.715v5.143h-1.715zm4.715 0h1.714v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
                </svg>
                Twitch คนดู
              </div>
              {twConnected ? (
                viewerCount.twitch != null ? (
                  <div className="metric-value" style={{ color: 'var(--accent-twitch)' }}>
                    {viewerCount.twitch.toLocaleString()}
                  </div>
                ) : (
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-tertiary)' }}>—</div>
                )
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '6px' }}>ยังไม่ได้เชื่อมต่อ</div>
              )}
              {twConnected && viewerCount.twitch == null && (
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px', lineHeight: 1.4 }}>
                  ต้องการ TWITCH_CLIENT_ID<br/>ใน .env
                </div>
              )}
            </div>

            {/* YouTube Viewer Count */}
            <div className="metric-card" style={{ marginBottom: 0 }}>
              <div className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--accent-youtube)">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/>
                  <polygon points="9.545,15.568 15.818,12 9.545,8.432" fill="white"/>
                </svg>
                YouTube คนดู
              </div>
              {ytConnected ? (
                viewerCount.youtube != null ? (
                  <div className="metric-value" style={{ color: 'var(--accent-youtube, #FF4040)' }}>
                    {viewerCount.youtube.toLocaleString()}
                  </div>
                ) : (
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-tertiary)' }}>—</div>
                )
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '6px' }}>ยังไม่ได้เชื่อมต่อ</div>
              )}
              {ytConnected && viewerCount.youtube == null && (
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px', lineHeight: 1.4 }}>
                  ต้องการ YOUTUBE_API_KEY<br/>ใน .env
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2.5: Quick Alert Test ── */}
      <div className="metric-card" style={{ marginBottom: 'var(--space-5)' }}>
        <div className="metric-label" style={{ marginBottom: '10px' }}>ทดสอบ Alert ด่วน</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => handleTestAlert('follow')}>Follow Alert</button>
          <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => handleTestAlert('subscribe')}>Sub Alert</button>
          <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => handleTestAlert('superchat')}>Superchat</button>
          <button className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => handleTestAlert('raid')}>Raid</button>
        </div>
      </div>

      {/* ── Section 3: Live Chat + Simulate ── */}
      <div className="grid-2">
        {/* Live Chat Feed */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h2 className="card-title">แชทสด (Live Feed)</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className={`btn btn-xs ${clearConfirm ? 'btn-danger' : 'btn-secondary'}`}
                onClick={handleClearChat}
                title={clearConfirm ? 'กดอีกครั้งเพื่อยืนยัน' : 'ล้างแชทบน OBS Overlay'}
              >
                {clearConfirm ? '⚠ ยืนยันล้างแชท?' : 'ล้างแชท'}
              </button>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{messages.length} msgs</span>
            </div>
          </div>
          <div ref={feedRef} style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {recentMessages.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 8px', opacity: 0.35 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <div style={{ fontSize: '13px' }}>ยังไม่มีข้อความ</div>
                <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.7 }}>เชื่อมต่อสตรีมด้านบนเพื่อรับแชท</div>
              </div>
            ) : (
              recentMessages.map(msg => <ChatMessage key={msg.id} msg={msg} />)
            )}
          </div>
        </div>

        {/* Test Console */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <h2 className="card-title">ส่งข้อความทดสอบ</h2>
          </div>
          <form onSubmit={handleTestChat}>
            <div className="form-group">
              <label className="form-label">ชื่อผู้ส่ง</label>
              <input type="text" className="form-control" value={testName} onChange={e => setTestName(e.target.value)} placeholder="ชื่อผู้ส่ง" />
            </div>
            <div className="form-group">
              <label className="form-label">ข้อความ</label>
              <textarea className="form-control" rows="4" value={testMsg} onChange={e => setTestMsg(e.target.value)} placeholder="ข้อความทดสอบ" />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              ส่งไปยัง OBS Overlay
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
