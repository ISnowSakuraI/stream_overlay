import React, { useState, useEffect, useRef } from 'react';
import FontManagerModal from '../components/FontManagerModal';

const SHAPES = [
  { id: 'bubble',  label: 'Bubble',  desc: 'กล่องคำพูดโค้งมน' },
  { id: 'card',    label: 'Card',    desc: 'การ์ดขอบโค้ง' },
  { id: 'minimal', label: 'Minimal', desc: 'ข้อความล้วน ไม่มีกรอบ' },
  { id: 'retro',   label: 'Retro',   desc: 'Pixel Gaming Style' },
];

const POSITIONS = [
  { id: 'bottom-left',  label: 'ซ้ายล่าง' },
  { id: 'bottom-right', label: 'ขวาล่าง' },
  { id: 'top-left',     label: 'ซ้ายบน' },
  { id: 'top-right',    label: 'ขวาบน' },
];

export default function OverlayPage({ settings, sendEvent }) {
  const [cfg, setCfg] = useState({
    shape: 'bubble',
    fontFamily: 'Noto Sans Thai',
    fontSize: 15,
    fontColor: '#ECECEF',
    bgColor: 'rgba(25, 25, 27, 0.85)',
    maxMessages: 20,
    fadeTimeout: 0,
    position: 'bottom-left'
  });
  const [statusText, setStatusText] = useState('');
  const [availableFonts, setAvailableFonts] = useState({ presetFonts: [], customFonts: [] });
  const [isFontModalOpen, setIsFontModalOpen] = useState(false);
  // #16: ref to track the status-clear timer for proper cleanup
  const statusTimerRef = useRef(null);

  // Derive overlay URLs from the current origin so port changes are reflected automatically
  const overlayOrigin = window.location.origin;

  useEffect(() => {
    if (settings?.chatOverlay) setCfg(settings.chatOverlay);
    fetchFonts();
  }, [settings]);

  // #16: Cancel pending timer on unmount
  useEffect(() => () => clearTimeout(statusTimerRef.current), []);

  const fetchFonts = async () => {
    try {
      const res = await fetch('/api/fonts');
      const data = await res.json();
      if (res.ok) setAvailableFonts(data);
    } catch (e) {
      console.error('[OverlayPage] Failed to fetch fonts:', e);
    }
  };

  const handleChange = (field, value) => setCfg(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    // #13: Guard — if settings hasn't loaded yet, don't wipe server data
    if (!settings) return;
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, chatOverlay: cfg })
      });
      if (res.ok) {
        setStatusText('success');
        // #16: clear old timer before setting new one
        clearTimeout(statusTimerRef.current);
        statusTimerRef.current = setTimeout(() => setStatusText(''), 2500);
      }
    } catch (e) {
      setStatusText('error');
      console.error('[OverlayPage] Save failed:', e);
    }
  };

  const allFonts = [...(availableFonts.presetFonts || []), ...(availableFonts.customFonts || []).map(f => f.name)];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ปรับแต่ง Chat Overlay</h1>
          <p className="page-subtitle">ปรับรูปทรง ฟอนต์ สี ตำแหน่ง และระยะเวลาแสดงแชทบน OBS</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          บันทึกการตั้งค่า
        </button>
      </div>

      {statusText === 'success' && <div className="notify-bar success">บันทึกการตั้งค่า Overlay เรียบร้อยแล้ว</div>}
      {statusText === 'error' && <div className="notify-bar error">บันทึกไม่สำเร็จ กรุณาลองใหม่</div>}

      <div className="grid-2">
        {/* Controls */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">ตั้งค่ารูปแบบ</h2>
          </div>

          {/* Shape */}
          <div className="form-group">
            <label className="form-label">รูปทรงแชท (Shape)</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              {SHAPES.map(s => {
                const isActive = cfg.shape === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleChange('shape', s.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                      background: isActive ? 'var(--accent-primary-dim)' : 'var(--bg-input)',
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 150ms ease',
                    }}
                  >
                    <div style={{ fontWeight: '600', fontSize: '13px' }}>{s.label}</div>
                    <div style={{ fontSize: '11px', color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)', marginTop: '2px' }}>{s.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Position */}
          <div className="form-group">
            <label className="form-label">ตำแหน่งบนหน้าจอ OBS</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
              {POSITIONS.map(p => {
                const isActive = cfg.position === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleChange('position', p.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                      background: isActive ? 'var(--accent-primary-dim)' : 'var(--bg-input)',
                      color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: isActive ? '600' : '500',
                      fontSize: '13px',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fade Timeout */}
          <div className="form-group">
            <label className="form-label">การจางหาย (Auto-Hide)</label>
            <select
              className="form-control"
              value={cfg.fadeTimeout ?? 0}
              onChange={e => handleChange('fadeTimeout', parseInt(e.target.value, 10))}
            >
              <option value={0}>แสดงค้างตลอด (ไม่จาง)</option>
              <option value={5}>จางหายหลัง 5 วินาที</option>
              <option value={10}>จางหายหลัง 10 วินาที</option>
              <option value={15}>จางหายหลัง 15 วินาที</option>
              <option value={30}>จางหายหลัง 30 วินาที</option>
              <option value={60}>จางหายหลัง 1 นาที</option>
            </select>
          </div>

          <hr className="divider" />

          {/* Font */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="form-label" style={{ margin: 0 }}>Font</label>
              <button type="button" className="btn btn-ghost btn-xs" onClick={() => setIsFontModalOpen(true)}>
                จัดการฟอนต์...
              </button>
            </div>
            <select
              className="form-control"
              value={cfg.fontFamily || 'Noto Sans Thai'}
              onChange={e => handleChange('fontFamily', e.target.value)}
            >
              {allFonts.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {/* Font Size */}
          <div className="form-group">
            <label className="form-label">
              ขนาดตัวหนังสือ
              <span style={{ marginLeft: '8px', fontWeight: '700', color: 'var(--accent-primary)' }}>{cfg.fontSize}px</span>
            </label>
            <input
              type="range" min="10" max="30"
              className="form-control-range"
              value={cfg.fontSize || 15}
              onChange={e => handleChange('fontSize', parseInt(e.target.value, 10))}
              style={{ marginTop: '4px' }}
            />
          </div>

          {/* Colors */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">สีตัวหนังสือ</label>
              <input
                type="color" className="form-control"
                style={{ height: '40px', padding: '2px 4px', cursor: 'pointer' }}
                value={cfg.fontColor || '#ECECEF'}
                onChange={e => handleChange('fontColor', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">สีพื้นหลัง</label>
              <input
                type="text" className="form-control"
                value={cfg.bgColor || 'rgba(25,25,27,0.85)'}
                onChange={e => handleChange('bgColor', e.target.value)}
                placeholder="rgba(25,25,27,0.85)"
              />
            </div>
          </div>

          {/* Max messages */}
          <div className="form-group">
            <label className="form-label">
              จำนวนข้อความสูงสุดบนจอ
              <span style={{ marginLeft: '8px', fontWeight: '700', color: 'var(--accent-primary)' }}>{cfg.maxMessages}</span>
            </label>
            <input
              type="range" min="5" max="50"
              className="form-control-range"
              value={cfg.maxMessages || 20}
              onChange={e => handleChange('maxMessages', parseInt(e.target.value, 10))}
              style={{ marginTop: '4px' }}
            />
          </div>
        </div>

        {/* Preview */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">ตัวอย่าง OBS (Live Preview)</h2>
          </div>

          <div style={{
            width: '100%', height: '430px',
            background: '#000',
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 0)',
            backgroundSize: '16px 16px',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            border: '1px solid var(--border-default)',
          }}>
            <iframe
              src={`${overlayOrigin}/overlay/chat?preview=true`}
              title="Chat Overlay Preview"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>

          <div style={{ marginTop: '12px' }}>
            <div className="form-label" style={{ marginBottom: '6px' }}>OBS Browser Source URL</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '12px',
              padding: '8px 12px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--accent-primary)',
            }}>
              {overlayOrigin}/overlay/chat
            </div>
          </div>
        </div>
      </div>

      <FontManagerModal
        isOpen={isFontModalOpen}
        onClose={() => setIsFontModalOpen(false)}
        onFontListChange={data => setAvailableFonts(data)}
      />
    </div>
  );
}
