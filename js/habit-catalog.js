import { supabase, getTable } from './supabase-client.js'

export const HABIT_PAGES = [
  { key: 'voeding', label: 'Voeding' },
  { key: 'sport', label: 'Beweging' },
  { key: 'sleep', label: 'Slaap' },
]

export const FOOD_MACRO_HABITS = [
  { name: 'Eiwitten', position: 0 },
  { name: 'Vetten', position: 1 },
  { name: 'Koolhydraten', position: 2 },
  { name: 'Vochtintake', position: 3 },
]

export const NUTRITION_FIELDS = [
  { key: 'calories', label: 'Calorie intake', suffix: 'kCal/dag', prefix: '±' },
  { key: 'protein', label: 'Eiwitten', suffix: ' g/dag', prefix: '±' },
  { key: 'fat', label: 'Vetten', suffix: ' g/dag', prefix: '±' },
  { key: 'carbs', label: 'Koolhydraten', suffix: ' g/dag', prefix: '±' },
  { key: 'fiber', label: 'Vezels', suffix: ' g/dag', prefix: '±' },
  { key: 'water', label: 'Vochtintake', suffix: 'L', prefix: '' },
  { key: 'supplements', label: 'Supplementen' },
  { key: 'whey', label: 'Whey proteine' },
]

export function habitsTable() {
  return getTable('habits')
}

export function logsTable() {
  return getTable('habit_logs')
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

export function isHabitActiveOn(habit, dateKey) {
  const start = dateOnly(habit.starts_on)
  const end = dateOnly(habit.ends_on)
  if (start && dateKey < start) return false
  if (end && dateKey >= end) return false
  return true
}

export function isSkipAfterRun(habit) {
  return habit.kind === 'skip_after_run'
}

export async function loadHabits() {
  const { data, error } = await supabase
    .from(habitsTable())
    .select('*')
    .order('position', { ascending: true })
    .order('starts_on', { ascending: true })

  if (error) return { data: [], error }
  return { data: data ?? [], error: null }
}

export async function loadLogs() {
  const { data, error } = await supabase
    .from(logsTable())
    .select('*')
    .order('habit_date', { ascending: true })

  if (error) return { data: [], error }
  return { data: data ?? [], error: null }
}

export async function upsertLog({ userId, habitId, habitDate, done }) {
  return supabase
    .from(logsTable())
    .upsert(
      { user_id: userId, habit_id: habitId, habit_date: habitDate, done },
      { onConflict: 'habit_id,habit_date' }
    )
    .select()
    .single()
}

export async function createHabit({ userId, name, kind, position, startsOn, page, mandatory = false }) {
  return supabase
    .from(habitsTable())
    .insert({
      user_id: userId,
      name,
      kind,
      position,
      starts_on: startsOn,
      page,
      mandatory,
    })
    .select()
    .single()
}

export async function updateHabit(id, updates) {
  return supabase
    .from(habitsTable())
    .update(updates)
    .eq('id', id)
    .select()
    .single()
}

export async function deleteHabit(id) {
  return supabase
    .from(habitsTable())
    .delete()
    .eq('id', id)
}

export async function ensureFoodHabits(userId) {
  const loaded = await loadHabits()
  if (loaded.error) return loaded

  const existing = loaded.data.filter(habit =>
    habit.page === 'voeding'
    && habit.mandatory
    && (!habit.ends_on || dateOnly(habit.ends_on) > dateOnly(new Date()))
  )
  const missing = FOOD_MACRO_HABITS.filter(def =>
    !existing.some(habit => habit.name.trim().toLowerCase() === def.name.toLowerCase())
  )
  if (missing.length === 0) return loaded

  const { error } = await supabase
    .from(habitsTable())
    .insert(missing.map(def => ({
      user_id: userId,
      name: def.name,
      position: def.position,
      kind: 'normal',
      page: 'voeding',
      mandatory: true,
      starts_on: dateOnly(new Date()),
    })))

  if (error) return { data: loaded.data, error }
  return loadHabits()
}
