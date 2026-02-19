/**
 * A short, subtle notification "ding" encoded as a Base64 WAV.
 * This removes the dependency on external .mp3 files and works offline.
 *
 * The sound is generated programmatically: a 440 Hz sine wave, 200 ms,
 * with a quick fade-out, rendered as a 16-bit mono PCM WAV at 22 050 Hz.
 */

function generateDingWav(): string {
  const sampleRate = 22050;
  const duration = 0.2; // seconds
  const frequency = 880; // Hz – a pleasant high ding
  const numSamples = Math.floor(sampleRate * duration);

  // WAV header (44 bytes) + PCM data
  const dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Helper to write a string
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true);  // PCM
  view.setUint16(22, 1, true);  // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);  // block align
  view.setUint16(34, 16, true); // bits per sample

  // data sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = 1 - (i / numSamples); // linear fade-out
    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.9;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }

  // Convert to Base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

let _cached: string | null = null;

export function getNotificationSoundDataUri(): string {
  if (!_cached) {
    _cached = `data:audio/wav;base64,${generateDingWav()}`;
  }
  return _cached;
}
