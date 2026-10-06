const ALERT_TYPES = new Set(['follow', 'subscribe', 'superchat', 'raid']);
const SHAPES = new Set(['bubble', 'minimal', 'card', 'compact']);
const POSITIONS = new Set(['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']);

export function text(value, { max = 500, fallback = '' } = {}) {
  if (typeof value !== 'string') return fallback;
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
}

export function number(value, { min, max, fallback }) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function validateAlertType(value) {
  return ALERT_TYPES.has(value) ? value : null;
}

export function sanitizeAlertPayload(input = {}) {
  return {
    name: text(input.name ?? input.userName, { max: 100, fallback: 'Anonymous' }) || 'Anonymous',
    amount: text(input.amount ?? input.superchatAmount, { max: 80 }),
    message: text(input.message ?? input.userComment, { max: 500 }),
    imagePath: safeUploadPath(input.imagePath, 'images'),
    soundPath: safeUploadPath(input.soundPath, 'sounds'),
    duration: number(input.duration, { min: 1_000, max: 60_000, fallback: undefined }),
    fontFamily: text(input.fontFamily, { max: 100 }),
    fontSize: number(input.fontSize, { min: 10, max: 120, fallback: undefined }),
    fontColor: text(input.fontColor, { max: 32 }),
    bgColor: text(input.bgColor, { max: 64 }),
    ttsTemplate: text(input.ttsTemplate, { max: 600 }),
    subMessage: text(input.subMessage, { max: 600 }),
    ttsEnabled: typeof input.ttsEnabled === 'boolean' ? input.ttsEnabled : undefined,
  };
}

export function safeUploadPath(value, folder) {
  if (typeof value !== 'string') return '';
  const expression = new RegExp(`^/uploads/${folder}/[a-zA-Z0-9_.-]+$`);
  return expression.test(value) ? value : '';
}

export function sanitizeSettingsPatch(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Settings must be an object');
  const patch = {};
  if (['ask', 'minimize', 'exit'].includes(input.closeBehavior)) patch.closeBehavior = input.closeBehavior;
  if (input.youtube && typeof input.youtube === 'object') patch.youtube = {
    videoId: text(input.youtube.videoId, { max: 300 }),
    autoConnect: typeof input.youtube.autoConnect === 'boolean' ? input.youtube.autoConnect : undefined,
  };
  if (input.twitch && typeof input.twitch === 'object') patch.twitch = {
    channel: text(input.twitch.channel, { max: 100 }).replace(/^#/, '').toLowerCase(),
    autoConnect: typeof input.twitch.autoConnect === 'boolean' ? input.twitch.autoConnect : undefined,
  };
  if (input.tts && typeof input.tts === 'object') patch.tts = {
    enabled: typeof input.tts.enabled === 'boolean' ? input.tts.enabled : undefined,
    maxLength: number(input.tts.maxLength, { min: 20, max: 500, fallback: undefined }),
  };
  if (input.dashboardSound && typeof input.dashboardSound === 'object') patch.dashboardSound = {
    enabled: typeof input.dashboardSound.enabled === 'boolean' ? input.dashboardSound.enabled : undefined,
    volume: number(input.dashboardSound.volume, { min: 0, max: 1, fallback: undefined }),
  };
  if (input.chatOverlay && typeof input.chatOverlay === 'object') patch.chatOverlay = {
    shape: SHAPES.has(input.chatOverlay.shape) ? input.chatOverlay.shape : undefined,
    fontFamily: text(input.chatOverlay.fontFamily, { max: 100 }),
    fontSize: number(input.chatOverlay.fontSize, { min: 10, max: 72, fallback: undefined }),
    fontColor: text(input.chatOverlay.fontColor, { max: 32 }),
    bgColor: text(input.chatOverlay.bgColor, { max: 64 }),
    maxMessages: number(input.chatOverlay.maxMessages, { min: 1, max: 100, fallback: undefined }),
    fadeTimeout: number(input.chatOverlay.fadeTimeout, { min: 0, max: 3600, fallback: undefined }),
    position: POSITIONS.has(input.chatOverlay.position) ? input.chatOverlay.position : undefined,
  };
  if (input.alertOverlay && typeof input.alertOverlay === 'object') patch.alertOverlay = {
    position: POSITIONS.has(input.alertOverlay.position) ? input.alertOverlay.position : undefined,
    defaultDuration: number(input.alertOverlay.defaultDuration, { min: 1_000, max: 60_000, fallback: undefined }),
  };
  return removeUndefined(patch);
}

export function sanitizeAlertConfigs(input) {
  if (!Array.isArray(input) || input.length > 20) throw new Error('Alert configuration must be an array of at most 20 items');
  const seen = new Set();
  return input.map((item, index) => {
    const type = validateAlertType(item?.type);
    if (!type || seen.has(type)) throw new Error(`Invalid or duplicate alert type at index ${index}`);
    seen.add(type);
    return removeUndefined({
      id: text(item.id, { max: 100, fallback: `${type}-default` }) || `${type}-default`, type,
      name: text(item.name, { max: 120 }), imagePath: safeUploadPath(item.imagePath, 'images'),
      soundPath: safeUploadPath(item.soundPath, 'sounds'), duration: number(item.duration, { min: 1_000, max: 60_000, fallback: 5_000 }),
      ttsEnabled: item.ttsEnabled !== false, ttsTemplate: text(item.ttsTemplate, { max: 600 }),
      subMessage: text(item.subMessage, { max: 600 }), fontFamily: text(item.fontFamily, { max: 100 }),
      fontSize: number(item.fontSize, { min: 10, max: 120, fallback: 28 }), fontColor: text(item.fontColor, { max: 32 }),
      bgColor: text(item.bgColor, { max: 64 }), enabled: item.enabled !== false,
      animationIn: ['bounceIn', 'slideIn', 'fadeIn', 'zoomIn'].includes(item.animationIn) ? item.animationIn : 'bounceIn',
    });
  });
}

function removeUndefined(value) {
  return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => [key, item && typeof item === 'object' && !Array.isArray(item) ? removeUndefined(item) : item]));
}
