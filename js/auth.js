import { supabase } from './supabase-client.js'



/**
 * Shared login UI for index.html, weight.html, and ai.html.
 * @param {{ onAuthenticated: () => void }} options — called when user is logged in
 */
export async function initAuth({ onAuthenticated }) {
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

  async function handleAuthError(error) {
    console.error(error)
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
      showLogin('Sessie verlopen. Log opnieuw in.')
      await supabase.auth.signOut()
    }
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

  const logoutBtn = document.getElementById('logoutBtn')
  if (logoutBtn) logoutBtn.addEventListener('click', signOut)

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showApp()
      onAuthenticated()
    } else {
      showLogin()
    }
  })

  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    showApp()
    onAuthenticated()
  } else {
    showLogin()
  }

  return { showLogin, handleAuthError, signOut }
}
