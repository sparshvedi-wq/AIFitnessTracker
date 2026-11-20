import { useState } from 'react'
import Icon from '../Icon.jsx'
import { GuideAvatar } from './SetupVisuals.jsx'
import { noteFocusSuggestions } from '../../lib/profile-notes.js'
export default function ProfileNotes({ value, onChange }) {
  const [saved, setSaved] = useState(false)
  const suggestions = noteFocusSuggestions(value.notes).filter((a) => !value.focusAreas.includes(a))
  return (
    <section className="profile-notes" aria-label="Profile notes">
      <div className="flex items-center gap-3">
        <GuideAvatar size={38} />
        <h4 className="text-[17px] font-semibold">Anything else?</h4>
      </div>
      <label className="sr-only" htmlFor="profile-note">
        Tell M1 about your starting point
      </label>
      <textarea
        id="profile-note"
        className="input mt-3 min-h-24 resize-none"
        maxLength={600}
        value={value.notes || ''}
        placeholder="My shoulders look a little uneven…"
        onChange={(e) => {
          setSaved(false)
          onChange({ ...value, notes: e.target.value })
        }}
      />
      <div className="mt-2 flex items-center justify-end gap-3">
        <button
          type="button"
          className="icon-btn"
          aria-label="Save profile note"
          disabled={!value.notes?.trim()}
          onClick={() => setSaved(true)}
        >
          <Icon name={saved ? 'check' : 'arrowRight'} size={20} />
        </button>
      </div>
      {saved && suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((area) => (
            <button
              key={area}
              type="button"
              className="chip"
              onClick={() => onChange({ ...value, focusAreas: [...value.focusAreas, area] })}
            >
              Add {area} focus
              <Icon name="plus" size={13} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
