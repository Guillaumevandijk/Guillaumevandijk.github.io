import { supabase, getTable } from './supabase-client.js'

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

export async function createHabit({ userId, name, kind, position, startsOn }) {
  return supabase
    .from(habitsTable())
    .insert({
      user_id: userId,
      name,
      kind,
      position,
      starts_on: startsOn,
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
