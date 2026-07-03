"use client";

let sharedAudioCtx: AudioContext | null = null;

export const initSharedAudio = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  if (sharedAudioCtx) return sharedAudioCtx;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  } catch (e) {
    console.warn("Failed to init AudioContext:", e);
  }
  return sharedAudioCtx;
};

export const resumeSharedAudio = (): void => {
  try {
    const ctx = initSharedAudio();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch((err) => console.warn("Failed to resume AudioContext:", err));
    }
  } catch (e) {
    console.warn("Error resuming AudioContext:", e);
  }
};

export const playSharedBeep = (): void => {
  try {
    const ctx = initSharedAudio();
    if (!ctx) return;
    
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1400, ctx.currentTime); // High pitch POS chirp
    gainNode.gain.setValueAtTime(0.18, ctx.currentTime); // Sound volume
    
    oscillator.start();
    setTimeout(() => {
      try {
        oscillator.stop();
      } catch (e) {}
    }, 100);
  } catch (e) {
    console.warn("Could not play audio scan signal:", e);
  }
};
