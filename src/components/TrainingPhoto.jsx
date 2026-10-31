import { useEffect, useState } from 'react'
import { editorialScene } from '../lib/editorial.js'
import morningGym from '../assets/editorial/morning-gym-v2.webp'
import morningCourt from '../assets/editorial/morning-court-v2.webp'
import dayHome from '../assets/editorial/day-home-v2.webp'
import dayGym from '../assets/editorial/day-gym-v2.webp'
import eveningGym from '../assets/editorial/evening-gym-v2.webp'
import eveningHome from '../assets/editorial/evening-home-v2.webp'

const scenes = {
  'morning-gym': morningGym,
  'morning-court': morningCourt,
  'day-home': dayHome,
  'day-gym': dayGym,
  'evening-gym': eveningGym,
  'evening-home': eveningHome,
}

const PLACE_SCENES = {
  home: ['day-home', 'evening-home'],
  gym: ['morning-gym', 'day-gym', 'evening-gym'],
}

// Decorative, AI-generated editorial photography; never a user's check-in
// or an exercise demonstration. Local assets need no generation at runtime.
export default function TrainingPhoto({ location = 'gym', sport = false, rotate = false, className = '' }) {
  const [scene, setScene] = useState(() => editorialScene())
  useEffect(() => {
    if (!rotate) return
    const refresh = () => setScene(editorialScene())
    const interval = setInterval(refresh, 30_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [rotate])
  // Rotating scenes still match where the session happens: no gym photo for a home workout.
  const fits = PLACE_SCENES[location]
  const key =
    fits && !fits.includes(scene.key) ? fits.find((k) => k.startsWith(scene.period)) || fits[0] : scene.key
  const src = rotate ? scenes[key] : sport ? morningCourt : location === 'gym' ? morningGym : dayHome
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      width="1080"
      height="360"
      loading="lazy"
      decoding="async"
      data-scene={rotate ? key : undefined}
      className={`block aspect-[3/1] w-full bg-surface2 object-cover ${className}`}
    />
  )
}
