import { PAGES } from './profile.js'

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
    <h1>Inloggen</h1>
    <form id="loginForm" class="login-form">
      <input id="loginEmail" type="email" placeholder="E-mail" autocomplete="username" required />
      <input id="loginPassword" type="password" placeholder="Wachtwoord" autocomplete="current-password" required />
      <button type="submit">Inloggen</button>
    </form>
    <p id="loginError" class="login-error" hidden></p>
  `
  return section
}

function navBar(currentPage) {
  const nav = document.createElement('nav')
  nav.className = 'top-nav'

  for (const item of NAV_ITEMS) {
    const link = document.createElement('a')
    link.href = item.href
    link.dataset.page = item.key
    link.textContent = item.label
    if (item.key === currentPage) link.classList.add('active')
    nav.appendChild(link)
  }

  return nav
}

/** Injects shared login + nav. Call once before initAuth reads those nodes. */
export function renderShell() {
  const appSection = document.getElementById('appSection')
  document.body.prepend(loginSection())
  appSection.prepend(navBar(document.body.dataset.page))
}
