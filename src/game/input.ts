import type { SpellId, Vec2 } from './types'

const KEY_SPELL: Record<string, SpellId> = {
  q: 'bolt',
  w: 'burst',
  e: 'blink',
}

/** Mouse + keyboard for the local player. Move with any mouse button, cast with Q/W/E. */
export class Input {
  readonly el: HTMLCanvasElement
  mouse: Vec2 = { x: 0, y: 0 }
  moveDown = false
  private casts: SpellId[] = []

  constructor(el: HTMLCanvasElement) {
    this.el = el
    el.addEventListener('mousemove', this.onMove)
    el.addEventListener('mousedown', this.onDown)
    window.addEventListener('mouseup', this.onUp)
    el.addEventListener('contextmenu', this.onContext)
    window.addEventListener('keydown', this.onKey)
  }

  detach(): void {
    this.el.removeEventListener('mousemove', this.onMove)
    this.el.removeEventListener('mousedown', this.onDown)
    window.removeEventListener('mouseup', this.onUp)
    this.el.removeEventListener('contextmenu', this.onContext)
    window.removeEventListener('keydown', this.onKey)
  }

  consumeCasts(): SpellId[] {
    const c = this.casts
    this.casts = []
    return c
  }

  private setMouse(e: MouseEvent): void {
    const r = this.el.getBoundingClientRect()
    this.mouse.x = e.clientX - r.left
    this.mouse.y = e.clientY - r.top
  }

  private onMove = (e: MouseEvent): void => {
    this.setMouse(e)
  }

  private onDown = (e: MouseEvent): void => {
    this.setMouse(e)
    this.moveDown = true
  }

  private onUp = (): void => {
    this.moveDown = false
  }

  private onContext = (e: MouseEvent): void => {
    e.preventDefault()
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.repeat) return
    const id = KEY_SPELL[e.key.toLowerCase()]
    if (id) this.casts.push(id)
  }
}
