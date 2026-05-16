// Supabase browser client: loads the SDK from a CDN and creates a client for this project.
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://wnifvpadsttgyxjellmx.supabase.co'

// Publishable (anon) key: safe for front-end use; access is limited by Row Level Security in Supabase.
const supabaseKey = 'sb_publishable_0TAlUKDZZkCMjYj4FxAV2w_cG3OjZEC'

const isLocal =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1'
  
const TABLE = isLocal ? 'forgot_dev' : 'forgot'


const supabase = createClient(supabaseUrl, supabaseKey)

// Fetches every row from the `forgot` table and renders them into the HTML table (newest first).
async function loadData() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
    return
  }

  const tableBody = document.getElementById('tableBody')
  tableBody.innerHTML = ''

  // One table row per database row: text column and a human-readable created_at timestamp.
  data.forEach(item => {
    const row = document.createElement('tr')

    row.innerHTML = `
          <td>${item.text}</td>
          <td>${new Date(item.created_at).toLocaleString()}</td>
        `

    tableBody.appendChild(row)
  })
}

// Reads the input, inserts a new row into `forgot`, then clears the input and refreshes the table.
async function addForgot() {
  const input = document.getElementById('forgotInput')
  const value = input.value.trim()

  if (!value) return

  const { error } = await supabase
    .from(TABLE)
    .insert([{ text: value }])

  if (error) {
    console.error(error)
    alert('Error saving')
    return
  }

  input.value = ''
  loadData()
}

document.getElementById('addForgotBtn').addEventListener('click', addForgot)

// Initial load when the page opens so the table is filled from the database.
loadData()
