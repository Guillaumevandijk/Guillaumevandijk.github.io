import { supabase, getTable } from './supabase-client.js'
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
let pageKey = ''
let root = null
let bound = false

function qs(selector) {
  return root?.querySelector(selector) ?? null
}

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

function canEditYesterday() {
  return Boolean(yesterdayKey)
}

function habitsForDate(dateKey) {
  return habitDefs.filter(habit => {
    if (isHabitActiveOn(habit, dateKey)) return true
    return dateKey === yesterdayKey && isHabitActiveOn(habit, todayKey)
  })
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
  const btn = qs('[data-yesterday-toggle]')
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
  const list = qs('[data-habit-checklist]')
  if (!list) return
  list.innerHTML = ''

  const habits = habitsForDate(dateKey)
  if (habits.length === 0) {
    const li = document.createElement('li')
    li.className = 'settings-empty'
    li.textContent = 'Nog geen gewoontes. Voeg ze toe in Profiel.'
    list.appendChild(li)
  }

  for (const habit of habits) {
    const li = document.createElement('li')
    const id = `habit-${pageKey}-${habit.id}`
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

  const title = qs('[data-today-label]')
  if (title) {
    title.textContent = editingYesterday
      ? formatDayLabel(dateKey, 'Gisteren')
      : formatDayLabel(todayKey, 'Vandaag')
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
  const tbody = qs('[data-habits-grid]')
  if (!tbody) return
  tbody.innerHTML = ''
  if (!trackingStart || habitDefs.length === 0) return

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

      if (!isInTrackingRange(dateKey) || getActiveHabitsForDate(dateKey).length === 0) {
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
  if (!root) return
  todayKey = toLocalDateKey(getTodayDate())
  yesterdayKey = addDaysToKey(todayKey, -1)

  const { data: { user } } = await supabase.auth.getUser()
  currentUserId = user?.id ?? null

  const [habitsResult, logsResult, runsResult] = await Promise.all([
    loadHabits(),
    loadLogs(),
    pageKey === 'sport'
      ? supabase.from(RUN_TABLE).select('created_at')
      : Promise.resolve({ data: [], error: null }),
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

  habitDefs = (habitsResult.data ?? []).filter(habit => (habit.page ?? 'sport') === pageKey)
  const habitIds = new Set(habitDefs.map(habit => habit.id))
  indexLogs((logsResult.data ?? []).filter(row => habitIds.has(row.habit_id)))
  trackingStart = earliestTrackingDate()
  if (editingYesterday && !canEditYesterday()) {
    editingYesterday = false
  }
  root.hidden = !habitDefs.some(habit => isHabitActiveOn(habit, todayKey))
  if (root.hidden) return
  renderCheckboxes()
  renderGrid()
}

function ensureMarkup({ heading, showGrid = true }) {
  if (root.dataset.habitsReady === '1') return
  root.dataset.habitsReady = '1'
  root.classList.add('habits-section')
  root.hidden = true
  root.innerHTML = `
    <div class="habits-section-bar">
      ${heading ? `<h2>${heading}</h2>` : ''}
      <button type="button" class="yesterday-toggle" data-yesterday-toggle aria-pressed="false">
        Gisteren gedaan
      </button>
    </div>
    <p class="habit-today-label" data-today-label></p>
    <ul class="habit-today" data-habit-checklist></ul>
    <div class="habits-grid-wrap" ${showGrid ? '' : 'hidden'}>
      <table class="habits-grid" aria-label="Weekoverzicht gewoontes">
        <thead>
          <tr>
            <th scope="col"></th>
            <th scope="col">Ma</th>
            <th scope="col">Di</th>
            <th scope="col">Wo</th>
            <th scope="col">Do</th>
            <th scope="col">Vr</th>
            <th scope="col">Za</th>
            <th scope="col">Zo</th>
          </tr>
        </thead>
        <tbody data-habits-grid></tbody>
      </table>
    </div>
  `
}

function bindOnce() {
  if (bound) return
  bound = true
  qs('[data-yesterday-toggle]')?.addEventListener('click', onYesterdayToggleClick)
  onDevTodayChange(() => {
    const app = document.getElementById('appSection')
    if (app && !app.hidden) loadData()
  })
}

export async function mountHabitsSection({ page, container, heading = 'Dagelijks', showGrid = true }) {
  pageKey = page
  root = typeof container === 'string' ? document.getElementById(container) : container
  if (!root) return
  ensureMarkup({ heading, showGrid })
  bindOnce()
  await loadData()
}
