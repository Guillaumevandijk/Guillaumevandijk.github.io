import { initAuth } from './auth.js'
import { PAGES, saveProfile, applyNav } from './profile.js'
import { supabase } from './supabase-client.js'
import {
  dateOnly,
  loadHabits,
  createHabit,
  updateHabit,
  deleteHabit,
  HABIT_PAGES,
} from './habit-catalog.js'
import {
  SPORT_COLORS,
  ensureDefaultSports,
  createSportType,
  updateSportType,
  deleteSportType,
} from './sport-catalog.js'

let profile = null
let habitDefs = []
let sportTypes = []
let currentUserId = null
let newSportColor = SPORT_COLORS[0]

function fillColorSwatches(container, selected, onSelect) {
  container.innerHTML = ''
  container.classList.add('sport-color-swatches')
  container.setAttribute('role', 'radiogroup')
  container.setAttribute('aria-label', 'Kleur')
  const current = (selected ?? '').toLowerCase()

  for (const color of SPORT_COLORS) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'sport-color-swatch'
    btn.style.backgroundColor = color
    btn.setAttribute('aria-label', color)
    btn.setAttribute('aria-pressed', String(color.toLowerCase() === current))
    btn.addEventListener('click', () => onSelect(color))
    container.appendChild(btn)
  }
}

function renderNewSportColors() {
  fillColorSwatches(document.getElementById('newSportColors'), newSportColor, color => {
    newSportColor = color
    renderNewSportColors()
  })
}

function pagesEnabled() {
  return new Set(profile?.enabled_pages ?? PAGES.map(page => page.key))
}

function habitsPageOn() {
  const enabled = pagesEnabled()
  return HABIT_PAGES.some(page => enabled.has(page.key))
}

function enabledHabitPages() {
  const enabled = pagesEnabled()
  return HABIT_PAGES.filter(page => enabled.has(page.key))
}

function sportPageOn() {
  return pagesEnabled().has('sport')
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
    label.append(
      input,
      document.createTextNode(
        page.key === 'run' || page.key === 'weight'
          ? ` ${page.label} (op sport pagina)`
          : ` ${page.label}`
      )
    )
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

function habitPageKey(habit) {
  return habit.page ?? 'sport'
}

function fillNewHabitPageSelect() {
  const select = document.getElementById('newHabitPage')
  if (!select) return
  const current = select.value
  select.innerHTML = ''
  for (const page of enabledHabitPages()) {
    const option = document.createElement('option')
    option.value = page.key
    option.textContent = page.label
    select.appendChild(option)
  }
  if ([...select.options].some(option => option.value === current)) {
    select.value = current
  }
  syncNewHabitSkip()
}

function syncNewHabitSkip() {
  const wrap = document.getElementById('newHabitSkipWrap')
  const skip = document.getElementById('newHabitSkipRun')
  if (!wrap) return
  const isSport = document.getElementById('newHabitPage')?.value === 'sport'
  wrap.hidden = !isSport
  if (!isSport && skip) skip.checked = false
}

function renderActiveHabits() {
  const list = document.getElementById('habitDefsList')
  list.innerHTML = ''
  const pages = enabledHabitPages()
  const items = activeHabits()

  if (pages.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'settings-empty'
    empty.textContent = 'Zet Voeding, Beweging of Slaap aan om gewoontes toe te voegen.'
    list.appendChild(empty)
    return
  }

  let shown = 0
  for (const page of pages) {
    const groupItems = items.filter(habit => habitPageKey(habit) === page.key)
    const heading = document.createElement('li')
    heading.className = 'habit-def-group'
    heading.textContent = page.label
    list.appendChild(heading)

    if (groupItems.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'settings-empty'
      empty.textContent = page.key === 'voeding'
        ? 'Vaste macros staan klaar zodra je Voeding opent.'
        : 'Nog geen gewoontes op deze pagina.'
      list.appendChild(empty)
      continue
    }

    groupItems.forEach(habit => {
      shown += 1
      list.appendChild(habitEditorRow(habit, pages))
    })
  }

  if (shown === 0 && items.length === 0) {
    return
  }
}

function habitEditorRow(habit, pages) {
  const li = document.createElement('li')
  li.className = 'habit-def'

  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.value = habit.name
  nameInput.setAttribute('aria-label', 'Naam')
  nameInput.disabled = Boolean(habit.mandatory)
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
  li.appendChild(nameInput)

  if (habit.mandatory) {
    const lock = document.createElement('span')
    lock.className = 'habit-def-lock'
    lock.textContent = 'Vast'
    li.appendChild(lock)
  } else {
    const pageSelect = document.createElement('select')
    pageSelect.setAttribute('aria-label', 'Pagina')
    for (const page of pages) {
      const option = document.createElement('option')
      option.value = page.key
      option.textContent = page.label
      option.selected = habitPageKey(habit) === page.key
      pageSelect.appendChild(option)
    }
    pageSelect.addEventListener('change', async () => {
      const page = pageSelect.value
      const updates = { page }
      if (page !== 'sport' && habit.kind === 'skip_after_run') updates.kind = 'normal'
      const { data, error } = await updateHabit(habit.id, updates)
      if (error) {
        console.error(error)
        alert('Kon pagina niet opslaan.')
        pageSelect.value = habitPageKey(habit)
        return
      }
      Object.assign(habit, data)
      renderHabitsEditor()
    })
    li.appendChild(pageSelect)

    if (habitPageKey(habit) === 'sport') {
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
      li.appendChild(skipLabel)
    }

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
    li.appendChild(stop)
  }

  return li
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
    const pageLabel = HABIT_PAGES.find(page => page.key === habitPageKey(habit))?.label
    name.textContent = pageLabel ? `${habit.name} (${pageLabel})` : habit.name

    const restore = document.createElement('button')
    restore.type = 'button'
    restore.className = 'settings-delete'
    restore.textContent = 'Opnieuw'
    restore.addEventListener('click', () => restoreHabit(habit))

    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'settings-delete'
    remove.textContent = 'Verwijderen'
    remove.addEventListener('click', () => removeOldHabit(habit))

    li.append(name, restore, remove)
    list.appendChild(li)
  }
}

function renderHabitsEditor() {
  const section = document.getElementById('habitsEditor')
  section.hidden = !habitsPageOn()
  if (section.hidden) return

  fillNewHabitPageSelect()
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

async function removeOldHabit(habit) {
  if (!confirm(`Wil je “${habit.name}” definitief verwijderen? Alle vinkjes van deze gewoonte verdwijnen ook.`)) {
    return
  }
  const { error } = await deleteHabit(habit.id)
  if (error) {
    console.error(error)
    alert('Kon gewoonte niet verwijderen.')
    return
  }
  habitDefs = habitDefs.filter(item => item.id !== habit.id)
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

function renderSportsEditor() {
  const section = document.getElementById('sportsEditor')
  section.hidden = !sportPageOn()
  if (section.hidden) return

  const list = document.getElementById('sportTypesList')
  list.innerHTML = ''

  if (sportTypes.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'settings-empty'
    empty.textContent = 'Nog geen sporten. Voeg er hieronder een toe.'
    list.appendChild(empty)
    return
  }

  sportTypes.forEach(sport => {
    const li = document.createElement('li')
    li.className = 'habit-def'

    const nameInput = document.createElement('input')
    nameInput.type = 'text'
    nameInput.value = sport.name
    nameInput.setAttribute('aria-label', 'Naam')
    nameInput.addEventListener('change', async () => {
      const name = nameInput.value.trim()
      if (!name) {
        nameInput.value = sport.name
        return
      }
      const { data, error } = await updateSportType(sport.id, { name })
      if (error) {
        console.error(error)
        alert(error.code === '23505' ? 'Die sport bestaat al.' : 'Kon naam niet opslaan.')
        nameInput.value = sport.name
        return
      }
      Object.assign(sport, data)
    })

    const swatches = document.createElement('div')
    fillColorSwatches(swatches, sport.color, async color => {
      const { data, error } = await updateSportType(sport.id, { color })
      if (error) {
        console.error(error)
        alert('Kon kleur niet opslaan.')
        renderSportsEditor()
        return
      }
      Object.assign(sport, data)
      renderSportsEditor()
    })

    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'settings-delete'
    remove.textContent = 'Verwijderen'
    remove.addEventListener('click', async () => {
      if (!confirm(`Wil je ${sport.name} verwijderen? Geplande en gedane sessies van deze sport verdwijnen ook.`)) {
        return
      }
      const { error } = await deleteSportType(sport.id)
      if (error) {
        console.error(error)
        alert('Kon sport niet verwijderen.')
        return
      }
      sportTypes = sportTypes.filter(item => item.id !== sport.id)
      renderSportsEditor()
    })

    li.append(nameInput, swatches, remove)
    list.appendChild(li)
  })
}

async function refreshSports() {
  if (!sportPageOn()) {
    renderSportsEditor()
    return
  }
  const { data, error } = await ensureDefaultSports(currentUserId)
  if (error) {
    console.error(error)
    return
  }
  sportTypes = data
  renderSportsEditor()
  renderNewSportColors()
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
  await refreshSports()
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

  const page = document.getElementById('newHabitPage')?.value
  if (!enabledHabitPages().some(item => item.key === page)) {
    alert('Kies Voeding, Beweging of Slaap.')
    return
  }

  const kind = page === 'sport' && document.getElementById('newHabitSkipRun').checked
    ? 'skip_after_run'
    : 'normal'
  const items = activeHabits().filter(habit => habitPageKey(habit) === page)
  const position = items.length ? Math.max(...items.map(h => h.position)) + 1 : 0

  const { data, error } = await createHabit({
    userId: currentUserId,
    name,
    kind,
    position,
    startsOn: todayKey(),
    page,
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

async function onAddSport(event) {
  event.preventDefault()
  if (!currentUserId) {
    alert('Kon niet opslaan. Ben je ingelogd?')
    return
  }

  const nameInput = document.getElementById('newSportName')
  const name = nameInput.value.trim()
  if (!name) return

  const color = newSportColor
  const position = sportTypes.length
    ? Math.max(...sportTypes.map(item => item.position)) + 1
    : 0

  const { data, error } = await createSportType({
    userId: currentUserId,
    name,
    color,
    position,
  })

  if (error) {
    console.error(error)
    alert(error.code === '23505' ? 'Die sport bestaat al.' : 'Kon sport niet toevoegen.')
    return
  }

  sportTypes.push(data)
  nameInput.value = ''
  newSportColor = SPORT_COLORS[0]
  renderNewSportColors()
  renderSportsEditor()
}

initAuth({
  onAuthenticated: async loaded => {
    profile = loaded
    const { data: { user } } = await supabase.auth.getUser()
    currentUserId = user?.id ?? null
    renderPages()
    await refreshHabits()
    await refreshSports()
  },
})

document.getElementById('pagesList').addEventListener('change', onPagesChange)
document.getElementById('addHabitForm').addEventListener('submit', onAddHabit)
document.getElementById('newHabitPage')?.addEventListener('change', syncNewHabitSkip)
document.getElementById('addSportForm').addEventListener('submit', onAddSport)
