import React, { useState, useEffect, useRef } from 'react';

export default function TTSPage({ settings }) {
  const [enabled, setEnabled] = useState(settings?.tts?.enabled ?? true);
  const [maxLength, setMaxLength] = useState(settings?.tts?.maxLength ?? 200);
  const [testText, setTestText] = useState('สวัสดีครับ ยินดีต้อนรับเข้าสู่สตรีมวันนี้!');
  const [isPlaying, setIsPlaying] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  // #16: ref for the status-clear timer
  const statusTimerRef = useRef(null);

  // #16: Cancel timer on unmount
  useEffect(() => () => clearTimeout(statusTimerRef.current), []);

  // L-1: sync local state when settings prop updates (e.g. from WebSocket)
  useEffect(() => {
    if (settings?.tts) {
      setEnabled(settings.tts.enabled ?? true);
      setMaxLength(settings.tts.maxLength ?? 200);
    }
  }, [settings]);

  const showMsg = (text, type) => {
    setStatusMsg({ text, type });
    // #16: clear stale timer before setting a new one
    clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
  };

  const handleSave = async () => {
    // #13: Guard — avoid spreading null settings and wiping server data
    if (!settings) return;
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, tts: { enabled, maxLength } })
      });
      if (res.ok) showMsg('บันทึกการตั้งค่า TTS เรียบร้อยแล้ว', 'success');
      else showMsg('บันทึกไม่สำเร็จ', 'error');
    } catch (e) {
      showMsg('เกิดข้อผิดพลาด: ' + e.message, 'error');
    }
  };

  const handleTest = async () => {
    if (!testText.trim()) return;
    setIsPlaying(true);
    try {
      const res = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText })
      });
      const data = await res.json();
      if (res.ok && data.audioUrl) {
        const audio = new Audio(data.audioUrl + '?t=' + Date.now());
        audio.onended = () => { setIsPlaying(false); showMsg('เล่นเสียงเสร็จสิ้น', 'success'); };
        audio.onerror = () => { setIsPlaying(false); showMsg('เล่นเสียงไม่สำเร็จ', 'error'); };
        // H-8: catch audio.play() promise rejection (e.g. browser autoplay policy)
        try {
          await audio.play();
          showMsg('กำลังเล่นเสียง...', 'info');
        } catch (playErr) {
          setIsPlaying(false);
          showMsg('เล่นเสียงไม่สำเร็จ (กดปุ่มอีกครั้งเพื่อลอง)', 'error');
        }
      } else {
        showMsg('ประมวลผลเสียงไม่สำเร็จ: ' + (data.error || 'Unknown'), 'error');
        setIsPlaying(false);
      }
    } catch (e) {
      showMsg('ข้อผิดพลาด: ' + e.message, 'error');
      setIsPlaying(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">เสียงอ่านภาษาไทย (TTS)</h1>
          <p className="page-subtitle">Google Translate TTS — ฟรี 100% ไม่ต้องใช้ API Key ใดๆ</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          บันทึก
        </button>
      </div>

      {statusMsg.text && <div className={`notify-bar ${statusMsg.type}`}>{statusMsg.text}</div>}

      <div className="grid-2">
        {/* Settings */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">การตั้งค่า</h2>
          </div>

          {/* TTS Toggle */}
          <label className="toggle-row" style={{ cursor: 'pointer', marginBottom: 'var(--space-4)' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={e => setEnabled(e.target.checked)}
            />
            <div>
              <div className="toggle-label">เปิดใช้งานเสียงอ่าน TTS</div>
              <div className="toggle-hint">อ่านข้อความ Alert ออกเสียงภาษาไทยอัตโนมัติ</div>
            </div>
          </label>

          {/* Engine (readonly info) */}
          <div className="form-group">
            <label className="form-label">เสียงที่ใช้</label>
            <div style={{
              padding: '10px 14px',
              background: 'var(--accent-success-dim)',
              border: '1px solid rgba(61, 214, 138, 0.2)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--accent-success)' }}>Google Translate TTS (ไทย)</span>
            </div>
            <span className="form-hint">เสียงผู้หญิงภาษาไทย ฟรีไม่จำกัด ไม่ต้อง API Key</span>
          </div>

          {/* Max Length */}
          <div className="form-group">
            <label className="form-label">
              ความยาวข้อความสูงสุด
              <span style={{ marginLeft: '8px', fontWeight: '700', color: 'var(--accent-primary)' }}>{maxLength} ตัวอักษร</span>
            </label>
            <input
              type="range" min="50" max="400"
              className="form-control-range"
              value={maxLength}
              onChange={e => setMaxLength(parseInt(e.target.value, 10))}
              style={{ marginTop: '6px' }}
            />
            <span className="form-hint">ข้อความที่ยาวกว่านี้จะถูกตัดออกก่อนอ่าน</span>
          </div>

          {/* Info */}
          <div style={{
            padding: '12px 14px',
            background: 'var(--accent-primary-dim)',
            border: '1px solid rgba(139, 122, 255, 0.2)',
            borderRadius: 'var(--radius-md)',
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>วิธีการทำงาน</strong>
              เมื่อมี Alert (Follow / Sub / Superchat) ระบบจะแปลง TTS Template เป็นไฟล์เสียง .mp3 แล้วเล่นผ่าน Alert Overlay บน OBS อัตโนมัติ
            </div>
          </div>
        </div>

        {/* Test */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">ทดสอบเสียง</h2>
          </div>

          <div className="form-group">
            <label className="form-label">พิมพ์ข้อความภาษาไทยที่ต้องการทดสอบ</label>
            <textarea
              className="form-control"
              rows="5"
              value={testText}
              onChange={e => setTestText(e.target.value)}
              placeholder="พิมพ์ข้อความที่ต้องการได้ยินเสียงอ่าน..."
            />
            <span className="form-hint" style={{ color: testText.length > maxLength ? 'var(--accent-danger, #FF4444)' : undefined }}>
              {testText.length}/{maxLength} ตัวอักษร{testText.length > maxLength ? ' (เกิน — จะถูกตัด)' : ''}
            </span>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleTest}
            disabled={isPlaying || !testText.trim()}
            style={{ width: '100%', height: '44px', fontSize: '14px', fontWeight: '600' }}
          >
            {isPlaying ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <span className="spinner" />
                กำลังเล่นเสียง...
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                กดเล่นเสียงทดสอบ
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
