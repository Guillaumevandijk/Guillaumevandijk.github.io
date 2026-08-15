import { initAuth } from './auth.js'
import { PAGES, saveProfile, applyNav } from './profile.js'
import { supabase } from './supabase-client.js'
import {
  dateOnly,
  loadHabits,
  createHabit,
  updateHabit,
} from './habit-catalog.js'

let profile = null
let habitDefs = []
let currentUserId = null

function pagesEnabled() {
  return new Set(profile?.enabled_pages ?? PAGES.map(page => page.key))
}

function habitsPageOn() {
  return pagesEnabled().has('habits')
}

function todayKey() {
  return dateOnly(new Date())
}

function renderPages() {
  const enabled = pagesEnabled()
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

function activeHabits() {
  const today = todayKey()
  return habitDefs
    .filter(habit => !habit.ends_on || dateOnly(habit.ends_on) > today)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
}

function stoppedHabits() {
  const today = todayKey()
  return habitDefs
    .filter(habit => habit.ends_on && dateOnly(habit.ends_on) <= today)
    .sort((a, b) => a.name.localeCompare(b.name))
}

function renderActiveHabits() {
  const list = document.getElementById('habitDefsList')
  list.innerHTML = ''
  const items = activeHabits()

  if (items.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'settings-empty'
    empty.textContent = 'Nog geen gewoontes. Voeg er hieronder een toe, of kies een oude.'
    list.appendChild(empty)
    return
  }

  items.forEach(habit => {
    const li = document.createElement('li')
    li.className = 'habit-def'

    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.value = habit.name
    nameInput.setAttribute('aria-label', 'Naam')
    nameInput.addEventListener('change', async () => {
      const name = nameInput.value.trim()
      if (!name) {
        nameInput.value = habit.name
        return
      }
      const { data, error } = await updateHabit(habit.id, { name })
      if (error) {
        console.error(error)
        alert('Kon naam niet opslaan.')
        nameInput.value = habit.name
        return
      }
      Object.assign(habit, data)
    })

    const skipLabel = document.createElement('label')
    skipLabel.className = 'habit-def-skip'
    const skip = document.createElement('input')
    skip.type = 'checkbox'
    skip.checked = habit.kind === 'skip_after_run'
    skip.addEventListener('change', async () => {
      const kind = skip.checked ? 'skip_after_run' : 'normal'
      const { data, error } = await updateHabit(habit.id, { kind })
      if (error) {
        console.error(error)
        alert('Kon niet opslaan.')
        skip.checked = habit.kind === 'skip_after_run'
        return
      }
      Object.assign(habit, data)
    })
    skipLabel.append(skip, document.createTextNode(' Vrij na hardlopen'))

    const stop = document.createElement('button')
    stop.type = 'button'
    stop.className = 'settings-delete'
    stop.textContent = 'Stop'
    stop.addEventListener('click', async () => {
      const { error } = await updateHabit(habit.id, { ends_on: todayKey() })
      if (error) {
        console.error(error)
        alert('Kon gewoonte niet stoppen.')
        return
      }
      habit.ends_on = todayKey()
      renderHabitsEditor()
    })

    li.append(nameInput, skipLabel, stop)
    list.appendChild(li)
  })
}

function renderOldHabits() {
  const wrap = document.getElementById('oldHabitsWrap')
  const list = document.getElementById('oldHabitsList')
  const items = stoppedHabits()
  list.innerHTML = ''
  wrap.hidden = items.length === 0

  for (const habit of items) {
    const li = document.createElement('li')
    li.className = 'habit-def habit-def--old'

    const name = document.createElement('span')
    name.className = 'habit-def-name'
    name.textContent = habit.name

    const restore = document.createElement('button')
    restore.type = 'button'
    restore.className = 'settings-delete'
    restore.textContent = 'Opnieuw'
    restore.addEventListener('click', () => restoreHabit(habit))

    li.append(name, restore)
    list.appendChild(li)
  }
}

function renderHabitsEditor() {
  const section = document.getElementById('habitsEditor')
  section.hidden = !habitsPageOn()
  if (section.hidden) return

  renderActiveHabits()
  renderOldHabits()
}

async function restoreHabit(habit) {
  const items = activeHabits()
  const position = items.length ? Math.max(...items.map(h => h.position)) + 1 : 0
  const { data, error } = await updateHabit(habit.id, {
    ends_on: null,
    position,
  })
  if (error) {
    console.error(error)
    alert('Kon gewoonte niet opnieuw toevoegen.')
    return
  }
  Object.assign(habit, data)
  renderHabitsEditor()
}

async function refreshHabits() {
  if (!habitsPageOn()) {
    renderHabitsEditor()
    return
  }
  const { data, error } = await loadHabits()
  if (error) {
    console.error(error)
    return
  }
  habitDefs = data
  renderHabitsEditor()
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
  await refreshHabits()
}

async function onAddHabit(event) {
  event.preventDefault()
  if (!currentUserId) {
    alert('Kon niet opslaan. Ben je ingelogd?')
    return
  }

  const nameInput = document.getElementById('newHabitName')
  const name = nameInput.value.trim()
  if (!name) return

  const kind = document.getElementById('newHabitSkipRun').checked
    ? 'skip_after_run'
    : 'normal'
  const items = activeHabits()
  const position = items.length ? Math.max(...items.map(h => h.position)) + 1 : 0

  const { data, error } = await createHabit({
    userId: currentUserId,
    name,
    kind,
    position,
    startsOn: todayKey(),
  })

  if (error) {
    console.error(error)
    alert('Kon gewoonte niet toevoegen.')
    return
  }

  habitDefs.push(data)
  nameInput.value = ''
  document.getElementById('newHabitSkipRun').checked = false
  renderHabitsEditor()
}

initAuth({
  onAuthenticated: async loaded => {
    profile = loaded
    const { data: { user } } = await supabase.auth.getUser()
    currentUserId = user?.id ?? null
    renderPages()
    await refreshHabits()
  },
})

document.getElementById('pagesList').addEventListener('change', onPagesChange)
document.getElementById('addHabitForm').addEventListener('submit', onAddHabit)
