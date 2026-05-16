/**
 * app.js — all logic for the "forgot items" list
 *
 * This file is loaded as an ES module (see index.html: type="module").
 * Modules can import other files/packages with `import`.
 */

// -----------------------------------------------------------------------------
// 1. CREATE SUPABASE CLIENT
// -----------------------------------------------------------------------------

// Loads the official Supabase library from the internet (CDN: esm.sh).
// No npm install needed; the browser downloads this when the page opens.
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

// Your Supabase project URL (Supabase → Project Settings → API).
const supabaseUrl = 'https://wnifvpadsttgyxjellmx.supabase.co'

// "Anon" / publishable key: meant for use in the browser.
// Anyone can see this key in the source code — so you protect data with RLS in Supabase,
// not by keeping the key secret.
const supabaseKey = 'sb_publishable_0TAlUKDZZkCMjYj4FxAV2w_cG3OjZEC'

// -----------------------------------------------------------------------------
// 2. WHICH DATABASE TABLE? (local vs live)
// -----------------------------------------------------------------------------

// `location` is a built-in browser object with info about the current URL.
// hostname = domain only, e.g. "localhost" or "guillaumevandijk.github.io"
const isLocal =
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1'

// On your laptop (npx serve) → test table forgot_dev
// On GitHub Pages → production table forgot
// This way you don't accidentally touch production data while experimenting.
const TABLE = isLocal ? 'forgot_dev' : 'forgot'

// `createClient` returns one object you use to call auth + database.
// All requests go over HTTPS to Supabase; the client automatically attaches
// your auth token once you are logged in.
const supabase = createClient(supabaseUrl, supabaseKey)

// -----------------------------------------------------------------------------
// 3. LINK TO HTML (DOM)
// -----------------------------------------------------------------------------

// document.getElementById finds one element with that id attribute in index.html.
// We store references so we don't have to search again every time.
const loginSection = document.getElementById('loginSection') // entire login block
const appSection = document.getElementById('appSection')     // list + input field
const loginForm = document.getElementById('loginForm')       // <form> around email/password
const loginError = document.getElementById('loginError')     // red error text

// -----------------------------------------------------------------------------
// 4. SWITCH UI: LOGIN SCREEN ↔ APP
// -----------------------------------------------------------------------------

/**
 * Show the login screen and hide the app.
 * @param {string} message - optional error text below the form
 */
function showLogin(message = '') {
  // hidden is an HTML property: true = element not visible
  loginSection.hidden = false
  appSection.hidden = true

  // Only show error text when there is a message
  loginError.hidden = !message
  loginError.textContent = message
}

/** Show the app (table + input) and hide the login screen. */
function showApp() {
  loginSection.hidden = true
  appSection.hidden = false
  loginError.hidden = true
  loginError.textContent = ''
}

// -----------------------------------------------------------------------------
// 5. FETCH DATA FROM SUPABASE (READ)
// -----------------------------------------------------------------------------

/**
 * Fetches all rows from table TABLE and renders them in the HTML table.
 * `async` = this function may use `await` (wait for network).
 */
async function loadData() {
  // .from(TABLE) picks the table; .select('*') = all columns;
  // .order(...) = newest first by created_at
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  // Supabase does not throw on errors — you must check `error` yourself.
  if (error) {
    console.error(error) // visible in DevTools → Console (F12)

    // JWT = JSON Web Token = proof that you are logged in.
    // Expired or invalid → log in again.
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
      showLogin('Sessie verlopen. Log opnieuw in.')
      await supabase.auth.signOut() // removes stored session in the browser
    }
    return // stop here; don't fill table on error
  }

  // tbody is where dynamic rows go (see index.html id="tableBody")
  const tableBody = document.getElementById('tableBody')

  // innerHTML = '' clears all existing rows (useful before redrawing)
  tableBody.innerHTML = ''

  // data is an array of objects, e.g. [{ text: "...", created_at: "..." }, ...]
  data.forEach(item => {
    const row = document.createElement('tr') // new table row

    // Template string (backticks) with ${} to put values into HTML
    row.innerHTML = `
      <td>${item.text}</td>
      <td>${new Date(item.created_at).toLocaleString()}</td>
    `

    tableBody.appendChild(row) // append row at the bottom of the table
  })
}

// -----------------------------------------------------------------------------
// 6. ADD A NEW ROW (CREATE)
// -----------------------------------------------------------------------------

async function addForgot() {
  const input = document.getElementById('forgotInput')
  const value = input.value.trim() // trim = remove leading/trailing spaces

  if (!value) return // empty? don't send anything

  // .insert([{ ... }]) adds one row; column names must exist in Supabase.
  // RLS in Supabase decides if you are allowed (only when logged in + your email).
  const { error } = await supabase
    .from(TABLE)
    .insert([{ text: value }])

  if (error) {
    console.error(error)
    alert('Kon niet opslaan. Ben je ingelogd?')
    return
  }

  input.value = ''  // clear field after success
  loadData()        // reload table so the new row appears
}

// -----------------------------------------------------------------------------
// 7. SIGN IN AND SIGN OUT (AUTH)
// -----------------------------------------------------------------------------

/**
 * Log in with email + password.
 * Supabase then stores a session in localStorage (browser).
 * On the next visit you usually don't need to log in again.
 */
async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Translate Supabase's English error to Dutch where possible
    showLogin(error.message === 'Invalid login credentials'
      ? 'Onjuiste e-mail of wachtwoord.'
      : error.message)
    return false
  }
  return true
  // Note: showApp() is not called here directly — onAuthStateChange (below)
  // reacts to a successful login and then calls showApp + loadData.
}

/** Sign out: clear session; onAuthStateChange shows the login screen again. */
async function signOut() {
  await supabase.auth.signOut()
  showLogin()
}

// -----------------------------------------------------------------------------
// 8. EVENT LISTENERS — RESPOND TO CLICKS / FORM
// -----------------------------------------------------------------------------

// submit = user presses Enter in the form or clicks the submit button
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault() // prevents page reload (default <form> behavior)

  const email = document.getElementById('loginEmail').value.trim()
  const password = document.getElementById('loginPassword').value
  await signIn(email, password)
})

document.getElementById('logoutBtn').addEventListener('click', signOut)
document.getElementById('addForgotBtn').addEventListener('click', addForgot)

// -----------------------------------------------------------------------------
// 9. AUTH LISTENER — REACTS TO LOGIN / LOGOUT / SESSION
// -----------------------------------------------------------------------------

// Called on: login, logout, page load with existing session, token refresh.
// `_event` = first parameter; underscore = "I'm not using this" (convention).
supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    // session includes user, access_token, etc.
    showApp()
    loadData()
  } else {
    showLogin()
  }
})

// -----------------------------------------------------------------------------
// 10. STARTUP WHEN THE PAGE OPENS
// -----------------------------------------------------------------------------

// Top-level await: allowed in modules; waits until Supabase reads the stored session.
const { data: { session } } = await supabase.auth.getSession()

if (session) {
  // Already logged in (previous visit) → show app immediately
  showApp()
  loadData()
} else {
  showLogin()
}
