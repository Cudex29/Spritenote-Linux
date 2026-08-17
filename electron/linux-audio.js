'use strict';

const { spawn, spawnSync } = require('node:child_process');

const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const FFT_SIZE = 1024;
const OUTPUT_BINS = 128;
const FRAME_INTERVAL_MS = 16;
const MAX_FREQUENCY = 18000;

function commandAvailable(command) {
  try {
    const result = spawnSync(command, ['--version'], {
      stdio: 'ignore',
      timeout: 1500,
    });
    return !result.error;
  } catch (_) {
    return false;
  }
}

function runText(command, args) {
  try {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      timeout: 1500,
      windowsHide: true,
    });
    if (result.error || result.status !== 0) return '';
    return String(result.stdout || '').trim();
  } catch (_) {
    return '';
  }
}

function getPulseMonitorCandidates() {
  const candidates = [];
  const sink = runText('pactl', ['get-default-sink']);
  const sourceLines = runText('pactl', ['list', 'short', 'sources'])
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const sources = sourceLines
    .map(line => line.split(/\s+/)[1])
    .filter(Boolean);

  if (sink) {
    const exact = `${sink}.monitor`;
    if (sources.includes(exact)) candidates.push(exact);
    const related = sources.find(source => source.endsWith('.monitor') && source.includes(sink));
    if (related && !candidates.includes(related)) candidates.push(related);
  }

  // PulseAudio exposes this alias and pipewire-pulse normally supports it too.
  candidates.push('@DEFAULT_MONITOR@');

  // Last-resort fallback for unusual routing setups.
  for (const source of sources.filter(source => source.endsWith('.monitor'))) {
    if (!candidates.includes(source)) candidates.push(source);
  }
  return candidates;
}

function fftInPlace(real, imag) {
  const n = real.length;
  let j = 0;
  for (let i = 1; i < n; i += 1) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = -2 * Math.PI / len;
    const wLenCos = Math.cos(angle);
    const wLenSin = Math.sin(angle);
    for (let i = 0; i < n; i += len) {
      let wCos = 1;
      let wSin = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k += 1) {
        const even = i + k;
        const odd = even + half;
        const oddReal = real[odd] * wCos - imag[odd] * wSin;
        const oddImag = real[odd] * wSin + imag[odd] * wCos;
        const evenReal = real[even];
        const evenImag = imag[even];
        real[even] = evenReal + oddReal;
        imag[even] = evenImag + oddImag;
        real[odd] = evenReal - oddReal;
        imag[odd] = evenImag - oddImag;
        const nextCos = wCos * wLenCos - wSin * wLenSin;
        wSin = wCos * wLenSin + wSin * wLenCos;
        wCos = nextCos;
      }
    }
  }
}

function spectrumFromPcm(buffer) {
  const bytesPerFrame = CHANNELS * 2;
  const needed = FFT_SIZE * bytesPerFrame;
  if (!Buffer.isBuffer(buffer) || buffer.length < needed) return new Uint8Array(OUTPUT_BINS);

  const start = buffer.length - needed;
  const real = new Float64Array(FFT_SIZE);
  const imag = new Float64Array(FFT_SIZE);

  for (let i = 0; i < FFT_SIZE; i += 1) {
    const offset = start + i * bytesPerFrame;
    const left = buffer.readInt16LE(offset);
    const right = buffer.readInt16LE(offset + 2);
    const mono = (left + right) / 65536;
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
    real[i] = mono * window;
  }

  fftInPlace(real, imag);

  const output = new Uint8Array(OUTPUT_BINS);
  const maxSourceBin = Math.min(
    FFT_SIZE / 2 - 1,
    Math.floor(MAX_FREQUENCY * FFT_SIZE / SAMPLE_RATE),
  );
  const minDb = -78;
  const maxDb = -12;

  for (let i = 0; i < OUTPUT_BINS; i += 1) {
    const sourceBin = Math.max(1, Math.round(1 + (i / (OUTPUT_BINS - 1)) * (maxSourceBin - 1)));
    const magnitude = Math.hypot(real[sourceBin], imag[sourceBin]) * 2 / FFT_SIZE;
    const db = 20 * Math.log10(Math.max(magnitude, 1e-8));
    const normalized = Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb)));
    output[i] = Math.round(normalized * 255);
  }
  return output;
}

class LinuxAudioLoopback {
  constructor(send = () => {}) {
    this.send = send;
    this.child = null;
    this.pcm = Buffer.alloc(0);
    this.lastFrameAt = 0;
    this.manualStop = false;
    this.lastError = '';
  }

  capabilities() {
    if (process.platform !== 'linux') {
      return { supported: false, backend: null, reason: 'linux-only' };
    }
    if (!commandAvailable('parec')) {
      return {
        supported: false,
        backend: 'pipewire-pulse',
        reason: 'parec-missing',
        dependency: 'libpulse',
        installHint: 'sudo pacman -S libpulse',
      };
    }
    return {
      supported: true,
      backend: 'pipewire-pulse',
      dependency: 'libpulse',
    };
  }

  async start() {
    this.stop();
    const capabilities = this.capabilities();
    if (!capabilities.supported) return { ok: false, ...capabilities };

    const candidates = getPulseMonitorCandidates();
    let lastError = '';
    for (const device of candidates) {
      const result = await this._tryDevice(device);
      if (result.ok) {
        return {
          ok: true,
          backend: 'pipewire-pulse',
          device,
          sampleRate: SAMPLE_RATE,
          channels: CHANNELS,
        };
      }
      lastError = result.error || lastError;
    }

    return {
      ok: false,
      supported: true,
      backend: 'pipewire-pulse',
      reason: 'monitor-unavailable',
      error: lastError || 'No se encontró una fuente monitor de audio.',
      installHint: 'Comprueba PipeWire/PulseAudio y que pipewire-pulse esté activo.',
    };
  }

  _tryDevice(device) {
    return new Promise(resolve => {
      this.manualStop = false;
      this.pcm = Buffer.alloc(0);
      this.lastFrameAt = 0;
      let stderr = '';
      let settled = false;

      const child = spawn('parec', [
        `--device=${device}`,
        '--raw',
        '--format=s16le',
        `--rate=${SAMPLE_RATE}`,
        `--channels=${CHANNELS}`,
        '--latency-msec=16',
        '--client-name=SpriteNote',
        '--stream-name=SpriteNote Visualizer',
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      this.child = child;

      const fail = message => {
        if (settled) return;
        settled = true;
        if (this.child === child) this.child = null;
        try { child.kill('SIGTERM'); } catch (_) { /* already gone */ }
        resolve({ ok: false, error: message || stderr.trim() || `No se pudo abrir ${device}` });
      };

      child.once('error', error => fail(error.message));
      child.stderr.on('data', chunk => {
        stderr += chunk.toString('utf8');
        if (stderr.length > 4000) stderr = stderr.slice(-4000);
      });
      child.stdout.on('data', chunk => this._handlePcm(chunk));
      child.once('exit', code => {
        const wasCurrent = this.child === child;
        if (wasCurrent) this.child = null;
        if (!settled) {
          fail(stderr.trim() || `parec terminó con código ${code ?? 'desconocido'}`);
          return;
        }
        if (wasCurrent && !this.manualStop) {
          this.send('audio-loopback:ended', {
            reason: 'capture-ended',
            error: stderr.trim().slice(0, 500),
          });
        }
      });

      setTimeout(() => {
        if (settled) return;
        if (child.exitCode !== null || child.killed) {
          fail(stderr.trim() || 'La captura de audio terminó al iniciar.');
          return;
        }
        settled = true;
        this.lastError = '';
        resolve({ ok: true });
      }, 350);
    });
  }

  _handlePcm(chunk) {
    if (!Buffer.isBuffer(chunk) || !chunk.length) return;
    const maxBytes = FFT_SIZE * CHANNELS * 2 * 3;
    this.pcm = Buffer.concat([this.pcm, chunk]);
    if (this.pcm.length > maxBytes) this.pcm = this.pcm.subarray(this.pcm.length - maxBytes);

    const now = Date.now();
    if (now - this.lastFrameAt < FRAME_INTERVAL_MS) return;
    if (this.pcm.length < FFT_SIZE * CHANNELS * 2) return;
    this.lastFrameAt = now;
    const frame = spectrumFromPcm(this.pcm);
    this.send('audio-loopback:frame', Array.from(frame));
  }

  stop() {
    const child = this.child;
    this.child = null;
    this.manualStop = true;
    this.pcm = Buffer.alloc(0);
    if (!child || child.killed) return { ok: true };
    try { child.kill('SIGTERM'); } catch (_) { /* already gone */ }
    const timer = setTimeout(() => {
      try { if (child.exitCode === null) child.kill('SIGKILL'); } catch (_) { /* already gone */ }
    }, 250);
    timer.unref?.();
    return { ok: true };
  }
}

module.exports = {
  LinuxAudioLoopback,
  spectrumFromPcm,
  getPulseMonitorCandidates,
};
