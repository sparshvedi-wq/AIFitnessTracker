// Draws the "my week" story card (1080×1920, the Instagram/TikTok story size)
// on a canvas: the Tally wordmark, the week in tally marks, four stats and a
// line from the coach. Always dark, whatever the app theme, so it looks the
// same wherever it's posted.

const W = 1080
const H = 1920
const BG = '#08080A'
const PANEL = '#16161A'
const INK = '#F5F5F0'
const MUTED = '#8A8A84'
const VOLT = '#D6FF3D'

const DISPLAY = '"Big Shoulders Display", Impact, sans-serif'
const SANS = '"Instrument Sans", system-ui, sans-serif'
const SERIF = '"Instrument Serif", Georgia, serif'

async function fontsReady() {
  if (!document.fonts) return
  await Promise.all([
    document.fonts.load(`900 100px ${DISPLAY}`),
    document.fonts.load(`700 40px ${SANS}`),
    document.fonts.load(`italic 60px ${SERIF}`),
  ]).catch(() => {})
}

function stroke(ctx, x1, y1, x2, y2, width, color) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.strokeStyle = color
  ctx.stroke()
}

// Tally marks, left-aligned at (x, y) with the given stroke height.
function drawTally(ctx, x, y, count, goal, h) {
  const total = Math.max(count, goal, 1)
  const sw = h / 9
  const gap = h * 0.3
  let cx = x
  for (let g = 0; g * 5 < total; g++) {
    const inGroup = Math.min(5, total - g * 5)
    const verticals = Math.min(4, inGroup)
    for (let i = 0; i < verticals; i++) {
      const n = g * 5 + i
      const lean = (((n * 7) % 5) - 2) * 2
      stroke(ctx, cx + i * gap + lean, y, cx + i * gap - lean, y + h, sw, n < count ? INK : 'rgba(245,245,240,0.14)')
    }
    const width = (verticals - 1) * gap
    if (inGroup === 5) {
      stroke(ctx, cx - gap * 0.4, y + h * 0.72, cx + width + gap * 0.4, y + h * 0.28, sw * 1.2, g * 5 + 4 < count ? VOLT : 'rgba(245,245,240,0.14)')
    }
    cx += width + gap * 1.8
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// stats: [{ label, value, unit }] (four of them)
export async function drawWeekCard({ weekLabel, count, goal, stats, line }) {
  await fontsReady()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  // Volt glow behind the count
  const glow = ctx.createRadialGradient(W * 0.75, 640, 40, W * 0.75, 640, 620)
  glow.addColorStop(0, 'rgba(214,255,61,0.20)')
  glow.addColorStop(1, 'rgba(214,255,61,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  const pad = 96

  // Wordmark
  for (let i = 0; i < 4; i++) stroke(ctx, pad + 6 + i * 17, 112, pad + 6 + i * 17, 172, 9, INK)
  stroke(ctx, pad - 6, 158, pad + 70, 124, 11, VOLT)
  ctx.fillStyle = INK
  ctx.font = `900 72px ${DISPLAY}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('TALLY', pad + 96, 170)

  ctx.fillStyle = MUTED
  ctx.font = `700 30px ${SANS}`
  ctx.textAlign = 'right'
  ctx.fillText(weekLabel.toUpperCase(), W - pad, 162)
  ctx.textAlign = 'left'

  // Headline count
  ctx.fillStyle = MUTED
  ctx.font = `700 34px ${SANS}`
  ctx.fillText('WORKOUTS THIS WEEK', pad, 380)
  ctx.fillStyle = INK
  ctx.font = `900 440px ${DISPLAY}`
  ctx.fillText(String(count), pad - 12, 790)
  const numW = ctx.measureText(String(count)).width
  if (goal) {
    ctx.fillStyle = MUTED
    ctx.font = `900 150px ${DISPLAY}`
    ctx.fillText(`/${goal}`, pad + numW, 790)
  }

  drawTally(ctx, pad + 10, 870, count, goal, 150)

  // Coach line
  ctx.fillStyle = INK
  ctx.font = `italic 64px ${SERIF}`
  const words = line.split(' ')
  let row = ''
  let y = 1150
  for (const w of words) {
    const test = row ? `${row} ${w}` : w
    if (ctx.measureText(test).width > W - pad * 2 && row) {
      ctx.fillText(row, pad, y)
      row = w
      y += 76
    } else row = test
  }
  ctx.fillText(row, pad, y)

  // Stat panels, two by two
  const top = 1330
  const gw = (W - pad * 2 - 28) / 2
  const gh = 210
  stats.slice(0, 4).forEach((s, i) => {
    const x = pad + (i % 2) * (gw + 28)
    const yy = top + Math.floor(i / 2) * (gh + 28)
    ctx.fillStyle = PANEL
    roundRect(ctx, x, yy, gw, gh, 36)
    ctx.fill()
    ctx.fillStyle = MUTED
    ctx.font = `700 26px ${SANS}`
    ctx.fillText(s.label.toUpperCase(), x + 40, yy + 66)
    ctx.fillStyle = i === 0 ? VOLT : INK
    ctx.font = `900 104px ${DISPLAY}`
    ctx.fillText(String(s.value), x + 36, yy + 170)
    if (s.unit) {
      const vw = ctx.measureText(String(s.value)).width
      ctx.fillStyle = MUTED
      ctx.font = `700 30px ${SANS}`
      ctx.fillText(s.unit, x + 48 + vw, yy + 168)
    }
  })

  ctx.fillStyle = MUTED
  ctx.font = `700 28px ${SANS}`
  ctx.textAlign = 'center'
  ctx.fillText('MAKE IT COUNT', W / 2, H - 80)
  ctx.textAlign = 'left'

  return canvas
}

// Share the card through the phone's share sheet, or download it.
export async function shareCanvas(canvas, filename = 'tally-week.png') {
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My week on Tally' })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
