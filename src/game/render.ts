import type { GameState, Vec2, Warlock } from './types'
import { clamp } from './math'

export interface View {
  w: number
  h: number
  cx: number
  cy: number
  scale: number
}

// Static molten blobs for the lava backdrop (seeded once).
const BLOBS = Array.from({ length: 7 }, (_, i) => ({
  x: Math.cos(i * 2.3) * 0.7,
  y: Math.sin(i * 1.7) * 0.7,
  r: 0.25 + (i % 3) * 0.12,
  phase: i * 1.3,
}))

export function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  view: View,
  mouseWorld: Vec2,
  time: number,
): void {
  const { w, h, cx, cy, scale } = view
  const sx = (x: number) => cx + x * scale
  const sy = (y: number) => cy + y * scale
  const sr = (r: number) => r * scale

  drawLava(ctx, w, h, time)

  const ar = state.arenaRadius * scale
  drawPlatform(ctx, cx, cy, ar, time)

  // player aim line
  const player = state.warlocks.find((p) => p.isPlayer)
  if (player && player.alive && state.phase !== 'matchover') {
    drawAim(ctx, sx(player.pos.x), sy(player.pos.y), sx(mouseWorld.x), sy(mouseWorld.y), player.color)
  }

  // particles
  for (const p of state.particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1)
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(sx(p.pos.x), sy(p.pos.y), Math.max(1, sr(p.size)), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // projectiles (trail + glowing head)
  for (const pr of state.projectiles) {
    ctx.strokeStyle = pr.color
    ctx.lineWidth = Math.max(1, sr(pr.radius * 1.3))
    ctx.lineCap = 'round'
    ctx.globalAlpha = 0.45
    ctx.beginPath()
    pr.trail.forEach((t, i) => {
      const X = sx(t.x)
      const Y = sy(t.y)
      if (i === 0) ctx.moveTo(X, Y)
      else ctx.lineTo(X, Y)
    })
    ctx.stroke()
    ctx.globalAlpha = 1
    glowDot(ctx, sx(pr.pos.x), sy(pr.pos.y), sr(pr.radius), pr.color)
  }

  // warlocks
  for (const wl of state.warlocks) {
    if (!wl.alive) continue
    drawWarlock(ctx, wl, sx(wl.pos.x), sy(wl.pos.y), sr(wl.radius))
  }
}

function drawLava(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  ctx.fillStyle = '#190a07'
  ctx.fillRect(0, 0, w, h)
  const cx = w / 2
  const cy = h / 2
  const unit = Math.min(w, h)
  for (const b of BLOBS) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 1.2 + b.phase)
    const x = cx + b.x * unit * 0.55 + Math.sin(time * 0.5 + b.phase) * 14
    const y = cy + b.y * unit * 0.55 + Math.cos(time * 0.4 + b.phase) * 14
    const r = b.r * unit * (0.8 + pulse * 0.3)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255,150,40,${0.18 + pulse * 0.14})`)
    g.addColorStop(0.5, 'rgba(220,70,20,0.10)')
    g.addColorStop(1, 'rgba(120,20,10,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  ar: number,
  time: number,
): void {
  // molten halo where lava meets the rim
  const halo = ctx.createRadialGradient(cx, cy, ar * 0.88, cx, cy, ar * 1.3)
  halo.addColorStop(0, 'rgba(255,140,40,0)')
  halo.addColorStop(0.45, 'rgba(255,120,30,0.55)')
  halo.addColorStop(1, 'rgba(255,80,20,0)')
  ctx.fillStyle = halo
  ctx.beginPath()
  ctx.arc(cx, cy, ar * 1.3, 0, Math.PI * 2)
  ctx.fill()

  // stone disk
  const disk = ctx.createRadialGradient(cx, cy, ar * 0.1, cx, cy, ar)
  disk.addColorStop(0, '#454b54')
  disk.addColorStop(0.7, '#343941')
  disk.addColorStop(1, '#252930')
  ctx.fillStyle = disk
  ctx.beginPath()
  ctx.arc(cx, cy, ar, 0, Math.PI * 2)
  ctx.fill()

  // concentric detail rings
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 1
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath()
    ctx.arc(cx, cy, (ar * i) / 4, 0, Math.PI * 2)
    ctx.stroke()
  }

  // hot glowing rim (pulses)
  const pulse = 0.6 + 0.4 * Math.sin(time * 3)
  ctx.strokeStyle = `rgba(255,${120 + pulse * 60},40,${0.7 + pulse * 0.3})`
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(cx, cy, ar, 0, Math.PI * 2)
  ctx.stroke()
}

function drawAim(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.25
  ctx.lineWidth = 2
  ctx.setLineDash([6, 8])
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  ctx.restore()
}

function drawWarlock(
  ctx: CanvasRenderingContext2D,
  wl: Warlock,
  x: number,
  y: number,
  r: number,
): void {
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.ellipse(x, y + r * 0.85, r * 0.95, r * 0.4, 0, 0, Math.PI * 2)
  ctx.fill()

  // glow
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2)
  glow.addColorStop(0, hexA(wl.color, wl.isPlayer ? 0.45 : 0.3))
  glow.addColorStop(1, hexA(wl.color, 0))
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.arc(x, y, r * 2, 0, Math.PI * 2)
  ctx.fill()

  // body
  ctx.fillStyle = wl.color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = wl.isPlayer ? 3 : 2
  ctx.strokeStyle = wl.isPlayer ? '#ffffff' : 'rgba(0,0,0,0.45)'
  ctx.stroke()

  // facing wand
  const fx = x + Math.cos(wl.facing) * r * 1.6
  const fy = y + Math.sin(wl.facing) * r * 1.6
  ctx.strokeStyle = '#f5f5f5'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x + Math.cos(wl.facing) * r * 0.5, y + Math.sin(wl.facing) * r * 0.5)
  ctx.lineTo(fx, fy)
  ctx.stroke()

  // safe-spawn shield
  if (wl.safeTime > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(x, y, r * 1.5, 0, Math.PI * 2)
    ctx.stroke()
  }

  // hp bar
  const bw = r * 2.6
  const bh = 5
  const bx = x - bw / 2
  const by = y - r - 14
  const pct = clamp(wl.hp / wl.maxHp, 0, 1)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2)
  ctx.fillStyle = pct > 0.5 ? '#5ad65a' : pct > 0.25 ? '#ffd24a' : '#ff5a5a'
  ctx.fillRect(bx, by, bw * pct, bh)

  // name
  ctx.fillStyle = wl.isPlayer ? '#ffffff' : 'rgba(255,255,255,0.75)'
  ctx.font = '600 12px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(wl.name, x, by - 5)
}

function glowDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.4, color)
  g.addColorStop(1, hexA(color, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r * 2.4, 0, Math.PI * 2)
  ctx.fill()
}

// "#rrggbb" + alpha -> rgba()
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${a})`
}
