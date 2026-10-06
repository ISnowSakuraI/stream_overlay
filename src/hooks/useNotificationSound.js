import { useCallback, useRef } from 'react';

// Tone profiles for each alert type (frequency in Hz, duration in seconds)
const TONE_PROFILES = {
  follow:    [{ freq: 880, dur: 0.08 }, { freq: 1100, dur: 0.12 }],
  subscribe: [{ freq: 660, dur: 0.08 }, { freq: 880, dur: 0.08 }, { freq: 1100, dur: 0.16 }],
  superchat: [{ freq: 523, dur: 0.06 }, { freq: 659, dur: 0.06 }, { freq: 784, dur: 0.06 }, { freq: 1047, dur: 0.18 }],
  raid:      [{ freq: 440, dur: 0.1 }, { freq: 660, dur: 0.1 }, { freq: 880, dur: 0.08 }, { freq: 1100, dur: 0.08 }, { freq: 1320, dur: 0.2 }],
};

/**
 * useNotificationSound
 *
 * Plays a distinct Web Audio API tone in the browser dashboard when an
 * alert event arrives.  No files needed — tones are generated on-the-fly.
 *
 * @param {object} settings - The settings object from useWebSocket
 * @returns {{ playNotification }} - Call playNotification(alertType) to trigger a sound
 */
export function useNotificationSound(settings) {
  // Lazily create the AudioContext (browsers block creation until user gesture)
  const ctxRef = useRef(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === 'closed') {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume suspended context (common after page focus change)
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const playNotification = useCallback((alertType) => {
    const soundSettings = settings?.dashboardSound;
    if (!soundSettings?.enabled) return;

    const volume = typeof soundSettings.volume === 'number'
      ? Math.min(Math.max(soundSettings.volume, 0), 1)
      : 0.6;

    const tones = TONE_PROFILES[alertType] || TONE_PROFILES.follow;

    try {
      const ctx = getCtx();
      let startTime = ctx.currentTime + 0.02; // small start delay

      tones.forEach(({ freq, dur }) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, startTime);

        // Envelope: fast attack, gentle decay
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + dur + 0.05);

        startTime += dur * 0.85; // slight overlap for legato feel
      });
    } catch (err) {
      console.error('[NotificationSound] Failed to play sound:', err);
    }
  }, [settings, getCtx]);

  return { playNotification };
}