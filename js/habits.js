import { supabase, getTable } from './supabase-client.js'
import { initAuth } from './auth.js'
import { getTodayDate, onDevTodayChange } from './dev-today.js'
import {
  dateOnly,
  isHabitActiveOn,
  isSkipAfterRun,
  loadHabits,
  loadLogs,
  upsertLog,
} from './habit-catalog.js'

const RUN_TABLE = getTable('run_stats')

let habitDefs = []
/** dateKey -> Map(habitId -> done) */
let logsByDate = new Map()
/** Dates where skip_after_run habits are waived (run day + day after). */
let calveWaivedDates = new Set()
let todayKey = ''
let yesterdayKey = ''
let editingYesterday = false
let trackingStart = ''
let currentUserId = null

function toLocalDateKey(value) {
  return dateOnly(value)
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

function mondayOfWeek(dateKey) {
  const date = parseDateKey(dateKey)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return toLocalDateKey(date)
}

function isoWeekNumber(dateKey) {
  const date = parseDateKey(dateKey)
  const thursday = new Date(date)
  thursday.setDate(date.getDate() + (4 - (date.getDay() || 7)))
  const yearStart = new Date(thursday.getFullYear(), 0, 1)
  return Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7)
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

function habitsForDate(dateKey) {
  return habitDefs.filter(habit => isHabitActiveOn(habit, dateKey))
}

function getActiveHabitsForDate(dateKey) {
  return habitsForDate(dateKey).filter(
    habit => !(isSkipAfterRun(habit) && isCalveWaived(dateKey))
  )
}

function isDone(dateKey, habitId) {
  return Boolean(logsByDate.get(dateKey)?.get(habitId))
}

function setDoneLocal(dateKey, habitId, done) {
  if (!logsByDate.has(dateKey)) logsByDate.set(dateKey, new Map())
  logsByDate.get(dateKey).set(habitId, done)
}

function completionPercent(dateKey) {
  const active = getActiveHabitsForDate(dateKey)
  if (active.length === 0) return 0
  const done = active.filter(habit => isDone(dateKey, habit.id)).length
  return Math.round((done / active.length) * 100)
}

function cellStyle(percent) {
  const t = Math.max(0, Math.min(100, percent)) / 100
  const hue = Math.pow(t, 2.5) * 120
  const color = `hsl(${hue}, 70%, 42%)`
  return {
    backgroundColor: color,
    color: '#fff',
  }
}

function activeEditDateKey() {
  return editingYesterday ? yesterdayKey : todayKey
}

function canEditYesterday() {
  return Boolean(trackingStart) && yesterdayKey >= trackingStart
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
  list.innerHTML = ''

  for (const habit of habitsForDate(dateKey)) {
    const li = document.createElement('li')
    const id = `habit-${habit.id}`
    const label = document.createElement('label')
    label.htmlFor = id
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.id = id
    input.dataset.habitId = habit.id
    input.checked = isDone(dateKey, habit.id)

    const waived = isSkipAfterRun(habit) && isCalveWaived(dateKey)
    label.append(input, document.createTextNode(` ${habit.name}`))
    if (waived) {
      label.classList.add('habit-waived')
      input.disabled = true
      label.title = 'Vrijgesteld door hardlopen'
    } else {
      input.addEventListener('change', onHabitToggle)
    }

    li.appendChild(label)
    list.appendChild(li)
  }

  const title = document.getElementById('todayLabel')
  if (editingYesterday) {
    title.textContent = formatDayLabel(dateKey, 'Gisteren')
  } else {
    title.textContent = formatDayLabel(todayKey, 'Vandaag')
  }

  renderYesterdayToggle()
}

function onYesterdayToggleClick() {
  if (!canEditYesterday()) return
  editingYesterday = !editingYesterday
  renderCheckboxes()
}

async function onHabitToggle(event) {
  const dateKey = activeEditDateKey()
  const habitId = event.target.dataset.habitId
  const done = event.target.checked

  if (!currentUserId) {
    alert('Kon niet opslaan. Ben je ingelogd?')
    await loadData()
    return
  }

  const { error } = await upsertLog({
    userId: currentUserId,
    habitId,
    habitDate: dateKey,
    done,
  })

  if (error) {
    console.error(error)
    alert('Kon niet opslaan. Ben je ingelogd?')
    await loadData()
    return
  }

  setDoneLocal(dateKey, habitId, done)
  renderGrid()
}

function setGreyCell(td) {
  td.className = 'habits-cell habits-cell--inactive'
  td.textContent = ''
  td.style.backgroundColor = ''
  td.style.color = ''
}

function setPercentCell(td, dateKey) {
  const pct = completionPercent(dateKey)
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
  return Boolean(trackingStart) && dateKey >= trackingStart && dateKey <= todayKey
}

function earliestTrackingDate() {
  const dates = []
  for (const habit of habitDefs) {
    const start = dateOnly(habit.starts_on)
    if (start) dates.push(start)
  }
  for (const dateKey of logsByDate.keys()) {
    dates.push(dateKey)
  }
  dates.sort()
  return dates[0] ?? todayKey
}

function renderGrid() {
  const tbody = document.getElementById('habitsGridBody')
  tbody.innerHTML = ''
  if (!trackingStart) return

  const trackingStartMonday = mondayOfWeek(trackingStart)
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

function indexLogs(rows) {
  logsByDate = new Map()
  for (const row of rows) {
    const dateKey = dateOnly(row.habit_date)
    if (!logsByDate.has(dateKey)) logsByDate.set(dateKey, new Map())
    logsByDate.get(dateKey).set(row.habit_id, Boolean(row.done))
  }
}

async function loadData() {
  todayKey = toLocalDateKey(getTodayDate())
  yesterdayKey = addDaysToKey(todayKey, -1)

  const { data: { user } } = await supabase.auth.getUser()
  currentUserId = user?.id ?? null

  const [habitsResult, logsResult, runsResult] = await Promise.all([
    loadHabits(),
    loadLogs(),
    supabase.from(RUN_TABLE).select('created_at'),
  ])

  if (habitsResult.error) {
    console.error(habitsResult.error)
    if (habitsResult.error.code === 'PGRST301' || habitsResult.error.message?.includes('JWT')) {
      await supabase.auth.signOut()
    }
    return
  }

  if (logsResult.error) {
    console.error(logsResult.error)
    return
  }

  if (runsResult.error) {
    console.error(runsResult.error)
  } else {
    calveWaivedDates = buildCalveWaivedDates(runsResult.data ?? [])
  }

  habitDefs = habitsResult.data
  indexLogs(logsResult.data)
  trackingStart = earliestTrackingDate()
  if (editingYesterday && !canEditYesterday()) {
    editingYesterday = false
  }
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
