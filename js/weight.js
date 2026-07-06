import Chart from 'https://esm.sh/chart.js/auto'
import 'https://esm.sh/chartjs-adapter-date-fns'
import { supabase, getTable } from './supabase-client.js'
import { initAuth } from './auth.js'

const TABLE = getTable('weight')
const FORECAST_MONTHS = 6

let weightChart = null
let weightRows = []
let showForecast = false

function addMonths(timestamp, months) {
  const d = new Date(timestamp)
  d.setMonth(d.getMonth() + months)
  return d.getTime()
}

/** Least-squares line: y = slope * x + intercept (x in ms). */
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
    slope,
    intercept,
    predict(x) {
      return slope * x + intercept
    },
  }
}

function buildPoints(sorted) {
  return sorted.map(row => ({
    x: new Date(row.created_at).getTime(),
    y: Number(row.weight),
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
      `Als de trend doorzet: ${predicted.toFixed(1)} kg over ${FORECAST_MONTHS} maanden`
  } else {
    summary.hidden = true
    summary.textContent = ''
  }
}

function renderChart(rows) {
  weightRows = rows ?? []
  const canvas = document.getElementById('weightChart')
  const sorted = [...weightRows].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )
  const points = buildPoints(sorted)

  if (weightChart) {
    weightChart.destroy()
    weightChart = null
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
    label: 'Gewicht (kg)',
    data: points,
    borderColor: '#2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    fill: true,
    tension: 0.2,
    pointRadius: 4,
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

  weightChart = new Chart(canvas, {
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
          beginAtZero: false,
          title: { display: true, text: 'kg' },
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

  renderChart(data)

  const tableBody = document.getElementById('tableBody')
  tableBody.innerHTML = ''

  data.forEach(item => {
    const row = document.createElement('tr')
    row.innerHTML = `
      <td>${Number(item.weight)} kg</td>
      <td>${new Date(item.created_at).toLocaleString()}</td>
    `
    tableBody.appendChild(row)
  })
}

async function addWeight() {
  const input = document.getElementById('weightInput')
  const value = parseFloat(input.value.replace(',', '.'))

  if (Number.isNaN(value) || value <= 0) {
    alert('Voer een geldig gewicht in (kg).')
    return
  }

  const { error } = await supabase
    .from(TABLE)
    .insert([{ weight: value }])

  if (error) {
    console.error(error)
    alert('Kon niet opslaan. Ben je ingelogd?')
    return
  }

  input.value = ''
  loadData()
}

document.getElementById('addWeightBtn').addEventListener('click', addWeight)

document.getElementById('forecastToggle')?.addEventListener('click', () => {
  const points = buildPoints(
    [...weightRows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  )
  if (points.length < 2) return
  showForecast = !showForecast
  renderChart(weightRows)
})

initAuth({ onAuthenticated: loadData })
