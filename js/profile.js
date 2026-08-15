import { supabase, getTable } from './supabase-client.js'

export const PAGES = [
  { key: 'weight', href: 'weight.html', label: 'Gewicht' },
  { key: 'run', href: 'run.html', label: 'Hardlopen' },
  { key: 'sport', href: 'sport.html', label: 'Sport' },
  { key: 'sleep', href: 'sleep.html', label: 'Slaap en gevoel' },
  { key: 'ai', href: 'ai.html', label: 'AI' },
  { key: 'habits', href: 'habits.html', label: 'Gewoontes' },
]

export const LONG_GOAL_KEYS = ['long_goal_1', 'long_goal_2', 'long_goal_3']
export const SHORT_GOAL_KEYS = ['short_goal_1', 'short_goal_2', 'short_goal_3']

const DEFAULT_PAGES = PAGES.map(page => page.key)
export const ALWAYS_VISIBLE = new Set(['home', 'settings'])

const ENABLED_PAGES_CACHE_KEY = 'enabled_pages'

export function getCachedEnabledPages() {
  try {
    const raw = sessionStorage.getItem(ENABLED_PAGES_CACHE_KEY)
    if (!raw) return null
    const pages = JSON.parse(raw)
    return Array.isArray(pages) ? pages : null
  } catch {
    return null
  }
}

function cacheEnabledPages(pages) {
  sessionStorage.setItem(ENABLED_PAGES_CACHE_KEY, JSON.stringify(pages))
}

export function clearEnabledPagesCache() {
  sessionStorage.removeItem(ENABLED_PAGES_CACHE_KEY)
}

function profilesTable() {
  return getTable('profiles')
}

export async function loadOrCreateProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from(profilesTable())
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error(error)
    return null
  }

  if (data) return data

  const { data: created, error: insertError } = await supabase
    .from(profilesTable())
    .insert({
      id: user.id,
      display_name: user.email?.split('@')[0] ?? null,
      enabled_pages: DEFAULT_PAGES,
      home_page: 'home',
    })
    .select()
    .single()

  if (insertError) {
    console.error(insertError)
    return null
  }

  return created
}

export async function saveProfile(updates) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Niet ingelogd') }

  const { data, error } = await supabase
    .from(profilesTable())
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select()
    .single()

  return { data, error }
}

export function applyNav(profile) {
  const enabledList = profile?.enabled_pages ?? getCachedEnabledPages() ?? DEFAULT_PAGES
  cacheEnabledPages(enabledList)
  const enabled = new Set(enabledList)

  document.querySelectorAll('.top-nav a[data-page]').forEach(link => {
    const key = link.dataset.page
    if (ALWAYS_VISIBLE.has(key)) return
    link.hidden = !enabled.has(key)
  })
}

export function redirectIfPageDisabled(profile) {
  if (!profile) return

  const current = document.body.dataset.page
  if (!current || ALWAYS_VISIBLE.has(current)) return

  const enabled = profile.enabled_pages ?? DEFAULT_PAGES
  if (enabled.includes(current)) return

  location.replace('index.html')
}
