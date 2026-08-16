import { supabase, getTable } from './supabase-client.js'
import { PAGES, ALWAYS_VISIBLE, NESTED_PAGES, getCachedEnabledPages, isPageEnabled } from './profile.js'

const NAV_ITEMS = [
  { key: 'home', href: 'index.html', label: 'Home' },
  ...PAGES,
  { key: 'settings', href: 'settings.html', label: 'Profiel' },
]

function loginSection() {
  const section = document.createElement('section')
  section.id = 'loginSection'
  section.className = 'login-section'
  section.innerHTML = `
    <h1 id="loginTitle">Inloggen</h1>
    <form id="loginForm" class="login-form">
      <input id="loginEmail" type="email" placeholder="E-mail" autocomplete="username" required />
      <input id="loginPassword" type="password" placeholder="Wachtwoord" autocomplete="current-password" required />
      <input id="loginPasswordConfirm" type="password" placeholder="Wachtwoord herhalen" autocomplete="new-password" hidden />
      <button type="submit" id="loginSubmit">Inloggen</button>
    </form>
    <button type="button" id="loginModeToggle" class="login-toggle">Nog geen account? Account aanmaken</button>
    <p id="loginError" class="login-error" hidden></p>
  `
  return section
}

function navBar(currentPage) {
  const nav = document.createElement('nav')
  nav.className = 'top-nav'
  const cached = getCachedEnabledPages()

  for (const item of NAV_ITEMS) {
    if (NESTED_PAGES.has(item.key)) continue
    const link = document.createElement('a')
    link.href = item.href
    link.dataset.page = item.key
    link.textContent = item.label
    if (item.key === currentPage) link.classList.add('active')
    if (!ALWAYS_VISIBLE.has(item.key)) {
      link.hidden = cached ? !isPageEnabled(item.key, cached) : true
    }
    nav.appendChild(link)
  }

  return nav
}

function currentPageLabel() {
  const key = document.body.dataset.page
  return NAV_ITEMS.find(item => item.key === key)?.label ?? key ?? 'unknown'
}

function injectFeedback() {
  const appSection = document.getElementById('appSection')
  const logoutBtn = document.getElementById('logoutBtn')
  if (!logoutBtn) return

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.id = 'feedbackBtn'
  btn.className = 'feedback-btn'
  btn.textContent = 'Feedback'

  let actions = logoutBtn.closest('.header-actions')
  if (!actions) {
    actions = document.createElement('div')
    actions.className = 'header-actions'
    logoutBtn.replaceWith(actions)
    actions.append(btn, logoutBtn)
  } else {
    logoutBtn.before(btn)
  }

  const form = document.createElement('form')
  form.id = 'feedbackForm'
  form.className = 'feedback-form'
  form.hidden = true
  form.innerHTML = `
    <textarea id="feedbackInput" rows="3" placeholder="Feedback voor de ontwikkelaar..."></textarea>
    <button type="button" id="sendFeedbackBtn">Verstuur</button>
  `

  const header = appSection.querySelector('.app-header')
  if (header) header.after(form)
  else appSection.prepend(form)
}

function initFeedback() {
  const btn = document.getElementById('feedbackBtn')
  const form = document.getElementById('feedbackForm')
  const input = document.getElementById('feedbackInput')
  const sendBtn = document.getElementById('sendFeedbackBtn')
  if (!btn || !form || !input || !sendBtn) return

  btn.addEventListener('click', () => {
    form.hidden = !form.hidden
    if (!form.hidden) input.focus()
  })

  async function sendFeedback() {
    const text = input.value.trim()
    if (!text) {
      alert('Schrijf eerst je feedback.')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.email) {
      alert('Kon niet opslaan. Ben je ingelogd?')
      return
    }

    const { error } = await supabase
      .from(getTable('feedback'))
      .insert([{ email: user.email, text, page: currentPageLabel() }])

    if (error) {
      console.error(error)
      alert('Kon feedback niet versturen.')
      return
    }

    input.value = ''
    form.hidden = true
    alert('Bedankt, feedback is verstuurd.')
  }

  sendBtn.addEventListener('click', sendFeedback)
  form.addEventListener('submit', event => {
    event.preventDefault()
    sendFeedback()
  })
}

/** Injects shared login + nav. Call once before initAuth reads those nodes. */
export function renderShell() {
  const appSection = document.getElementById('appSection')
  document.body.prepend(loginSection())
  appSection.prepend(navBar(document.body.dataset.page))
  injectFeedback()
  initFeedback()
}
