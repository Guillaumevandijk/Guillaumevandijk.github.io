import { isLocal } from './supabase-client.js'

const STORAGE_KEY = 'dev_today_override'
const listeners = new Set()

/** Real or pretended "today" (local calendar date). Only overridable on localhost. */
export function getTodayDate() {
  if (isLocal) {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) {
      const [y, m, d] = stored.split('-').map(Number)
      return new Date(y, m - 1, d)
    }
  }
  return new Date()
}

export function getDevTodayOverride() {
  if (!isLocal) return null
  const stored = sessionStorage.getItem(STORAGE_KEY)
  return stored && /^\d{4}-\d{2}-\d{2}$/.test(stored) ? stored : null
}

/** Re-run page loaders after devToday.set / devToday.clear */
export function onDevTodayChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify() {
  for (const fn of listeners) {
    fn()
  }
}

function installDevTodayConsole() {
  if (!isLocal || typeof window === 'undefined' || window.devToday) {
    return
  }

  window.devToday = {
    /** Pretend today is this day (YYYY-MM-DD), then refresh open pages. */
    set(dateKey) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        console.error('Use YYYY-MM-DD, e.g. devToday.set("2026-06-01")')
        return
      }
      sessionStorage.setItem(STORAGE_KEY, dateKey)
      console.info(`[dev] Pretend today is ${dateKey}`)
      notify()
    },
    /** Use the real calendar date again. */
    clear() {
      sessionStorage.removeItem(STORAGE_KEY)
      console.info('[dev] Using real today again')
      notify()
    },
    /** Current override, or null if using real today. */
    get() {
      return getDevTodayOverride()
    },
  }

  console.info(
    '[dev] Pretend another day (localhost only):\n' +
      '  devToday.set("2026-06-03")\n' +
      '  devToday.clear()\n' +
      '  devToday.get()'
  )
}

installDevTodayConsole()
