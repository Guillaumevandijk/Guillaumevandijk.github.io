import { supabase, getTable } from './supabase-client.js'
import { initAuth } from './auth.js'

async function askAI(message) {
  const response = await fetch(
    'https://wnifvpadsttgyxjellmx.supabase.co/functions/v1/openai-private-proxy',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: message
          }
        ]
      })
    }
  )

  if (!response.ok) {
    throw new Error('AI request failed')
  }

  const data = await response.json()

  return data.content
}

const sendBtn = document.getElementById('sendBtn')

if (sendBtn) {
  sendBtn.addEventListener('click', async () => {
    const input = document.getElementById('chatInput')
    const output = document.getElementById('chatOutput')

    const message = input.value

    output.innerText = 'Thinking...'

    try {
      const reply = await askAI(message)

      output.innerText = reply
    } catch (err) {
      console.error(err)
      output.innerText = 'Error talking to AI'
    }
  })
}



const TABLE = getTable('forgot')

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
