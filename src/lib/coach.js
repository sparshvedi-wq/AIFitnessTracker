// Sound, voice and vibration cues for the workout player, plus a screen
// wake lock. Every call is best-effort: unsupported browsers just stay quiet.

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

export function buzz(pattern) {
  try { navigator.vibrate?.(pattern) } catch { /* ignore */ }
}

// One place that respects the user's cue settings.
export function makeCoach(prefs) {
  return {
    tick() {
      if (prefs.sound) beep({ freq: 660, ms: 110 })
      if (prefs.vibrate) buzz(40)
    },
    go(text) {
      if (prefs.sound) beep({ freq: 990, ms: 320, volume: 0.22 })
      if (prefs.vibrate) buzz([80, 60, 80])
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
    if (!('wakeLock' in navigator)) return null
    return await navigator.wakeLock.request('screen')
  } catch {
    return null
  }
}
