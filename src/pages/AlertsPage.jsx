import React, { useState, useEffect } from 'react';
import FontManagerModal from '../components/FontManagerModal';

const ALERT_TYPE_META = {
  follow:    { label: 'Follow', color: '#3DD68A' },
  subscribe: { label: 'Member / Sub', color: '#8B7AFF' },
  superchat: { label: 'Superchat / Bits', color: '#F0B040' },
  raid:      { label: 'Raid', color: '#A06BFF' },
};

export default function AlertsPage({ alertConfigs, sendEvent }) {
  const [configs, setConfigs] = useState([]);
  const [saveStatus, setSaveStatus] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [selectedAlertId, setSelectedAlertId] = useState('');
  const [availableFonts, setAvailableFonts] = useState({ presetFonts: [], customFonts: [] });
  const [isFontModalOpen, setIsFontModalOpen] = useState(false);

  // H-1: derive alert overlay URL dynamically (not hardcoded localhost)
  const alertOverlayUrl = `${window.location.origin}/overlay/alert`;

  useEffect(() => {
    if (alertConfigs && alertConfigs.length > 0) {
      setConfigs(alertConfigs);
      if (!selectedAlertId) setSelectedAlertId(alertConfigs[0].id);
    }
    fetchFonts();
  }, [alertConfigs]);

  const fetchFonts = async () => {
    try {
      const res = await fetch('/api/fonts');
      const data = await res.json();
      if (res.ok) setAvailableFonts(data);
    } catch (e) {
      // M-4: log so developer can diagnose; non-critical for user
      console.error('[AlertsPage] fetchFonts failed:', e);
    }
  };

  const handleChange = (id, field, value) =>
    setConfigs(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));

  const handleSave = async () => {
    try {
      const res = await fetch('/api/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configs)
      });
      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(''), 2500);
      } else {
        setSaveStatus('error');
        // H-7: auto-clear error — don't leave it stuck on screen forever
        setTimeout(() => setSaveStatus(''), 2500);
      }
    } catch (e) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 2500);
    }
  };

  // M-9: check res.ok before using upload URL; show error if upload fails
  const handleUploadImage = async (id, file) => {
    if (!file) return;
    setUploadError('');
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await fetch('/api/alerts/upload/image', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        handleChange(id, 'imagePath', data.url);
      } else {
        setUploadError(`อัปโหลดรูปภาพล้มเหลว: ${data.error || 'ไฟล์ไม่ถูกต้อง'}`);
        setTimeout(() => setUploadError(''), 3000);
      }
    } catch (e) {
      setUploadError('อัปโหลดไม่สำเร็จ: ' + e.message);
      setTimeout(() => setUploadError(''), 3000);
    }
  };

  const handleUploadSound = async (id, file) => {
    if (!file) return;
    setUploadError('');
    const fd = new FormData();
    fd.append('sound', file);
    try {
      const res = await fetch('/api/alerts/upload/sound', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        handleChange(id, 'soundPath', data.url);
      } else {
        setUploadError(`อัปโหลดเสียงล้มเหลว: ${data.error || 'ไฟล์ไม่ถูกต้อง'}`);
        setTimeout(() => setUploadError(''), 3000);
      }
    } catch (e) {
      setUploadError('อัปโหลดไม่สำเร็จ: ' + e.message);
      setTimeout(() => setUploadError(''), 3000);
    }
  };

  const handleTest = (item) => {
    sendEvent('test_alert', {
      id: `test_${Date.now()}`,
      type: item.type,
      title: item.name || 'Alert',
      name: 'ผู้ทดสอบ',
      amount: item.type === 'superchat' ? '100 บาท' : item.type === 'raid' ? '25' : '',
      message: item.type === 'superchat' ? 'ขอบคุณสำหรับสตรีมสนุกๆ!' : '',
      duration: item.duration || 5000,
      imagePath: item.imagePath,
      soundPath: item.soundPath,
      fontFamily: item.fontFamily,
      fontSize: item.fontSize,
      fontColor: item.fontColor,
      bgColor: item.bgColor,
      ttsEnabled: item.ttsEnabled ?? true,
      ttsTemplate: item.ttsTemplate || '{name} ได้ติดตามช่องแล้ว!',
      subMessage: item.subMessage ?? ''
    });
  };

  const activeItem = configs.find(c => c.id === selectedAlertId) || configs[0];
  const allFonts = [...(availableFonts.presetFonts || []), ...(availableFonts.customFonts || []).map(f => f.name)];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">การแจ้งเตือน (Alerts)</h1>
          <p className="page-subtitle">ปรับแต่งหัวข้อ รูปภาพ เสียง ฟอนต์ สี และ TTS สำหรับแต่ละประเภท Alert</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          บันทึกทั้งหมด
        </button>
      </div>

      {saveStatus === 'success' && <div className="notify-bar success">บันทึกการตั้งค่าแจ้งเตือนเรียบร้อยแล้ว</div>}
      {saveStatus === 'error' && <div className="notify-bar error">บันทึกไม่สำเร็จ กรุณาลองใหม่</div>}

      {/* Alert Type Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
        {configs.map(item => {
          const meta = ALERT_TYPE_META[item.type] || {};
          const isActive = selectedAlertId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSelectedAlertId(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '7px 16px',
                borderRadius: '999px',
                border: `1px solid ${isActive ? meta.color + '60' : 'var(--border-default)'}`,
                background: isActive ? meta.color + '18' : 'var(--bg-elevated)',
                color: isActive ? meta.color : 'var(--text-secondary)',
                fontWeight: isActive ? '600' : '500',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: isActive ? meta.color : 'var(--border-hover)',
                flexShrink: 0,
              }} />
              {item.name}
            </button>
          );
        })}
      </div>

      {activeItem && (
        <div className="grid-2">
          {/* Controls */}
          <div className="card">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={activeItem.enabled ?? true}
                    onChange={e => handleChange(activeItem.id, 'enabled', e.target.checked)}
                  />
                  <h2 className="card-title">{activeItem.name}</h2>
                </label>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => handleTest(activeItem)}>
                ทดสอบ
              </button>
            </div>

            {/* Header Title */}
            <div className="form-group">
              <label className="form-label">หัวข้อบนการ์ด Alert</label>
              <input
                type="text"
                className="form-control"
                value={activeItem.name || ''}
                onChange={e => handleChange(activeItem.id, 'name', e.target.value)}
                placeholder="เช่น ผู้ติดตามใหม่"
              />
            </div>

            {/* TTS Template */}
            <div className="form-group">
              <label className="form-label">ข้อความอ่านเสียง TTS <span style={{ color: 'var(--text-tertiary)', fontWeight: '400' }}>({'{name}'}, {'{amount}'}, {'{message}'})</span></label>
              <input
                type="text"
                className="form-control"
                value={activeItem.ttsTemplate || ''}
                onChange={e => handleChange(activeItem.id, 'ttsTemplate', e.target.value)}
                placeholder="{name} ได้ติดตามช่องแล้ว!"
              />
            </div>

            {/* Sub Message */}
            <div className="form-group">
              <label className="form-label">ข้อความรองบนการ์ด (Sub-message)</label>
              <input
                type="text"
                className="form-control"
                value={activeItem.subMessage ?? ''}
                onChange={e => handleChange(activeItem.id, 'subMessage', e.target.value)}
                placeholder="ปล่อยว่างเพื่อซ่อน"
              />
              <span className="form-hint">ปล่อยว่างไว้ = ซ่อนบรรทัดนี้บนหน้าจอ OBS อัตโนมัติ</span>
            </div>

            <hr className="divider" />

            {/* Font & Size */}
            <div className="grid-2">
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Font</label>
                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => setIsFontModalOpen(true)}>
                    จัดการ...
                  </button>
                </div>
                <select
                  className="form-control"
                  value={activeItem.fontFamily || 'Noto Sans Thai'}
                  onChange={e => handleChange(activeItem.id, 'fontFamily', e.target.value)}
                >
                  {allFonts.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">ขนาด ({activeItem.fontSize || 28}px)</label>
                <input
                  type="range" min="16" max="52"
                  className="form-control-range"
                  value={activeItem.fontSize || 28}
                  onChange={e => handleChange(activeItem.id, 'fontSize', parseInt(e.target.value, 10))}
                  style={{ marginTop: '8px' }}
                />
              </div>
            </div>

            {/* Colors */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">สีตัวหนังสือ</label>
                <input
                  type="color"
                  className="form-control"
                  style={{ height: '40px', padding: '2px 4px', cursor: 'pointer' }}
                  value={activeItem.fontColor || '#ECECEF'}
                  onChange={e => handleChange(activeItem.id, 'fontColor', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">สีพื้นหลัง</label>
                <input
                  type="text"
                  className="form-control"
                  value={activeItem.bgColor || '#19191B'}
                  onChange={e => handleChange(activeItem.id, 'bgColor', e.target.value)}
                  placeholder="#19191B"
                />
              </div>
            </div>

            {/* Duration + Animation */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">ระยะเวลา (ms)</label>
                <input
                  type="number"
                  className="form-control"
                  value={activeItem.duration || 5000}
                  onChange={e => handleChange(activeItem.id, 'duration', parseInt(e.target.value, 10))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Animation</label>
                <select
                  className="form-control"
                  value={activeItem.animationIn || 'bounceIn'}
                  onChange={e => handleChange(activeItem.id, 'animationIn', e.target.value)}
                >
                  <option value="bounceIn">Bounce In</option>
                  <option value="slideIn">Slide In</option>
                  <option value="fadeIn">Fade In</option>
                </select>
              </div>
            </div>

            {/* TTS Toggle */}
            <label className="toggle-row" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={activeItem.ttsEnabled ?? true}
                onChange={e => handleChange(activeItem.id, 'ttsEnabled', e.target.checked)}
              />
              <div>
                <div className="toggle-label">เปิดเสียงอ่าน TTS สำหรับ Alert นี้</div>
              </div>
            </label>

            <hr className="divider" />

            {/* Upload */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">รูปภาพ / GIF</label>
                <input
                  type="file" accept="image/*" className="form-control"
                  onChange={e => handleUploadImage(activeItem.id, e.target.files[0])}
                />
                {activeItem.imagePath && (
                  <span className="form-hint" style={{ marginTop: '4px' }}>
                    ไฟล์: {activeItem.imagePath.split('/').pop()}
                  </span>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">เสียง Alert (MP3/WAV)</label>
                <input
                  type="file" accept="audio/*" className="form-control"
                  onChange={e => handleUploadSound(activeItem.id, e.target.files[0])}
                />
                {activeItem.soundPath && (
                  <span className="form-hint" style={{ marginTop: '4px' }}>
                    ไฟล์: {activeItem.soundPath.split('/').pop()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">ตัวอย่าง OBS (Live Preview)</h2>
              <button className="btn btn-primary btn-sm" onClick={() => handleTest(activeItem)}>
                ยิงทดสอบ
              </button>
            </div>

            {uploadError && (
              <div className="notify-bar error" style={{ marginBottom: '8px' }}>{uploadError}</div>
            )}

            <div style={{
              width: '100%', height: '400px',
              background: '#000',
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 0)',
              backgroundSize: '16px 16px',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              border: '1px solid var(--border-default)',
              position: 'relative',
            }}>
              <iframe
                src={alertOverlayUrl}
                title="Alert Overlay Preview"
                allow="autoplay"
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
                {alertOverlayUrl}
              </div>
            </div>
          </div>
        </div>
      )}

      <FontManagerModal
        isOpen={isFontModalOpen}
        onClose={() => setIsFontModalOpen(false)}
        onFontListChange={data => setAvailableFonts(data)}
      />
    </div>
  );
}
