import Chart from 'https://esm.sh/chart.js/auto'
import 'https://esm.sh/chartjs-adapter-date-fns'
import { supabase, getTable } from './supabase-client.js'
import { onDevTodayChange } from './dev-today.js'

const TABLE = getTable('run_stats')
const FORECAST_MONTHS = 6

let runChart = null
let runRows = []
let showForecast = false

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

function ratingColor(rating) {
  const value = rating ?? 5
  const hue = (value / 10) * 120
  return `hsl(${hue}, 70%, 42%)`
}

function buildChartPoints(sorted) {
  return sorted.map(row => ({
    x: new Date(row.created_at).getTime(),
    y: Number(row.distance_km),
  }))
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
  if (!canvas) return
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
    pointRadius: 8,
    pointHoverRadius: 10,
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

async function loadData() {
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
}

let sectionBound = false

function bindRunSection() {
  if (sectionBound) return
  sectionBound = true

  document.getElementById('forecastToggle')?.addEventListener('click', () => {
    const points = buildChartPoints(
      [...runRows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    )
    if (points.length < 2) return
    showForecast = !showForecast
    renderChart(runRows)
  })

  onDevTodayChange(() => {
    const app = document.getElementById('appSection')
    const section = document.getElementById('runSection')
    if (app && !app.hidden && section && !section.hidden) loadData()
  })
}

export async function loadRunSection() {
  const section = document.getElementById('runSection')
  if (section?.hidden) return
  if (!document.getElementById('runChart')) return
  bindRunSection()
  await loadData()
}
