import Chart from 'https://esm.sh/chart.js/auto'
import { supabase, getTable } from './supabase-client.js'
import { initAuth } from './auth.js'

const TABLE = getTable('weight')

let weightChart = null

function renderChart(rows) {
  const canvas = document.getElementById('weightChart')
  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )

  if (weightChart) {
    weightChart.destroy()
    weightChart = null
  }

  if (sorted.length === 0) {
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    return
  }

  weightChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: sorted.map(row =>
        new Date(row.created_at).toLocaleDateString('nl-NL', {
          day: 'numeric',
          month: 'short',
        })
      ),
      datasets: [{
        label: 'Gewicht (kg)',
        data: sorted.map(row => Number(row.weight)),
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.2,
        pointRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
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

initAuth({ onAuthenticated: loadData })
