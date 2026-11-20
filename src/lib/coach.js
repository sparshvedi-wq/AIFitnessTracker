// Sound, haptic and optional spoken cues for the workout player, plus a screen
// wake lock. Every call is best-effort: unsupported browsers just stay quiet.

import { isNativeApp, nativeRequest } from './native.js'

let ctx = null

function audio() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// Call from a tap so mobile browsers allow sound later on.
export function unlockAudio() {
  audio()
}

export function beep({ freq = 880, ms = 140, volume = 0.18 } = {}) {
  const a = audio()
  if (!a) return
  const osc = a.createOscillator()
  const gain = a.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const t = a.currentTime
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
  osc.connect(gain).connect(a.destination)
  osc.start(t)
  osc.stop(t + ms / 1000 + 0.02)
}

export function say(text) {
  if (isNativeApp()) {
    void nativeRequest('speech.say', { text }).catch(() => {})
    return
  }
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.05
    window.speechSynthesis.speak(u)
  } catch {
    /* ignore */
  }
}

// Named haptics. Expo Go maps them to native feedback; browsers that support
// vibration get a short matching pattern; everything else stays still.
export const HAPTICS = {
  selection: 6,
  light: 10,
  tick: 12,
  medium: 18,
  heavy: 28,
  success: [14, 50, 24],
  warning: [30, 60, 30],
  celebrate: [16, 60, 16, 60, 34],
}
export function buzz(kind = 'light') {
  const style = HAPTICS[kind] ? kind : 'light'
  if (isNativeApp()) {
    void nativeRequest('haptics.buzz', { style }).catch(() => {})
    return
  }
  try {
    navigator.vibrate?.(HAPTICS[style])
  } catch {
    /* ignore */
  }
}

// A haptic that honors the Haptics setting.
export function feel(prefs, kind) {
  if (prefs?.vibrate !== false) buzz(kind)
}

// One place that respects the user's cue settings. Spoken cues are an
// accessibility option; haptics and short tones carry the default feel.
export function makeCoach(prefs) {
  return {
    tick() {
      if (prefs.sound) beep({ freq: 660, ms: 110 })
      if (prefs.vibrate) buzz('tick')
    },
    go(text) {
      if (prefs.sound) beep({ freq: 990, ms: 320, volume: 0.22 })
      if (prefs.vibrate) buzz('heavy')
      if (prefs.voice && text) say(text)
    },
    rest(text) {
      if (prefs.vibrate) buzz('medium')
      if (prefs.voice && text) say(text)
    },
    done(text) {
      if (prefs.sound) beep({ freq: 990, ms: 320, volume: 0.22 })
      if (prefs.vibrate) buzz('success')
      if (prefs.voice && text) say(text)
    },
    speak(text) {
      if (prefs.voice && text) say(text)
    },
  }
}

// Keep the screen awake while a workout is open.
export async function requestWakeLock() {
  try {
    if (isNativeApp()) {
      await nativeRequest('screen.keepAwake', { active: true })
      return { release: () => nativeRequest('screen.keepAwake', { active: false }) }
    }
    if (!('wakeLock' in navigator)) return null
    return await navigator.wakeLock.request('screen')
  } catch {
    return null
  }
}
