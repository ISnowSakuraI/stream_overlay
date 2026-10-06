import React from 'react';

export default function ChatMessage({ msg }) {
  if (!msg) return null;

  // L-3: proper fallback for unknown/test platforms
  const platform = msg.platform;
  const badgeColor = platform === 'youtube' ? 'var(--accent-youtube)'
                   : platform === 'twitch'  ? 'var(--accent-twitch)'
                   : 'var(--text-tertiary)';
  const badgeText = platform === 'youtube' ? 'YouTube'
                  : platform === 'twitch'  ? 'Twitch'
                  : (platform || 'Test');

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      padding: '10px 12px',
      backgroundColor: msg.isSuperchat ? 'rgba(232, 163, 60, 0.1)' : 'var(--bg-tertiary)',
      borderLeft: msg.isSuperchat ? '3px solid var(--accent-warning)' : '1px solid var(--border-default)',
      borderRadius: 'var(--radius-sm)',
      fontSize: '13px',
      marginBottom: '6px'
    }}>
      <span style={{
        fontSize: '10px',
        fontWeight: '700',
        padding: '2px 6px',
        borderRadius: '3px',
        backgroundColor: badgeColor,
        color: '#ffffff',
        flexShrink: 0,
        marginTop: '2px'
      }}>
        {badgeText}
      </span>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <span style={{ fontWeight: '600', color: msg.authorColor || 'var(--accent-primary)' }}>
            {msg.author}
          </span>
          {msg.superchatAmount && (
            <span style={{ fontWeight: '700', color: 'var(--accent-warning)', fontSize: '12px' }}>
              [{msg.superchatAmount}]
            </span>
          )}
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>
          {msg.message}
        </div>
      </div>
    </div>
  );
}
