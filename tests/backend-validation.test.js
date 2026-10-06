import test from 'node:test';
import assert from 'node:assert/strict';
import { isTrustedLocalOrigin } from '../server/app.js';
import { sanitizeAlertConfigs, sanitizeAlertPayload, sanitizeSettingsPatch } from '../server/lib/validation.js';

test('only local browser origins are trusted', () => {
  assert.equal(isTrustedLocalOrigin('http://localhost:3000'), true);
  assert.equal(isTrustedLocalOrigin('http://127.0.0.1:5173'), true);
  assert.equal(isTrustedLocalOrigin('https://example.com'), false);
  assert.equal(isTrustedLocalOrigin('null'), false);
});

test('settings patch clamps and removes unsupported values', () => {
  const result = sanitizeSettingsPatch({
    twitch: { channel: '#My_Channel', autoConnect: true },
    tts: { maxLength: 9999 },
    dashboardSound: { volume: 0.5 },
  });
  assert.deepEqual(result.twitch, { channel: 'my_channel', autoConnect: true });
  assert.equal(result.tts.maxLength, undefined);
  assert.equal(result.dashboardSound.volume, 0.5);
});

test('alert input remains bounded and only accepts known types', () => {
  const payload = sanitizeAlertPayload({ name: 'a'.repeat(200), duration: 999_999, imagePath: '/uploads/sounds/not-image.mp3' });
  assert.equal(payload.name.length, 100);
  assert.equal(payload.duration, undefined);
  assert.equal(payload.imagePath, '');
  assert.throws(() => sanitizeAlertConfigs([{ type: 'follow' }, { type: 'follow' }]));
});
