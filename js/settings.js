import { initAuth } from './auth.js'
import { PAGES, saveProfile, applyNav } from './profile.js'

let profile = null

function renderPages() {
  const enabled = new Set(profile?.enabled_pages ?? PAGES.map(page => page.key))
  const list = document.getElementById('pagesList')
  list.innerHTML = ''

  for (const page of PAGES) {
    const li = document.createElement('li')
    const label = document.createElement('label')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.dataset.page = page.key
    input.checked = enabled.has(page.key)
    label.append(input, document.createTextNode(` ${page.label}`))
    li.appendChild(label)
    list.appendChild(li)
  }
}

function selectedPages() {
  return [...document.querySelectorAll('#pagesList input[data-page]:checked')]
    .map(input => input.dataset.page)
}

async function onPagesChange() {
  const { data, error } = await saveProfile({ enabled_pages: selectedPages() })
  if (error) {
    console.error(error)
    alert('Kon instellingen niet opslaan.')
    return
  }

  profile = data
  applyNav(profile)
  renderPages()
}

initAuth({
  onAuthenticated: loaded => {
    profile = loaded
    renderPages()
  },
})

document.getElementById('pagesList').addEventListener('change', onPagesChange)
