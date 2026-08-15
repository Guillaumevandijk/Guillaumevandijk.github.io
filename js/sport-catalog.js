import { supabase, getTable } from './supabase-client.js'

export const SPORT_COLORS = [
  '#ea580c',
  '#16a34a',
  '#7c3aed',
  '#e11d48',
  '#0d9488',
  '#ca8a04',
]

export const DEFAULT_SPORTS = [
  { name: 'Boxen', color: '#ea580c' },
  { name: 'Gym', color: '#7c3aed' },
  { name: 'Hardlopen', color: '#16a34a' },
]

export function typesTable() {
  return getTable('sport_types')
}

export function sessionsTable() {
  return getTable('sport_sessions')
}

export function dateOnly(value) {
  if (value == null) return null
  if (typeof value === 'string' && value.length >= 10) return value.slice(0, 10)
  const d = value instanceof Date ? value : new Date(value)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function loadSportTypes() {
  const { data, error } = await supabase
    .from(typesTable())
    .select('*')
    .order('position', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { data: [], error }
  return { data: data ?? [], error: null }
}

export async function ensureDefaultSports(userId) {
  const loaded = await loadSportTypes()
  if (loaded.error) return loaded
  if (loaded.data.length > 0) return loaded

  const rows = DEFAULT_SPORTS.map((sport, index) => ({
    user_id: userId,
    name: sport.name,
    color: sport.color,
    position: index,
  }))

  const { error } = await supabase
    .from(typesTable())
    .insert(rows)

  if (error) return { data: [], error }
  return loadSportTypes()
}

export async function createSportType({ userId, name, color, position }) {
  return supabase
    .from(typesTable())
    .insert({
      user_id: userId,
      name,
      color,
      position,
    })
    .select()
    .single()
}

export async function updateSportType(id, updates) {
  return supabase
    .from(typesTable())
    .update(updates)
    .eq('id', id)
    .select()
    .single()
}

export async function deleteSportType(id) {
  return supabase
    .from(typesTable())
    .delete()
    .eq('id', id)
}

export async function loadSportSessions() {
  const { data, error } = await supabase
    .from(sessionsTable())
    .select('*')
    .order('session_date', { ascending: true })

  if (error) return { data: [], error }
  return { data: data ?? [], error: null }
}

export async function createSportSession({ userId, sportTypeId, sessionDate, status = 'planned' }) {
  return supabase
    .from(sessionsTable())
    .insert({
      user_id: userId,
      sport_type_id: sportTypeId,
      session_date: sessionDate,
      status,
    })
    .select()
    .single()
}

export async function updateSportSession(id, updates) {
  return supabase
    .from(sessionsTable())
    .update(updates)
    .eq('id', id)
    .select()
    .single()
}

export async function deleteSportSession(id) {
  return supabase
    .from(sessionsTable())
    .delete()
    .eq('id', id)
}

export async function deletePlannedSessionsInRange(startDate, endDate) {
  return supabase
    .from(sessionsTable())
    .delete()
    .eq('status', 'planned')
    .gte('session_date', startDate)
    .lte('session_date', endDate)
}

function templatesTable() {
  return getTable('sport_templates')
}

function templateItemsTable() {
  return getTable('sport_template_items')
}

export async function loadSportTemplates() {
  const { data: templates, error } = await supabase
    .from(templatesTable())
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return { data: [], error }
  if (!templates?.length) return { data: [], error: null }

  const { data: items, error: itemsError } = await supabase
    .from(templateItemsTable())
    .select('*')
    .in('template_id', templates.map(template => template.id))

  if (itemsError) return { data: [], error: itemsError }

  const byTemplate = new Map()
  for (const item of items ?? []) {
    const list = byTemplate.get(item.template_id) ?? []
    list.push(item)
    byTemplate.set(item.template_id, list)
  }

  return {
    data: templates.map(template => ({
      ...template,
      items: byTemplate.get(template.id) ?? [],
    })),
    error: null,
  }
}

export async function createSportTemplate({ userId, name, items }) {
  const { data: template, error } = await supabase
    .from(templatesTable())
    .insert({ user_id: userId, name })
    .select()
    .single()

  if (error) return { data: null, error }

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from(templateItemsTable())
      .insert(items.map(item => ({
        template_id: template.id,
        weekday: item.weekday,
        sport_type_id: item.sportTypeId,
      })))

    if (itemsError) return { data: null, error: itemsError }
  }

  return { data: template, error: null }
}

export async function deleteSportTemplate(id) {
  return supabase
    .from(templatesTable())
    .delete()
    .eq('id', id)
}
