import React, { useState, useEffect, useCallback } from 'react';

const POPULAR_THAI_GFONTS = [
  'Prompt',
  'Kanit',
  'Sarabun',
  'Mitr',
  'Chonburi',
  'Mali',
  'Pattaya',
  'Bai Jamjuree',
  'Charm',
  'Srisakdi',
  'Krub',
  'Charmonman',
  'Fahkwang',
  'KoHo',
  'Kodchasan'
];

export default function FontManagerModal({ isOpen, onClose, onFontListChange }) {
  const [activeTab, setActiveTab] = useState('myFonts');
  const [presetFonts, setPresetFonts] = useState([]);
  const [customFonts, setCustomFonts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusType, setStatusType] = useState('info'); // 'info' | 'error' | 'success'
  // H-3: replace window.confirm with a two-step delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null); // filename to confirm delete

  // Google Fonts Import State
  const [gfontName, setGfontName] = useState('');
  const [importingGfont, setImportingGfont] = useState(false);

  // L-7: auto-clear status message helper
  const showStatus = useCallback((text, type = 'info', autoClear = true) => {
    setStatusMsg(text);
    setStatusType(type);
    if (autoClear && text) {
      setTimeout(() => setStatusMsg(''), 3000);
    }
  }, []);

  // L-8: Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      fetchFonts();
      setDeleteConfirm(null);
    }
  }, [isOpen]);

  const fetchFonts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/fonts');
      const data = await res.json();
      if (res.ok) {
        setPresetFonts(data.presetFonts || []);
        setCustomFonts(data.customFonts || []);
        if (onFontListChange) onFontListChange(data);
      }
    } catch (err) {
      console.error('Fetch fonts failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('font', file);
    try {
      showStatus('กำลังอัปโหลดฟอนต์...', 'info', false);
      const res = await fetch('/api/fonts/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // L-7: auto-clears after 3s
        showStatus(`เพิ่มฟอนต์ "${data.font.name}" สำเร็จ`, 'success');
        fetchFonts();
      } else {
        // H-3: inline error instead of alert()
        showStatus('อัปโหลดล้มเหลว: ' + (data.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      showStatus('Upload error: ' + err.message, 'error');
    }
  };

  const handleImportGoogleFont = async (nameToImport) => {
    const targetName = nameToImport || gfontName;
    if (!targetName || !targetName.trim()) {
      // H-3: inline validation instead of alert()
      showStatus('กรุณากรอกชื่อฟอนต์จาก Google Fonts', 'error');
      return;
    }

    try {
      setImportingGfont(true);
      showStatus(`กำลังดึงข้อมูลฟอนต์ "${targetName}" จาก Google Fonts...`, 'info', false);

      const res = await fetch('/api/fonts/google/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fontName: targetName.trim() })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showStatus(`นำเข้าฟอนต์ "${data.font.name}" จาก Google Fonts สำเร็จ`, 'success');
        setGfontName('');
        fetchFonts();
      } else {
        showStatus('นำเข้าฟอนต์ไม่สำเร็จ: ' + (data.error || 'ไม่พบชื่อฟอนต์นี้ใน Google Fonts'), 'error');
      }
    } catch (err) {
      showStatus('Google Fonts Import Error: ' + err.message, 'error');
    } finally {
      setImportingGfont(false);
    }
  };

  const handleDeleteFont = async (filename, name) => {
    // H-3: two-step confirm — first click sets deleteConfirm, second click executes
    if (deleteConfirm !== filename) {
      setDeleteConfirm(filename);
      // Auto-cancel confirm after 4s
      setTimeout(() => setDeleteConfirm(dc => dc === filename ? null : dc), 4000);
      return;
    }
    setDeleteConfirm(null);
    try {
      const res = await fetch(`/api/fonts/${filename}`, { method: 'DELETE' });
      if (res.ok) {
        showStatus(`ลบฟอนต์ "${name}" เรียบร้อยแล้ว`, 'success');
        fetchFonts();
      } else {
        showStatus('ลบไม่สำเร็จ', 'error');
      }
    } catch (err) {
      showStatus('Delete failed: ' + err.message, 'error');
    }
  };

  if (!isOpen) return null;

  // L-8: backdrop click closes modal
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
    >
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        overflow: 'hidden'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
              จัดการและนำเข้า Font Family
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              อัปโหลดฟอนต์ส่วนตัว (.ttf, .otf, .woff) หรือดึงจาก Google Fonts สำหรับใช้ใน OBS Overlay
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '22px', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* L-7: Status Message with color based on type */}
        {statusMsg && (
          <div style={{
            padding: '10px 20px',
            backgroundColor: statusType === 'error' ? 'rgba(255,68,68,0.15)'
                           : statusType === 'success' ? 'rgba(61,214,138,0.15)'
                           : 'rgba(124, 106, 232, 0.15)',
            color: statusType === 'error' ? 'var(--accent-danger, #FF4444)'
                 : statusType === 'success' ? 'var(--accent-success)'
                 : 'var(--accent-primary)',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            {statusMsg}
          </div>
        )}

        {/* Modal Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-tertiary)'
        }}>
          <button
            onClick={() => setActiveTab('myFonts')}
            style={{
              flex: 1,
              padding: '12px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'myFonts' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'myFonts' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            รายการฟอนต์ทั้งหมด ({presetFonts.length + customFonts.length})
          </button>
          <button
            onClick={() => setActiveTab('googleFonts')}
            style={{
              flex: 1,
              padding: '12px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'googleFonts' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === 'googleFonts' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            นำเข้าจาก Google Fonts (1-Click)
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'myFonts' && (
            <div>
              {/* Local File Upload Box */}
              <div style={{
                border: '2px dashed var(--border-default)',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                textAlign: 'center',
                marginBottom: '20px',
                backgroundColor: 'var(--bg-tertiary)'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>อัปโหลดไฟล์ฟอนต์จากคอมพิวเตอร์</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  รองรับนามสกุลไฟล์ .ttf, .otf, .woff, .woff2 (ขนาดสูงสุด 15MB)
                </div>
                <input
                  type="file"
                  id="font-file-input"
                  accept=".ttf,.otf,.woff,.woff2"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload(e.target.files[0])}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => document.getElementById('font-file-input').click()}
                >
                  เลือกไฟล์ฟอนต์...
                </button>
              </div>

              {/* Custom Fonts Section */}
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                ฟอนต์ที่คุณอัปโหลด / นำเข้าเอง ({customFonts.length})
              </h3>

              {customFonts.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', marginBottom: '20px' }}>
                  ยังไม่มีฟอนต์ส่วนตัว (สามารถอัปโหลดไฟล์หรือนำเข้าจาก Google Fonts ได้)
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {customFonts.map((font) => (
                    <div
                      key={font.filename}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        backgroundColor: 'var(--bg-tertiary)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{font.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{font.filename}</div>
                      </div>
                      {/* H-3: two-step delete confirm (no native confirm dialog) */}
                      <button
                        className={`btn btn-sm ${deleteConfirm === font.filename ? 'btn-danger' : 'btn-secondary'}`}
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => handleDeleteFont(font.filename, font.name)}
                        title={deleteConfirm === font.filename ? 'กดอีกครั้งเพื่อยืนยันการลบ' : 'ลบฟอนต์นี้'}
                      >
                        {deleteConfirm === font.filename ? '⚠ ยืนยัน?' : 'ลบ'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Preset Fonts Section */}
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                ฟอนต์มาตรฐานระบบ ({presetFonts.length})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {presetFonts.map((f) => (
                  <div
                    key={f}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      color: 'var(--text-primary)'
                    }}
                  >
                    {f}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'googleFonts' && (
            <div>
              {/* Link to external Google Fonts website */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                backgroundColor: 'rgba(124, 106, 232, 0.1)',
                border: '1px solid var(--accent-primary)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '20px'
              }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--accent-primary)' }}>
                    ค้นหาฟอนต์สวยๆ บน Google Fonts
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    คุณสามารถเปิดดูตัวอย่างฟอนต์ทั้งหมดในเว็บ Google Fonts แล้วพิมพ์ชื่อมาดาวน์โหลดได้เลย
                  </div>
                </div>
                <a
                  href="https://fonts.google.com/?subset=thai"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
                >
                  เปิด fonts.google.com
                </a>
              </div>

              {/* Custom Input Google Font Import */}
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">พิมพ์ชื่อฟอนต์ที่ต้องการนำเข้าจาก Google Fonts</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="เช่น Prompt, Chonburi, Mali, Pattaya, Sarabun..."
                    value={gfontName}
                    onChange={(e) => setGfontName(e.target.value)}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={importingGfont}
                    onClick={() => handleImportGoogleFont()}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {importingGfont ? 'กำลังโหลด...' : 'นำเข้าฟอนต์'}
                  </button>
                </div>
              </div>

              {/* Popular Thai Google Fonts Chips */}
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                ฟอนต์ภาษาไทยยอดนิยม (กดเพื่อนำเข้าทันที 1-Click)
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {POPULAR_THAI_GFONTS.map((font) => (
                  <button
                    key={font}
                    className="btn btn-secondary btn-sm"
                    disabled={importingGfont}
                    onClick={() => handleImportGoogleFont(font)}
                    style={{ fontSize: '13px' }}
                  >
                    + {font}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-default)',
          backgroundColor: 'var(--bg-tertiary)',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button className="btn btn-secondary" onClick={onClose}>
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
