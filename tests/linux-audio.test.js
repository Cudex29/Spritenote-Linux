'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spectrumFromPcm, getPulseMonitorCandidates } = require('../electron/linux-audio');

function sinePcm(frequency = 440, amplitude = 0.7, frames = 1024, sampleRate = 48000) {
  const buffer = Buffer.alloc(frames * 4);
  for (let i = 0; i < frames; i += 1) {
    const sample = Math.round(Math.sin(2 * Math.PI * frequency * i / sampleRate) * amplitude * 32767);
    buffer.writeInt16LE(sample, i * 4);
    buffer.writeInt16LE(sample, i * 4 + 2);
  }
  return buffer;
}

test('Linux audio spectrum returns 128 quiet bins for silence', () => {
  const data = spectrumFromPcm(Buffer.alloc(1024 * 4));
  assert.equal(data.length, 128);
  assert.equal(Math.max(...data), 0);
});

test('Linux audio spectrum detects a tone', () => {
  const data = spectrumFromPcm(sinePcm());
  assert.equal(data.length, 128);
  assert.ok(Math.max(...data) > 80);
  assert.ok(data.some(value => value > 0));
});

test('monitor candidates always include the PulseAudio default monitor alias', () => {
  assert.ok(getPulseMonitorCandidates().includes('@DEFAULT_MONITOR@'));
});
