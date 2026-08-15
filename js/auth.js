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
  const loginTitle = document.getElementById('loginTitle')
  const loginSubmit = document.getElementById('loginSubmit')
  const loginModeToggle = document.getElementById('loginModeToggle')
  const passwordConfirm = document.getElementById('loginPasswordConfirm')

  let isSignUp = false

  function setMode(signUp) {
    isSignUp = signUp
    loginTitle.textContent = signUp ? 'Account aanmaken' : 'Inloggen'
    loginSubmit.textContent = signUp ? 'Account aanmaken' : 'Inloggen'
    loginModeToggle.textContent = signUp
      ? 'Al een account? Inloggen'
      : 'Nog geen account? Account aanmaken'
    passwordConfirm.hidden = !signUp
    passwordConfirm.required = signUp
    document.getElementById('loginPassword').autocomplete = signUp
      ? 'new-password'
      : 'current-password'
  }

  function showLogin(message = '', isHint = false) {
    loginSection.hidden = false
    appSection.hidden = true
    loginError.hidden = !message
    loginError.textContent = message
    loginError.classList.toggle('login-hint', isHint)
  }

  function showApp() {
    loginSection.hidden = true
    appSection.hidden = false
    loginError.hidden = true
    loginError.textContent = ''
    loginError.classList.remove('login-hint')
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

  async function signUp(email, password, passwordRepeat) {
    if (password.length < 6) {
      showLogin('Wachtwoord moet minstens 6 tekens zijn.')
      return false
    }
    if (password !== passwordRepeat) {
      showLogin('Wachtwoorden komen niet overeen.')
      return false
    }

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) {
      showLogin(error.message === 'User already registered'
        ? 'Dit e-mailadres heeft al een account. Log in.'
        : error.message)
      return false
    }

    if (!data.session) {
      setMode(false)
      showLogin('Account aangemaakt. Bevestig je e-mail en log daarna in.', true)
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
    if (isSignUp) {
      await signUp(email, password, passwordConfirm.value)
    } else {
      await signIn(email, password)
    }
  })

  loginModeToggle.addEventListener('click', () => {
    setMode(!isSignUp)
    showLogin()
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
