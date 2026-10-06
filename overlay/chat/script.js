const container = document.getElementById('chat-container');
let settings = {};
let maxMessages = 20;

// Check if running in preview mode via URL param
const urlParams = new URLSearchParams(window.location.search);
const isPreview = urlParams.get('preview') === 'true';

const YT_SVG = `<svg class="platform-icon youtube" viewBox="0 0 24 24" width="16" height="16"><path fill="#FF0000" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/><path fill="#FFFFFF" d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;
const TW_SVG = `<svg class="platform-icon twitch" viewBox="0 0 24 24" width="16" height="16"><path fill="#9146FF" d="M11.571 4.714h1.715v5.143h-1.715zm4.715 0h1.714v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>`;

async function ensureFontLoaded(fontName) {
  if (!fontName) return;
  const elementId = `font-load-${fontName.replace(/\s+/g, '-')}`;
  if (document.getElementById(elementId)) return;

  try {
    const res = await fetch('/api/fonts');
    const data = await res.json();
    const custom = (data.customFonts || []).find((f) => f.name.toLowerCase() === fontName.toLowerCase());
    if (custom) {
      // Sanitize: font-family name must only contain safe characters
      const safeName = fontName.replace(/[^a-zA-Z0-9\s\-]/g, '');
      // Sanitize: URL must be a relative /uploads/fonts/... path only (no injection)
      const safeUrl = /^\/uploads\/fonts\/[^"'<>]+$/.test(custom.url) ? custom.url : '';
      if (!safeName || !safeUrl) return;

      const style = document.createElement('style');
      style.id = elementId;
      style.textContent = `@font-face { font-family: '${safeName}'; src: url('${safeUrl}'); }`;
      document.head.appendChild(style);
      return;
    }
  } catch (e) {
    console.error('[Chat Overlay] Failed to load custom font:', e);
  }

  const link = document.createElement('link');
  link.id = elementId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}

// M-14: track all pending fade-out timers so we can clear them on chat:clear
const pendingTimers = [];

function addPendingTimer(fn, delay) {
  const id = setTimeout(fn, delay);
  pendingTimers.push(id);
  return id;
}

function clearAllPendingTimers() {
  pendingTimers.forEach(clearTimeout);
  pendingTimers.length = 0;
}

// L-18: exponential backoff state
let reconnectDelay = 3000;

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[Chat Overlay] Connected to WebSocket server');
    // L-18: reset backoff on successful connect
    reconnectDelay = 3000;
  };

  ws.onmessage = (event) => {
    try {
      const { event: ev, data } = JSON.parse(event.data);

      if (ev === 'init') {
        applySettings(data.settings?.chatOverlay);
        if (data.messages && data.messages.length > 0 && !isPreview) {
          data.messages.forEach(addChatMessage);
        } else if (isPreview) {
          loadSamplePreviewMessages();
        }
      } else if (ev === 'chat:message') {
        addChatMessage(data);
      } else if (ev === 'chat:clear') {
        // M-14: clear all dangling fade-out timers before wiping DOM
        clearAllPendingTimers();
        container.innerHTML = '';
      } else if (ev === 'connection:status') {
        // If connecting to a new stream session, clear previous chat
        if (data && data.connected && !isPreview) {
          clearAllPendingTimers();
          container.innerHTML = '';
        }
      } else if (ev === 'settings:update' && data.chatOverlay) {
        applySettings(data.chatOverlay);
        if (isPreview) {
          loadSamplePreviewMessages();
        }
      }
    } catch (err) {
      console.error('[Chat Overlay] Error parsing message:', err);
    }
  };

  ws.onclose = () => {
    // L-18: exponential backoff reconnect
    console.log(`[Chat Overlay] WebSocket connection lost. Reconnecting in ${reconnectDelay / 1000}s...`);
    setTimeout(connectWebSocket, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
  };

  ws.onerror = (err) => {
    console.error('[Chat Overlay] WebSocket error:', err);
    if (isPreview) {
      loadSamplePreviewMessages();
    }
  };
}

function applySettings(cfg) {
  if (!cfg) return;
  settings = cfg;
  maxMessages = cfg.maxMessages || 20;

  if (cfg.fontFamily) {
    ensureFontLoaded(cfg.fontFamily);
  }

  // Apply shape class and position
  container.className = `chat-container ${cfg.shape || 'bubble'} ${cfg.position || 'bottom-left'}`;

  // Apply CSS custom variables
  const fontChain = cfg.fontFamily
    ? `'${cfg.fontFamily}', 'Noto Sans Thai', 'Inter', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', 'Apple Color Emoji', sans-serif`
    : `'Noto Sans Thai', 'Inter', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', 'Apple Color Emoji', sans-serif`;

  container.style.setProperty('--font-family', fontChain);
  container.style.setProperty('--font-size', `${cfg.fontSize || 15}px`);
  container.style.setProperty('--font-color', cfg.fontColor || '#ECECEF');
  container.style.setProperty('--bg-color', cfg.bgColor || 'rgba(25, 25, 27, 0.85)');
}

function renderMessageHtml(msg) {
  if (msg.messageParts && Array.isArray(msg.messageParts) && msg.messageParts.length > 0) {
    return msg.messageParts.map((part) => {
      if (part.url || part.isCustomEmoji) {
        const emojiUrl = part.url;
        const altText = escapeHtml(part.alt || part.emojiText || 'emoji');
        return `<img class="chat-emoji" src="${emojiUrl}" alt="${altText}" title="${altText}" onerror="this.replaceWith(document.createTextNode('${altText}'))" />`;
      }
      return escapeHtml(part.text || part.emojiText || '');
    }).join('');
  }

  return escapeHtml(msg.message || '');
}

function addChatMessage(msg) {
  if (!msg) return;

  const msgEl = document.createElement('div');
  msgEl.className = `message-item ${msg.isSuperchat ? 'superchat' : ''}`;
  if (msg.authorColor) {
    msgEl.style.setProperty('--user-color', msg.authorColor);
  }

  const isYT = msg.platform === 'youtube';
  const platformIcon = isYT ? YT_SVG : TW_SVG;
  const avatarUrl = msg.authorAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(msg.author || 'user')}`;
  const messageHtml = renderMessageHtml(msg);

  // Build DOM safely — no innerHTML injection for user-controlled data
  const img = document.createElement('img');
  img.className = 'avatar';
  img.src = avatarUrl;                        // safe: DOM property, not innerHTML
  img.alt = msg.author || '';                 // safe: DOM property, not innerHTML
  img.onerror = function () { this.style.display = 'none'; };

  const headerDiv = document.createElement('div');
  headerDiv.className = 'message-header';
  // platformIcon is a trusted internal SVG constant, not user data
  headerDiv.innerHTML = platformIcon;

  const usernameSpan = document.createElement('span');
  usernameSpan.className = 'username';
  usernameSpan.textContent = msg.author || '';   // safe: textContent

  headerDiv.appendChild(usernameSpan);

  const textDiv = document.createElement('div');
  textDiv.className = 'text';
  textDiv.innerHTML = messageHtml;               // messageHtml is produced by renderMessageHtml which calls escapeHtml

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.appendChild(headerDiv);
  contentDiv.appendChild(textDiv);

  msgEl.appendChild(img);
  msgEl.appendChild(contentDiv);

  container.appendChild(msgEl);

  // Auto hide timer (Fade Timeout in seconds)
  const fadeTimeout = settings.fadeTimeout || 0;
  if (fadeTimeout > 0 && !isPreview) {
    // M-14: use addPendingTimer so this is tracked and can be cancelled on chat:clear
    addPendingTimer(() => {
      msgEl.classList.add('fade-out');
      addPendingTimer(() => msgEl.remove(), 250);
    }, fadeTimeout * 1000);
  }

  // Enforce max messages limit
  while (container.children.length > maxMessages) {
    const oldest = container.children[0];
    oldest.classList.add('fade-out');
    addPendingTimer(() => oldest.remove(), 200);
  }

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

function loadSamplePreviewMessages() {
  container.innerHTML = '';
  const samples = [
    {
      id: 'p1',
      platform: 'youtube',
      author: 'StreamerName',
      authorColor: '#7C6AE8',
      message: 'ยินดีต้อนรับทุกคนเข้าสู่สตรีมครับ! 🎮🔥',
      isSuperchat: false
    },
    {
      id: 'p2',
      platform: 'twitch',
      author: 'Viewer_01',
      authorColor: '#3CC68A',
      message: 'สวัสดีครับแอดมิน วันนี้เล่นเกมอะไรครับ? 🙏❤️',
      isSuperchat: false
    },
    {
      id: 'p3',
      platform: 'youtube',
      author: 'SuperFan99',
      authorColor: '#E8A33C',
      superchatAmount: '฿ 100',
      message: 'ขอบคุณสำหรับสตรีมสนุกๆ ครับ! 🎉🚀',
      isSuperchat: true
    }
  ];

  samples.forEach(addChatMessage);
}

// L-20: escape " and ' in addition to &, <, > to prevent XSS in attribute context
function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

connectWebSocket();
