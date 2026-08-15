import { supabase } from './supabase-client.js'
import { loadOrCreateProfile, applyNav, redirectIfPageDisabled } from './profile.js'
import { renderShell } from './layout.js'

/**
 * Shared login UI and nav for every page.
 * @param {{ onAuthenticated: (profile?: object | null) => void }} options — called when user is logged in
 */
export async function initAuth({ onAuthenticated }) {
  renderShell()

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

  async function afterLogin() {
    showApp()
    const profile = await loadOrCreateProfile()
    applyNav(profile)
    redirectIfPageDisabled(profile)
    onAuthenticated(profile)
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = document.getElementById('loginEmail').value.trim()
    const password = document.getElementById('loginPassword').value
    await signIn(email, password)
  })

  const logoutBtn = document.getElementById('logoutBtn')
  if (logoutBtn) logoutBtn.addEventListener('click', signOut)

  supabase.auth.onAuthStateChange((event, session) => {
    if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
      afterLogin()
    } else if (!session) {
      showLogin()
    }
  })

  return { showLogin, handleAuthError, signOut }
}
