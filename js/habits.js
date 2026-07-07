import { supabase, getTable } from './supabase-client.js'
import { initAuth } from './auth.js'
import { getTodayDate, onDevTodayChange } from './dev-today.js'

const TABLE = getTable('habits_daily')
const RUN_TABLE = getTable('run_stats')
/** First day shown in the grid; earlier days stay grey. */
const TRACKING_START = '2026-05-27'
/**
 * First day with 5 habits (incl. creatine). Days before this count as 4 habits
 * unless habit_number is already set on the row in Supabase.
 */
const HABITS_EXPAND_DATE = '2026-05-28'

const CORE_HABITS = [
  { key: 'protein_shake', label: 'Eiwit shake' },
  { key: 'b12', label: 'B12 vitamine' },
  { key: 'magnesium', label: 'Magnesium' },
  { key: 'calve_exercises', label: 'Kuit oefeningen' },
]

const CREATINE_HABIT = { key: 'creatine', label: 'Creatine' }

let rowsByDate = new Map()
/** Dates where kuit oefeningen is waived (run day + day after each run). */
let calveWaivedDates = new Set()
let todayKey = ''
let yesterdayKey = ''
let editingYesterday = false

function toLocalDateKey(value) {
  const d = value instanceof Date ? value : new Date(value)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDaysToKey(dateKey, days) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + days)
  return toLocalDateKey(date)
}

/** Monday of the week containing dateKey (local). */
function mondayOfWeek(dateKey) {
  const date = parseDateKey(dateKey)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return toLocalDateKey(date)
}

/** ISO week number (1–53). */
function isoWeekNumber(dateKey) {
  const date = parseDateKey(dateKey)
  const thursday = new Date(date)
  thursday.setDate(date.getDate() + (4 - (date.getDay() || 7)))
  const yearStart = new Date(thursday.getFullYear(), 0, 1)
  return Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7)
}

function getHabitCountForDate(dateKey, row = null) {
  if (row?.habit_number != null && row.habit_number !== '') {
    return Number(row.habit_number)
  }
  return dateKey >= HABITS_EXPAND_DATE ? 5 : 4
}

function getHabitsForDate(dateKey, row = null) {
  const habits = [...CORE_HABITS]
  if (getHabitCountForDate(dateKey, row) >= 5) {
    habits.push(CREATINE_HABIT)
  }
  return habits
}

function isCalveWaived(dateKey) {
  return calveWaivedDates.has(dateKey)
}

function buildCalveWaivedDates(runRows) {
  const waived = new Set()
  const runDates = new Set()

  for (const row of runRows) {
    runDates.add(toLocalDateKey(row.created_at))
  }

  for (const dateKey of runDates) {
    waived.add(dateKey)
    waived.add(addDaysToKey(dateKey, 1))
  }

  return waived
}

function getActiveHabitsForDate(dateKey, row = null) {
  return getHabitsForDate(dateKey, row).filter(
    h => !(h.key === 'calve_exercises' && isCalveWaived(dateKey))
  )
}

function countCompleted(row, dateKey) {
  return getActiveHabitsForDate(dateKey, row).filter(h => row?.[h.key]).length
}

function completionPercent(row, dateKey) {
  const total = getActiveHabitsForDate(dateKey, row).length
  if (total === 0) return 0
  const done = countCompleted(row, dateKey)
  return Math.round((done / total) * 100)
}

function cellStyle(percent) {
  const hue = (percent / 100) * 120
  const color = `hsl(${hue}, 70%, 42%)`
  return {
    backgroundColor: color,
    color: '#fff',
  }
}

function rowToPayload(dateKey, row) {
  const habits = getHabitsForDate(dateKey, row)
  const habitNumber = getHabitCountForDate(dateKey, row)

  const payload = {
    habit_date: dateKey,
    habit_number: habitNumber,
    protein_shake: false,
    b12: false,
    magnesium: false,
    calve_exercises: false,
    creatine: false,
  }

  for (const h of habits) {
    payload[h.key] = Boolean(row?.[h.key])
  }

  return payload
}

function activeEditDateKey() {
  return editingYesterday ? yesterdayKey : todayKey
}

function canEditYesterday() {
  return yesterdayKey >= TRACKING_START
}

function normalizeHabitDate(value) {
  if (typeof value === 'string' && value.length >= 10) {
    return value.slice(0, 10)
  }
  return toLocalDateKey(value)
}

function getRowForDate(dateKey) {
  return rowsByDate.get(dateKey) ?? null
}

function formatDayLabel(dateKey, prefix) {
  const date = parseDateKey(dateKey)
  const formatted = date.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return `${prefix} — ${formatted}`
}

function renderYesterdayToggle() {
  const btn = document.getElementById('yesterdayToggle')
  if (!btn) return

  if (!canEditYesterday()) {
    btn.hidden = true
    editingYesterday = false
    return
  }

  btn.hidden = false
  btn.setAttribute('aria-pressed', String(editingYesterday))
  btn.classList.toggle('yesterday-toggle--active', editingYesterday)
}

function renderCheckboxes() {
  const dateKey = activeEditDateKey()
  const list = document.getElementById('habitChecklist')
  const row = getRowForDate(dateKey)
  const habits = getHabitsForDate(dateKey, row)
  list.innerHTML = ''

  for (const habit of habits) {
    const li = document.createElement('li')
    const id = `habit-${habit.key}`
    li.innerHTML = `
      <label for="${id}">
        <input type="checkbox" id="${id}" data-habit="${habit.key}" />
        ${habit.label}
      </label>
    `
    const input = li.querySelector('input')
    const label = li.querySelector('label')
    const waived = habit.key === 'calve_exercises' && isCalveWaived(dateKey)

    input.checked = Boolean(row?.[habit.key])
    if (waived) {
      label.classList.add('habit-waived')
      input.disabled = true
      label.title = 'Vrijgesteld door hardlopen'
    } else {
      input.addEventListener('change', onHabitToggle)
    }
    list.appendChild(li)
  }

  const label = document.getElementById('todayLabel')
  if (editingYesterday) {
    label.textContent = formatDayLabel(dateKey, 'Gisteren')
  } else {
    label.textContent = formatDayLabel(todayKey, 'Vandaag')
  }

  renderYesterdayToggle()
}

function onYesterdayToggleClick() {
  if (!canEditYesterday()) return
  editingYesterday = !editingYesterday
  renderCheckboxes()
}

async function onHabitToggle() {
  const dateKey = activeEditDateKey()
  const current = getRowForDate(dateKey) ?? { habit_date: dateKey }
  const payload = rowToPayload(dateKey, current)
  const habits = getHabitsForDate(dateKey, current)

  for (const habit of habits) {
    if (habit.key === 'calve_exercises' && isCalveWaived(dateKey)) continue
    const input = document.getElementById(`habit-${habit.key}`)
    if (input) payload[habit.key] = input.checked
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'habit_date' })
    .select()
    .single()

  if (error) {
    console.error(error)
    alert('Kon niet opslaan. Ben je ingelogd?')
    await loadData()
    return
  }

  rowsByDate.set(dateKey, data)
  renderGrid()
}

function setGreyCell(td) {
  td.className = 'habits-cell habits-cell--inactive'
  td.textContent = ''
  td.style.backgroundColor = ''
  td.style.color = ''
}

function setPercentCell(td, dateKey) {
  const row = getRowForDate(dateKey)
  const pct = completionPercent(row, dateKey)
  const style = cellStyle(pct)
  td.className = 'habits-cell'
  td.textContent = `${pct}%`
  td.style.backgroundColor = style.backgroundColor
  td.style.color = style.color
  if (dateKey === todayKey) {
    td.classList.add('habits-cell--today')
  }
}

function isInTrackingRange(dateKey) {
  return dateKey >= TRACKING_START && dateKey <= todayKey
}

function renderGrid() {
  const tbody = document.getElementById('habitsGridBody')
  tbody.innerHTML = ''

  const trackingStartMonday = mondayOfWeek(TRACKING_START)
  const currentMonday = mondayOfWeek(todayKey)
  const weekMondays = []

  for (let monday = currentMonday; monday >= trackingStartMonday; monday = addDaysToKey(monday, -7)) {
    weekMondays.push(monday)
  }

  for (const mondayKey of weekMondays) {
    const tr = document.createElement('tr')
    const weekNum = isoWeekNumber(mondayKey)
    tr.innerHTML = `<th scope="row">W${weekNum}</th>`

    for (let d = 0; d < 7; d++) {
      const dateKey = addDaysToKey(mondayKey, d)
      const td = document.createElement('td')

      if (!isInTrackingRange(dateKey)) {
        setGreyCell(td)
      } else {
        setPercentCell(td, dateKey)
      }

      tr.appendChild(td)
    }

    tbody.appendChild(tr)
  }
}

function indexRows(data) {
  rowsByDate = new Map()
  for (const row of data) {
    rowsByDate.set(normalizeHabitDate(row.habit_date), row)
  }
}

async function loadData() {
  todayKey = toLocalDateKey(getTodayDate())
  yesterdayKey = addDaysToKey(todayKey, -1)
  if (editingYesterday && !canEditYesterday()) {
    editingYesterday = false
  }
  const rangeStart = TRACKING_START

  const [habitsResult, runsResult] = await Promise.all([
    supabase
      .from(TABLE)
      .select('*')
      .gte('habit_date', rangeStart)
      .lte('habit_date', todayKey)
      .order('habit_date', { ascending: true }),
    supabase
      .from(RUN_TABLE)
      .select('created_at'),
  ])

  if (habitsResult.error) {
    console.error(habitsResult.error)
    if (habitsResult.error.code === 'PGRST301' || habitsResult.error.message?.includes('JWT')) {
      await supabase.auth.signOut()
    }
    return
  }

  if (runsResult.error) {
    console.error(runsResult.error)
  } else {
    calveWaivedDates = buildCalveWaivedDates(runsResult.data ?? [])
  }

  indexRows(habitsResult.data ?? [])
  renderCheckboxes()
  renderGrid()
}

const yesterdayToggleBtn = document.getElementById('yesterdayToggle')
if (yesterdayToggleBtn) {
  yesterdayToggleBtn.addEventListener('click', onYesterdayToggleClick)
}

initAuth({ onAuthenticated: loadData })

onDevTodayChange(() => {
  const app = document.getElementById('appSection')
  if (app && !app.hidden) loadData()
})
