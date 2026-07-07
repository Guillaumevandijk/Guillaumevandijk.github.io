import Chart from 'https://esm.sh/chart.js/auto'
import { supabase, getTable } from './supabase-client.js'
import { initAuth } from './auth.js'
import { getTodayDate, onDevTodayChange } from './dev-today.js'

const TABLE = getTable('forgot')

let forgotChart = null

function toLocalDateKey(value) {
  const d = value instanceof Date ? value : new Date(value)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toLocalDateKey(date)
}

/** Daily counts from first entry through today, plus trailing 7-day average. */
function buildChartSeries(rows) {
  if (rows.length === 0) return { labels: [], dailyCounts: [], averages: [] }

  const countsByDay = new Map()
  for (const row of rows) {
    const key = toLocalDateKey(row.created_at)
    countsByDay.set(key, (countsByDay.get(key) ?? 0) + 1)
  }

  const sortedKeys = [...countsByDay.keys()].sort()
  const firstDay = sortedKeys[0]
  const today = toLocalDateKey(getTodayDate())

  const dayKeys = []
  for (let key = firstDay; key <= today; key = addDays(key, 1)) {
    dayKeys.push(key)
  }

  const dailyCounts = dayKeys.map(key => countsByDay.get(key) ?? 0)
  const averages = dailyCounts.map((_, i) => {
    const window = dailyCounts.slice(Math.max(0, i - 6), i + 1)
    const sum = window.reduce((a, b) => a + b, 0)
    return sum / window.length
  })

  const labels = dayKeys.map(key => {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
    })
  })

  return { labels, dailyCounts, averages }
}

function renderChart(rows) {
  const canvas = document.getElementById('forgotChart')
  const { labels, dailyCounts, averages } = buildChartSeries(rows)

  if (forgotChart) {
    forgotChart.destroy()
    forgotChart = null
  }

  if (labels.length === 0) {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    return
  }

  forgotChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Per dag',
          data: dailyCounts,
          backgroundColor: '#2563eb',
          borderRadius: 4,
          order: 2,
        },
        {
          type: 'line',
          label: '7-daags gemiddelde',
          data: averages,
          borderColor: '#dc2626',
          backgroundColor: 'transparent',
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2,
          order: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'per dag' },
          ticks: {
            stepSize: 1,
            callback: value => Number(value).toFixed(1),
          },
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
      <td>${item.text}</td>
      <td>${new Date(item.created_at).toLocaleString()}</td>
    `
    tableBody.appendChild(row)
  })
}

async function addForgot() {
  const input = document.getElementById('forgotInput')
  const value = input.value.trim()
  if (!value) return

  const { error } = await supabase
    .from(TABLE)
    .insert([{ text: value }])

  if (error) {
    console.error(error)
    alert('Kon niet opslaan. Ben je ingelogd?')
    return
  }

  input.value = ''
  loadData()
}

document.getElementById('addForgotBtn').addEventListener('click', addForgot)

initAuth({ onAuthenticated: loadData })

onDevTodayChange(() => {
  const app = document.getElementById('appSection')
  if (app && !app.hidden) loadData()
})
