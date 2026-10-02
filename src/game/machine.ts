/**
 * Game state machine (ARCHITECTURE §5): boot → hangar → aim → fly → results → hangar,
 * plus a paused overlay and the evolve interstitial. Hash routes mirror states
 * for debugging (#aim, #results?dist=1200, #debug/...).
 */

import { events } from './events'

export type StateName = 'boot' | 'hangar' | 'aim' | 'fly' | 'results' | 'evolve' | 'debug'

export interface StateHandlers<Ctx> {
  enter?(ctx: Ctx, params: URLSearchParams): void
  update?(ctx: Ctx, dt: number): void
  exit?(ctx: Ctx): void
}

export class Machine<Ctx> {
  private states = new Map<StateName, StateHandlers<Ctx>>()
  private _current: StateName | null = null
  private _paused = false
  private _params = new URLSearchParams()

  constructor(private ctx: Ctx) {}

  get current(): StateName | null {
    return this._current
  }

  get paused(): boolean {
    return this._paused
  }

  get params(): URLSearchParams {
    return this._params
  }

  define(name: StateName, handlers: StateHandlers<Ctx>): this {
    this.states.set(name, handlers)
    return this
  }

  go(name: StateName, params: Record<string, string> | URLSearchParams = {}): void {
    if (this._current === name) return
    const prev = this._current
    if (prev) this.states.get(prev)?.exit?.(this.ctx)
    this._current = name
    this._paused = false
    this._params = params instanceof URLSearchParams ? params : new URLSearchParams(params)
    this.states.get(name)?.enter?.(this.ctx, this._params)
    events.emit('state:enter', { state: name })
  }

  pause(on: boolean): void {
    this._paused = on
  }

  update(dt: number): void {
    if (this._paused || !this._current) return
    this.states.get(this._current)?.update?.(this.ctx, dt)
  }
}

/** Parse the location hash into a route + params. `#debug/fly?biome=x` → { route: 'debug/fly', params }. */
export function parseHash(hash: string): { route: string; params: URLSearchParams } {
  const h = hash.replace(/^#/, '')
  const [route, query = ''] = h.split('?')
  return { route, params: new URLSearchParams(query) }
}
