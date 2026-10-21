// Small unique-id helper (avoids pulling in a uuid dependency).
export function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  )
}
