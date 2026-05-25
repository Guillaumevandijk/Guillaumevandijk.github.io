import { supabase } from './supabase-client.js'
import { initAuth } from './auth.js'

async function askAI(message) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Not logged in')
  }

  const { data, error } = await supabase.functions.invoke('openai-private-proxy', {
    body: {
      model: 'gpt-5.4-nano',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
        {
          role: 'user',
          content: message,
        },
      ],
    },
  })

  if (error) {
    throw error
  }

  return data.content
}

document.getElementById('sendBtn').addEventListener('click', async () => {
  const input = document.getElementById('chatInput')
  const output = document.getElementById('chatOutput')
  const message = input.value.trim()
  if (!message) return

  output.innerText = 'Bezig...'

  try {
    const reply = await askAI(message)
    output.innerText = reply
  } catch (err) {
    console.error(err)
    output.innerText = 'Fout bij AI-verzoek'
  }
})

initAuth({ onAuthenticated: () => {} })
