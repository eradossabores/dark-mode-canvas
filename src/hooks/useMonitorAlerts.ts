import { useEffect, useRef, useCallback } from "react";

// Simple beep sound using Web Audio API
function playBeep(frequency = 880, duration = 300, volume = 0.3) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gainNode.gain.value = volume;
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    oscillator.stop(ctx.currentTime + duration / 1000 + 0.05);
  } catch (e) {
    // Audio not supported
  }
}

export function playNewOrderSound() {
  // Two ascending beeps
  playBeep(660, 200, 0.25);
  setTimeout(() => playBeep(880, 300, 0.3), 250);
}

export function playUrgentSound() {
  // Three fast high beeps
  playBeep(1000, 150, 0.35);
  setTimeout(() => playBeep(1000, 150, 0.35), 200);
  setTimeout(() => playBeep(1200, 250, 0.4), 400);
}

export function useMonitorAlerts(pedidos: any[] | undefined, soundEnabled: boolean) {
  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!pedidos || !soundEnabled) return;

    const currentCount = pedidos.length;
    if (prevCountRef.current !== null && currentCount > prevCountRef.current) {
      playNewOrderSound();
    }
    prevCountRef.current = currentCount;
  }, [pedidos?.length, soundEnabled]);
}
