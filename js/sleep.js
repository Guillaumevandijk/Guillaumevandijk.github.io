import { supabase, getTable } from './supabase-client.js'
import { initAuth } from './auth.js'
import { getTodayDate, onDevTodayChange } from './dev-today.js'

const TABLE = getTable('sleep_stats')
const NIGHT_CUTOVER_HOUR = 18

let sleepRows = []
let todayKey = ''
let nightStartKey = ''
let currentUserId = null
let fillingForm = false

function toLocalDateKey(value) {
  const d = value instanceof Date ? value : new Date(value)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateOnly(value) {
  if (value == null) return null
  if (typeof value === 'string' && value.length >= 10) return value.slice(0, 10)
  return toLocalDateKey(value)
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

/** Before 18:00: night that started yesterday. From 18:00: night that starts today. */
function currentNightStartKey(now = getTodayDate()) {
  const dayKey = toLocalDateKey(now)
  const hour = new Date().getHours()
  return hour >= NIGHT_CUTOVER_HOUR ? dayKey : addDaysToKey(dayKey, -1)
}

function formatNightLabel(nightStart) {
  const start = parseDateKey(nightStart)
  const end = parseDateKey(addDaysToKey(nightStart, 1))
  const startDay = start.getDate()
  const endPart = end.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  return `Nacht ${startDay} op ${endPart}`
}

function timeForInput(value) {
  if (!value) return ''
  return String(value).slice(0, 5)
}

function timeToMinutes(value) {
  const text = timeForInput(value)
  const match = text.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
}

function sleepMinutes(bedtime, wakeTime) {
  const bed = timeToMinutes(bedtime)
  const wake = timeToMinutes(wakeTime)
  if (bed == null || wake == null) return null
  let diff = wake - bed
  if (diff <= 0) diff += 24 * 60
  return diff
}

function formatDuration(totalMinutes) {
  const rounded = Math.round(totalMinutes)
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

function ratingColor(rating) {
  const value = rating ?? 5
  const hue = (value / 10) * 120
  return `hsl(${hue}, 70%, 42%)`
}

function ratingCellStyle(rating) {
  return {
    backgroundColor: ratingColor(rating),
    color: '#fff',
  }
}

function rowByNight(nightStart) {
  return sleepRows.find(row => dateOnly(row.night_start) === nightStart) ?? null
}

function earliestSleepDate(rows) {
  if (!rows.length) return null
  return rows.reduce((min, row) => {
    const key = dateOnly(row.night_start)
    return !min || key < min ? key : min
  }, null)
}

function isInTrackingRange(dateKey, trackingStart) {
  return Boolean(trackingStart) && dateKey >= trackingStart && dateKey <= todayKey
}

function setGreyCell(td) {
  td.className = 'habits-cell habits-cell--inactive'
  td.textContent = ''
  td.style.backgroundColor = ''
  td.style.color = ''
}

function updateDurationHint(bedtime, wakeTime) {
  const hint = document.getElementById('sleepDurationHint')
  const minutes = sleepMinutes(bedtime, wakeTime)
  hint.textContent = minutes == null ? 'Slaapduur: —' : `Slaapduur: ${formatDuration(minutes)}`
}

function nightIsComplete(row) {
  return Boolean(row?.bedtime && row?.wake_time && row?.rating != null)
}

function syncEditorFold() {
  const fold = document.getElementById('sleepEditor')
  fold.open = !nightIsComplete(rowByNight(nightStartKey))
}

function updateNightSummary(row) {
  const label = formatNightLabel(nightStartKey)
  const minutes = sleepMinutes(row?.bedtime, row?.wake_time)
  document.getElementById('nightLabel').textContent =
    minutes == null ? label : `${label} · ${formatDuration(minutes)}`
}

function fillNightForm() {
  fillingForm = true
  const row = rowByNight(nightStartKey)
  updateNightSummary(row)
  document.getElementById('bedtimeInput').value = timeForInput(row?.bedtime)
  document.getElementById('wakeInput').value = timeForInput(row?.wake_time)
  document.getElementById('ratingInput').value = row?.rating ?? ''
  document.getElementById('noteInput').value = row?.note ?? ''
  updateDurationHint(row?.bedtime, row?.wake_time)
  fillingForm = false
  syncEditorFold()
}

function renderGrid(rows) {
  const tbody = document.getElementById('sleepGridBody')
  tbody.innerHTML = ''
  const trackingStart = earliestSleepDate(rows) ?? nightStartKey
  if (!trackingStart) return

  const byNight = new Map()
  for (const row of rows) {
    byNight.set(dateOnly(row.night_start), row)
  }

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
      const row = byNight.get(dateKey)

      if (!isInTrackingRange(dateKey, trackingStart) || !row) {
        setGreyCell(td)
      } else {
        const minutes = sleepMinutes(row.bedtime, row.wake_time)
        td.className = 'habits-cell'
        td.textContent = minutes == null ? '…' : formatDuration(minutes)
        if (row.rating != null) {
          const style = ratingCellStyle(row.rating)
          td.style.backgroundColor = style.backgroundColor
          td.style.color = style.color
        } else {
          td.style.backgroundColor = '#94a3b8'
          td.style.color = '#fff'
        }
        if (dateKey === nightStartKey) {
          td.classList.add('habits-cell--today')
        }
      }

      tr.appendChild(td)
    }

    tbody.appendChild(tr)
  }
}

function renderTable(rows) {
  const tableBody = document.getElementById('tableBody')
  tableBody.innerHTML = ''

  const sorted = [...rows].sort(
    (a, b) => dateOnly(b.night_start).localeCompare(dateOnly(a.night_start))
  )

  for (const item of sorted) {
    const minutes = sleepMinutes(item.bedtime, item.wake_time)
    const tr = document.createElement('tr')
    const cells = [
      formatNightLabel(dateOnly(item.night_start)),
      timeForInput(item.bedtime) || '—',
      timeForInput(item.wake_time) || '—',
      minutes == null ? '—' : formatDuration(minutes),
      item.rating ?? '—',
      item.note?.trim() || '—',
    ]
    for (const text of cells) {
      const td = document.createElement('td')
      td.textContent = text
      tr.appendChild(td)
    }
    tableBody.appendChild(tr)
  }
}

async function loadData() {
  todayKey = toLocalDateKey(getTodayDate())
  nightStartKey = currentNightStartKey()

  const { data: { user } } = await supabase.auth.getUser()
  currentUserId = user?.id ?? null

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('night_start', { ascending: false })

  if (error) {
    console.error(error)
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
      await supabase.auth.signOut()
    }
    return
  }

  const rows = data ?? []
  sleepRows = rows
  renderGrid(rows)
  renderTable(rows)
  fillNightForm()
}

async function savePatch(patch) {
  if (fillingForm) return
  if (!currentUserId || !nightStartKey) {
    alert('Kon niet opslaan. Ben je ingelogd?')
    return
  }

  const existing = rowByNight(nightStartKey)
  const row = {
    user_id: currentUserId,
    night_start: nightStartKey,
    bedtime: existing?.bedtime ?? null,
    wake_time: existing?.wake_time ?? null,
    rating: existing?.rating ?? null,
    note: existing?.note ?? null,
    ...patch,
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(row, { onConflict: 'user_id,night_start' })
    .select()
    .single()

  if (error) {
    console.error(error)
    alert('Kon niet opslaan. Ben je ingelogd?')
    await loadData()
    return
  }

  const index = sleepRows.findIndex(item => dateOnly(item.night_start) === nightStartKey)
  if (index >= 0) sleepRows[index] = data
  else sleepRows.push(data)

  renderGrid(sleepRows)
  renderTable(sleepRows)
  updateDurationHint(data.bedtime, data.wake_time)
  updateNightSummary(data)
  syncEditorFold()
}

async function onBedtimeChange() {
  const value = document.getElementById('bedtimeInput').value || null
  updateDurationHint(value, document.getElementById('wakeInput').value)
  await savePatch({ bedtime: value })
}

async function onWakeChange() {
  const value = document.getElementById('wakeInput').value || null
  updateDurationHint(document.getElementById('bedtimeInput').value, value)
  await savePatch({ wake_time: value })
}

async function onRatingChange() {
  const raw = document.getElementById('ratingInput').value.trim()
  if (raw === '') {
    await savePatch({ rating: null })
    return
  }
  const rating = parseInt(raw, 10)
  if (Number.isNaN(rating) || rating < 1 || rating > 10) {
    alert('Gevoel moet tussen 1 en 10 zijn.')
    const existing = rowByNight(nightStartKey)
    document.getElementById('ratingInput').value = existing?.rating ?? ''
    return
  }
  await savePatch({ rating })
}

async function onNoteChange() {
  const note = document.getElementById('noteInput').value.trim() || null
  await savePatch({ note })
}

document.getElementById('bedtimeInput').addEventListener('change', onBedtimeChange)
document.getElementById('wakeInput').addEventListener('change', onWakeChange)
document.getElementById('ratingInput').addEventListener('change', onRatingChange)
document.getElementById('noteInput').addEventListener('change', onNoteChange)

initAuth({ onAuthenticated: loadData })

onDevTodayChange(() => {
  const app = document.getElementById('appSection')
  if (app && !app.hidden) loadData()
})
