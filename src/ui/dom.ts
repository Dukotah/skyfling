/** Tiny DOM helpers for the UI layer (no framework). */

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html) e.innerHTML = html
  return e
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

export function clampText(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export const uiRoot = (): HTMLElement => document.getElementById('ui')!

/** Pointer helper: fire on tap (pointerdown) and stop propagation so the canvas doesn't see it. */
export function onTap(e: HTMLElement, fn: (ev: PointerEvent) => void): void {
  e.addEventListener('pointerdown', (ev) => {
    ev.stopPropagation()
    fn(ev)
  })
}

/** Count-up number animation. */
export function countUp(e: HTMLElement, to: number, ms = 900, suffix = ''): void {
  const start = performance.now()
  const from = 0
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / ms)
    const k = 1 - Math.pow(1 - t, 3)
    e.textContent = fmt(from + (to - from) * k) + suffix
    if (t < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* iOS: unsupported */
  }
}
