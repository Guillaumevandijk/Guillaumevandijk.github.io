import Chart from 'https://esm.sh/chart.js/auto'
import 'https://esm.sh/chartjs-adapter-date-fns'
import { supabase, getTable } from './supabase-client.js'
import { initAuth } from './auth.js'
import { getTodayDate, onDevTodayChange } from './dev-today.js'

const TABLE = getTable('run_stats')
const FORECAST_MONTHS = 6
const TRACKING_START = '2026-07-01'

let runChart = null
let runRows = []
let showForecast = false
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

function addMonths(timestamp, months) {
  const d = new Date(timestamp)
  d.setMonth(d.getMonth() + months)
  return d.getTime()
}

function linearRegression(points) {
  const n = points.length
  if (n < 2) return null

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0

  for (const p of points) {
    sumX += p.x
    sumY += p.y
    sumXY += p.x * p.y
    sumXX += p.x * p.x
  }

  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return null

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  return {
    predict(x) {
      return slope * x + intercept
    },
  }
}

/** "6:25" → seconds per km (385). */
function parseTempoInput(value) {
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d+):(\d{1,2})$/)
  if (!match) return null

  const minutes = parseInt(match[1], 10)
  const seconds = parseInt(match[2], 10)
  if (seconds >= 60) return null

  return minutes * 60 + seconds
}

function formatTempo(secondsPerKm) {
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
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

function buildChartPoints(sorted) {
  return sorted.map(row => ({
    x: new Date(row.created_at).getTime(),
    y: Number(row.distance_km),
  }))
}

function buildRunsByDay(rows) {
  const map = new Map()
  for (const row of rows) {
    const key = toLocalDateKey(row.created_at)
    if (!map.has(key)) {
      map.set(key, { distance: 0, ratings: [] })
    }
    const day = map.get(key)
    day.distance += Number(row.distance_km)
    if (row.rating != null) {
      day.ratings.push(Number(row.rating))
    }
  }
  return map
}

function isInTrackingRange(dateKey) {
  return dateKey >= TRACKING_START && dateKey <= todayKey
}

function setGreyCell(td) {
  td.className = 'habits-cell habits-cell--inactive'
  td.textContent = ''
  td.style.backgroundColor = ''
  td.style.color = ''
}

function updateForecastUi(points, trend, forecastEndX) {
  const btn = document.getElementById('forecastToggle')
  const summary = document.getElementById('forecastSummary')

  if (btn) {
    btn.disabled = points.length < 2
    btn.setAttribute('aria-pressed', String(showForecast))
    btn.classList.toggle('forecast-toggle--active', showForecast)
  }

  if (!summary) return

  if (showForecast && trend && forecastEndX != null) {
    const predicted = trend.predict(forecastEndX)
    summary.hidden = false
    summary.textContent =
      `Als de trend doorzet: ${predicted.toFixed(1)} km over ${FORECAST_MONTHS} maanden`
  } else {
    summary.hidden = true
    summary.textContent = ''
  }
}

function renderChart(rows) {
  runRows = rows ?? []
  const canvas = document.getElementById('runChart')
  const sorted = [...runRows].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )
  const points = buildChartPoints(sorted)
  const pointColors = sorted.map(row => ratingColor(row.rating))

  if (runChart) {
    runChart.destroy()
    runChart = null
  }

  if (points.length === 0) {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    updateForecastUi(points, null, null)
    return
  }

  const trend = linearRegression(points)
  const firstX = points[0].x
  const lastX = points[points.length - 1].x
  const forecastEndX = addMonths(lastX, FORECAST_MONTHS)

  const datasets = [{
    label: 'Afstand (km)',
    data: points,
    borderColor: 'rgba(37, 99, 235, 0.35)',
    backgroundColor: 'rgba(37, 99, 235, 0.06)',
    fill: true,
    tension: 0.2,
    pointRadius: 5,
    pointBackgroundColor: pointColors,
    pointBorderColor: pointColors,
    pointBorderWidth: 2,
    pointHoverBackgroundColor: pointColors,
    pointHoverBorderColor: pointColors,
  }]

  const xScale = {
    type: 'time',
    time: {
      tooltipFormat: 'd MMM yyyy',
      displayFormats: {
        day: 'd MMM',
        week: 'd MMM',
        month: 'MMM yyyy',
      },
    },
    title: { display: true, text: 'Datum' },
  }

  if (showForecast && trend) {
    datasets.push({
      label: 'Trend',
      data: [
        { x: firstX, y: trend.predict(firstX) },
        { x: forecastEndX, y: trend.predict(forecastEndX) },
      ],
      borderColor: '#dc2626',
      backgroundColor: 'transparent',
      borderDash: [6, 4],
      fill: false,
      tension: 0,
      pointRadius: 0,
    })
    xScale.max = forecastEndX
  }

  updateForecastUi(points, trend, forecastEndX)

  runChart = new Chart(canvas, {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      parsing: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: xScale,
        y: {
          beginAtZero: true,
          title: { display: true, text: 'km' },
        },
      },
    },
  })
}

function renderGrid(rows) {
  const tbody = document.getElementById('runGridBody')
  tbody.innerHTML = ''
  const runsByDay = buildRunsByDay(rows)

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
      const day = runsByDay.get(dateKey)

      if (!isInTrackingRange(dateKey) || !day) {
        setGreyCell(td)
      } else {
        const avgRating = day.ratings.length
          ? day.ratings.reduce((a, b) => a + b, 0) / day.ratings.length
          : 5
        const style = ratingCellStyle(avgRating)
        td.className = 'habits-cell'
        td.textContent = day.distance % 1 === 0
          ? String(day.distance)
          : day.distance.toFixed(1)
        td.style.backgroundColor = style.backgroundColor
        td.style.color = style.color
        if (dateKey === todayKey) {
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

  rows.forEach(item => {
    const row = document.createElement('tr')
    row.innerHTML = `
      <td>${Number(item.distance_km)} km</td>
      <td>${formatTempo(item.tempo_seconds)}</td>
      <td>${item.rating ?? '—'}</td>
      <td>${new Date(item.created_at).toLocaleString()}</td>
    `
    tableBody.appendChild(row)
  })
}

async function loadData() {
  todayKey = toLocalDateKey(getTodayDate())

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
      await supabase.auth.signOut()
    }
    return
  }

  const rows = data ?? []
  renderChart(rows)
  renderGrid(rows)
  renderTable(rows)
}

async function addRun() {
  const distanceInput = document.getElementById('distanceInput')
  const tempoInput = document.getElementById('tempoInput')
  const ratingInput = document.getElementById('ratingInput')

  const distance = parseFloat(distanceInput.value.replace(',', '.'))
  const tempoSeconds = parseTempoInput(tempoInput.value)
  const rating = parseInt(ratingInput.value, 10)

  if (Number.isNaN(distance) || distance <= 0) {
    alert('Voer een geldige afstand in (km).')
    return
  }

  if (tempoSeconds == null) {
    alert('Voer tempo in als min:sec per km, bijv. 6:25')
    return
  }

  if (Number.isNaN(rating) || rating < 1 || rating > 10) {
    alert('Kuit cijfer moet tussen 1 en 10 zijn.')
    return
  }

  const { error } = await supabase
    .from(TABLE)
    .insert([{
      distance_km: distance,
      tempo_seconds: tempoSeconds,
      rating,
    }])

  if (error) {
    console.error(error)
    alert('Kon niet opslaan. Ben je ingelogd?')
    return
  }

  distanceInput.value = ''
  tempoInput.value = ''
  ratingInput.value = ''
  loadData()
}

document.getElementById('addRunBtn').addEventListener('click', addRun)

document.getElementById('forecastToggle')?.addEventListener('click', () => {
  const points = buildChartPoints(
    [...runRows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  )
  if (points.length < 2) return
  showForecast = !showForecast
  renderChart(runRows)
})

initAuth({ onAuthenticated: loadData })

onDevTodayChange(() => {
  const app = document.getElementById('appSection')
  if (app && !app.hidden) loadData()
})
