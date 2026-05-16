import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://wnifvpadsttgyxjellmx.supabase.co'
const supabaseKey = 'sb_publishable_0TAlUKDZZkCMjYj4FxAV2w_cG3OjZEC'

const isLocal =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1'

const TABLE = isLocal ? 'forgot_dev' : 'forgot'

const supabase = createClient(supabaseUrl, supabaseKey)

const loginSection = document.getElementById('loginSection')
const appSection = document.getElementById('appSection')
const loginForm = document.getElementById('loginForm')
const loginError = document.getElementById('loginError')

function showLogin(message = '') {
  loginSection.hidden = false
  appSection.hidden = true
  loginError.hidden = !message
  loginError.textContent = message
}

function showApp() {
  loginSection.hidden = true
  appSection.hidden = false
  loginError.hidden = true
  loginError.textContent = ''
}

async function loadData() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
      showLogin('Sessie verlopen. Log opnieuw in.')
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

async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    showLogin(error.message === 'Invalid login credentials'
      ? 'Onjuiste e-mail of wachtwoord.'
      : error.message)
    return false
  }
  return true
}

async function signOut() {
  await supabase.auth.signOut()
  showLogin()
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = document.getElementById('loginEmail').value.trim()
  const password = document.getElementById('loginPassword').value
  await signIn(email, password)
})

document.getElementById('logoutBtn').addEventListener('click', signOut)
document.getElementById('addForgotBtn').addEventListener('click', addForgot)

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    showApp()
    loadData()
  } else {
    showLogin()
  }
})

const { data: { session } } = await supabase.auth.getSession()
if (session) {
  showApp()
  loadData()
} else {
  showLogin()
}
