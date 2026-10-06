import React, { useState, useEffect, useMemo } from 'react';
import ChatMessage from '../components/ChatMessage';

export default function ChatPage({ messages: liveMessages }) {
  const [historyMessages, setHistoryMessages] = useState([]);
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/messages?limit=300');
      if (res.ok) {
        const data = await res.json();
        setHistoryMessages(data || []);
      }
    } catch (e) {
      console.error('[ChatPage] Failed to fetch history:', e);
    }
  };

  // #20: Memoize the merge so the Map is only rebuilt when message arrays actually change
  const combined = useMemo(() => {
    const messageMap = new Map();
    historyMessages.forEach(m => messageMap.set(m.id, m));
    (liveMessages || []).forEach(m => messageMap.set(m.id, m));
    return Array.from(messageMap.values());
  }, [historyMessages, liveMessages]);

  const filtered = combined.filter(msg => {
    if (filterPlatform !== 'all' && msg.platform !== filterPlatform) return false;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      return (msg.author || '').toLowerCase().includes(t) || (msg.message || '').toLowerCase().includes(t);
    }
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ประวัติแชท</h1>
          <p className="page-subtitle">ดูย้อนหลัง ค้นหาข้อความ และกรองตาม platform</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            className="form-control"
            value={filterPlatform}
            onChange={e => setFilterPlatform(e.target.value)}
            style={{ width: '160px' }}
          >
            <option value="all">ทุก Platform</option>
            <option value="youtube">YouTube</option>
            <option value="twitch">Twitch</option>
          </select>
          <input
            type="text"
            className="form-control"
            placeholder="ค้นหาชื่อหรือข้อความ..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '200px' }}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">รายการแชท</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', padding: '3px 10px', borderRadius: '999px', border: '1px solid var(--border-default)' }}>
            {filtered.length} รายการ
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 10px', opacity: 0.4 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <div style={{ fontSize: '14px', marginBottom: '4px' }}>ไม่พบข้อความที่ตรงกัน</div>
              <div style={{ fontSize: '12px', opacity: 0.7 }}>ลองเปลี่ยนคำค้นหาหรือ filter</div>
            </div>
          ) : (
            filtered.map((msg, idx) => <ChatMessage key={msg.id || idx} msg={msg} />)
          )}
        </div>
      </div>
    </div>
  );
}
