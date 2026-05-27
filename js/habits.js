import { supabase, getTable } from './supabase-client.js'
import { initAuth } from './auth.js'
import { getTodayDate, onDevTodayChange } from './dev-today.js'

const TABLE = getTable('habits_daily')
/** First day shown in the grid; earlier days stay grey. */
const TRACKING_START = '2026-05-26'
const HABIT_COUNT = 4

const HABITS = [
  { key: 'protein_shake', label: 'Eiwit shake' },
  { key: 'b12', label: 'B12 vitamine' },
  { key: 'magnesium', label: 'Magnesium vitamine' },
  { key: 'calve_exercises', label: 'Kuit oefeningen' },
]

let rowsByDate = new Map()
let todayKey = ''

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

function countCompleted(row) {
  if (!row) return 0
  return HABITS.filter(h => row[h.key]).length
}

function completionPercent(row) {
  const done = row ? countCompleted(row) : 0
  return Math.round((done / HABIT_COUNT) * 100)
}

function cellStyle(percent) {
  const hue = (percent / 100) * 120
  const color = `hsl(${hue}, 70%, 42%)`
  return {
    backgroundColor: color,
    color: '#fff',
  }
}

function rowToPayload(row) {
  const payload = { habit_date: todayKey }
  for (const h of HABITS) {
    payload[h.key] = Boolean(row?.[h.key])
  }
  return payload
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

function renderTodayCheckboxes() {
  const list = document.getElementById('habitChecklist')
  const row = getRowForDate(todayKey)
  list.innerHTML = ''

  for (const habit of HABITS) {
    const li = document.createElement('li')
    const id = `habit-${habit.key}`
    li.innerHTML = `
      <label for="${id}">
        <input type="checkbox" id="${id}" data-habit="${habit.key}" />
        ${habit.label}
      </label>
    `
    const input = li.querySelector('input')
    input.checked = Boolean(row?.[habit.key])
    input.addEventListener('change', onHabitToggle)
    list.appendChild(li)
  }

  const today = parseDateKey(todayKey)
  document.getElementById('todayLabel').textContent =
    `Vandaag — ${today.toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })}`
}

async function onHabitToggle() {
  const current = getRowForDate(todayKey) ?? { habit_date: todayKey }
  const payload = rowToPayload(current)

  for (const habit of HABITS) {
    const input = document.getElementById(`habit-${habit.key}`)
    payload[habit.key] = input.checked
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

  rowsByDate.set(todayKey, data)
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
  const pct = completionPercent(row)
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
  const rangeStart = TRACKING_START

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .gte('habit_date', rangeStart)
    .lte('habit_date', todayKey)
    .order('habit_date', { ascending: true })

  if (error) {
    console.error(error)
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
      await supabase.auth.signOut()
    }
    return
  }

  indexRows(data ?? [])
  renderTodayCheckboxes()
  renderGrid()
}

initAuth({ onAuthenticated: loadData })

onDevTodayChange(() => {
  const app = document.getElementById('appSection')
  if (app && !app.hidden) loadData()
})
