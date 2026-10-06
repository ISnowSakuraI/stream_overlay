const alertCard = document.getElementById('alert-card');
const alertImage = document.getElementById('alert-image');
const alertTitle = document.getElementById('alert-title');
const alertName = document.getElementById('alert-name');
const alertMessage = document.getElementById('alert-message');
const progressBar = document.getElementById('progress-bar');

const alertQueue = [];
let isPlaying = false;
let activeAudio = null;

function stopActiveAudio() {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch (e) {}
    activeAudio = null;
  }
}

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
    console.error('[Alert Overlay] Failed to load custom font:', e);
  }

  const link = document.createElement('link');
  link.id = elementId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}

function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('[Alert Overlay] Connected to WebSocket server');
  };

  ws.onmessage = (event) => {
    try {
      const { event: ev, data } = JSON.parse(event.data);
      if (ev === 'alert:trigger') {
        enqueueAlert(data);
      }
    } catch (err) {
      console.error('[Alert Overlay] Error parsing message:', err);
    }
  };

  ws.onclose = () => {
    console.log('[Alert Overlay] Connection lost. Reconnecting in 3s...');
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = (err) => {
    console.error('[Alert Overlay] WebSocket error:', err);
  };
}

function enqueueAlert(alertData) {
  alertQueue.push(alertData);
  if (!isPlaying) {
    processNextAlert();
  }
}

async function processNextAlert() {
  if (alertQueue.length === 0) {
    isPlaying = false;
    stopActiveAudio();
    alertCard.classList.add('hidden');
    return;
  }

  isPlaying = true;
  stopActiveAudio();

  const alertData = alertQueue.shift();

  if (alertData.fontFamily) {
    ensureFontLoaded(alertData.fontFamily);
  }

  // Populate Alert Card
  alertTitle.innerText = alertData.title || 'New Alert!';
  alertName.innerText = alertData.name || '';

  // Show/Hide sub-message depending on content
  const msgText = alertData.message || alertData.subMessage || '';
  if (msgText && msgText.trim() !== '') {
    alertMessage.innerText = msgText;
    alertMessage.style.display = 'block';
  } else {
    alertMessage.innerText = '';
    alertMessage.style.display = 'none';
  }

  // Apply visual styling
  if (alertData.fontFamily) {
    // L-12: include Thai font fallback chain
    alertCard.style.fontFamily = `'${alertData.fontFamily}', 'Noto Sans Thai', 'Sarabun', 'Prompt', sans-serif`;
  }
  if (alertData.fontColor) alertCard.style.color = alertData.fontColor;
  if (alertData.bgColor) alertCard.style.background = alertData.bgColor;

  // Custom Image
  if (alertData.imagePath) {
    alertImage.src = alertData.imagePath;
    alertImage.style.display = 'block';
  } else {
    alertImage.style.display = 'none';
  }

  // Reset progress bar animation
  const duration = alertData.duration || 5000;
  progressBar.style.transition = 'none';
  progressBar.style.width = '100%';
  setTimeout(() => {
    progressBar.style.transition = `width ${duration}ms linear`;
    progressBar.style.width = '0%';
  }, 50);

  // L-9: Show card with the configured animation class (animationIn setting)
  const animClass = alertData.animationIn || 'bounceIn';
  alertCard.className = `alert-card ${animClass}`;
  alertCard.classList.remove('hidden', 'fade-out');

  // Play Sound if available
  if (alertData.soundPath) {
    const soundUrl = alertData.soundPath.startsWith('http')
      ? alertData.soundPath
      : window.location.origin + alertData.soundPath;
    activeAudio = new Audio(soundUrl);
    activeAudio.play().catch((e) => console.log('[Alert Sound] Auto-play blocked or error:', e));
  }

  // Play TTS if available
  if (alertData.audioUrl) {
    setTimeout(() => {
      stopActiveAudio();
      const fullTtsUrl = alertData.audioUrl.startsWith('http')
        ? alertData.audioUrl
        : window.location.origin + alertData.audioUrl;
      activeAudio = new Audio(fullTtsUrl);
      activeAudio.play().catch((e) => console.log('[Alert TTS] Auto-play blocked or error:', e));
    }, alertData.soundPath ? 500 : 100);
  }

  // Wait duration then animate out & trigger next
  setTimeout(() => {
    alertCard.classList.add('fade-out');
    setTimeout(() => {
      processNextAlert();
    }, 400);
  }, duration);
}

connectWebSocket();
