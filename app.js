import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://wnifvpadsttgyxjellmx.supabase.co'

const supabaseKey = 'sb_publishable_0TAlUKDZZkCMjYj4FxAV2w_cG3OjZEC'

const supabase = createClient(supabaseUrl, supabaseKey)

async function loadData() {
  const { data, error } = await supabase
    .from('forgot')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
    return
  }

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
    .from('forgot')
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

loadData()
