import React from 'react';
import { NavLink } from 'react-router-dom';

const NAV_GROUPS = [
  {
    items: [
      {
        path: '/',
        label: 'Dashboard',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/>
            <rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>
          </svg>
        )
      },
      {
        path: '/chat',
        label: 'ประวัติแชท',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )
      }
    ]
  },
  {
    label: 'Overlay',
    items: [
      {
        path: '/alerts',
        label: 'การแจ้งเตือน',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        )
      },
      {
        path: '/overlay',
        label: 'ปรับแต่ง Overlay',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
          </svg>
        )
      },
      {
        path: '/tts',
        label: 'Thai TTS',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
          </svg>
        )
      }
    ]
  },
  {
    label: 'System',
    items: [
      {
        path: '/settings',
        label: 'ตั้งค่าระบบ',
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        )
      }
    ]
  }
];

export default function Sidebar({ isConnected, status }) {
  return (
    <aside style={{
      width: '220px',
      flexShrink: 0,
      background: 'rgba(10, 10, 16, 0.95)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRight: '1px solid var(--border-default)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>

      {/* Logo */}
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: '1px solid var(--border-default)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px',
            background: 'linear-gradient(135deg, var(--accent-primary), #9B8AFF)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(124,106,232,0.4)',
            flexShrink: 0
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.2px' }}>
              StreamOverlay
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', letterSpacing: '0.5px', marginTop: '1px' }}>
              PRO — OBS Control
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: gi < NAV_GROUPS.length - 1 ? '16px' : '0' }}>
            {group.label && (
              <div style={{
                fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                letterSpacing: '1px', color: 'var(--text-muted)', padding: '0 8px',
                marginBottom: '4px'
              }}>
                {group.label}
              </div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(124,106,232,0.25), rgba(107,90,213,0.15))'
                    : 'transparent',
                  border: isActive ? '1px solid rgba(124,106,232,0.3)' : '1px solid transparent',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: isActive ? '600' : '500',
                  marginBottom: '2px',
                  transition: 'all 150ms ease',
                  boxShadow: isActive ? '0 2px 8px rgba(124,106,232,0.15)' : 'none',
                })}
              >
                <span style={{ opacity: 1, flexShrink: 0 }}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Connection Footer */}
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid var(--border-default)',
        background: 'rgba(0,0,0,0.2)',
      }}>
        <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)', marginBottom: '8px' }}>
          สถานะการเชื่อมต่อ
        </div>
        {/* L-6: "Dashboard" is clearer — this shows the dashboard's WebSocket connection, not the server process */}
        <StatusRow label="Dashboard" active={isConnected} />
        <StatusRow
          label={<span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><polygon points="9.545,15.568 15.818,12 9.545,8.432" fill="white"/></svg>
            YouTube
          </span>}
          active={status.youtube?.connected}
        />
        <StatusRow
          label={<span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="#9146FF"><path d="M11.571 4.714h1.715v5.143h-1.715zm4.715 0h1.714v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
            Twitch
          </span>}
          active={status.twitch?.connected}
        />
      </div>
    </aside>
  );
}

function StatusRow({ label, active }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: '5px', fontSize: '12px',
    }}>
      <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{
        color: active ? 'var(--accent-success)' : 'var(--text-muted)',
        fontWeight: '600',
        display: 'flex', alignItems: 'center', gap: '4px',
      }}>
        <span style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: active ? 'var(--accent-success)' : 'var(--text-muted)',
          animation: active ? 'pulse-dot 2s ease-in-out infinite' : 'none',
          display: 'inline-block',
        }} />
        {active ? 'Live' : 'Off'}
      </span>
    </div>
  );
}
