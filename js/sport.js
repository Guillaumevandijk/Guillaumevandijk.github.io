import { supabase, getTable } from './supabase-client.js'
import { initAuth } from './auth.js'
import { getCachedEnabledPages } from './profile.js'
import { getTodayDate, onDevTodayChange } from './dev-today.js'
import {
  dateOnly,
  ensureDefaultSports,
  loadSportSessions,
  createSportSession,
  updateSportSession,
  deleteSportSession,
  deletePlannedSessionsInRange,
  loadSportTemplates,
  createSportTemplate,
  deleteSportTemplate,
} from './sport-catalog.js'

let sportTypes = []
let sessions = []
let todayKey = ''
let currentUserId = null
let planningMode = false
let showingTemplates = false
let templates = []
let enabledPages = []
/** @type {{ dateKey: string, mode: 'pick' | 'actions' | 'complete' | 'edit', sessionId?: string } | null} */
let editor = null

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function addDaysToKey(dateKey, days) {
  const date = parseDateKey(dateKey)
  date.setDate(date.getDate() + days)
  return dateOnly(date)
}

function mondayOfWeek(dateKey) {
  const date = parseDateKey(dateKey)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return dateOnly(date)
}

function isoWeekNumber(dateKey) {
  const date = parseDateKey(dateKey)
  const thursday = new Date(date)
  thursday.setDate(date.getDate() + (4 - (date.getDay() || 7)))
  const yearStart = new Date(thursday.getFullYear(), 0, 1)
  return Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7)
}

function formatDayLabel(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
}

function typeById(id) {
  return sportTypes.find(type => type.id === id) ?? null
}

function sessionById(id) {
  return sessions.find(item => item.id === id) ?? null
}

function sessionsOn(dateKey) {
  return sessions
    .filter(item => dateOnly(item.session_date) === dateKey)
    .sort((a, b) => {
      const nameA = typeById(a.sport_type_id)?.name ?? ''
      const nameB = typeById(b.sport_type_id)?.name ?? ''
      return nameA.localeCompare(nameB)
    })
}

function availableTypesOn(dateKey, keepTypeId = null) {
  const used = new Set(
    sessionsOn(dateKey)
      .map(item => item.sport_type_id)
      .filter(id => id !== keepTypeId)
  )
  return sportTypes.filter(type => !used.has(type.id))
}

function contrastColor(hex) {
  const value = (hex ?? '').replace('#', '')
  if (value.length !== 6) return '#fff'
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#111' : '#fff'
}

function washColor(hex) {
  const value = (hex ?? '').replace('#', '')
  if (value.length !== 6) return '#f1f5f9'
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, 0.18)`
}

function chipLabel(name) {
  return name?.trim() || '?'
}

function isRunSport(type) {
  return type?.name.trim().toLowerCase() === 'hardlopen'
}

/** "6:25" → seconds per km. */
function parseTempoInput(value) {
  const match = String(value ?? '').trim().match(/^(\d+):(\d{1,2})$/)
  if (!match) return null
  const minutes = parseInt(match[1], 10)
  const seconds = parseInt(match[2], 10)
  if (seconds >= 60) return null
  return minutes * 60 + seconds
}

function formatTempo(secondsPerKm) {
  if (secondsPerKm == null) return '—'
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.round(secondsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

function dateKeyToNoonIso(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0).toISOString()
}

function applyChipStyle(el, type, done) {
  const color = type?.color ?? '#64748b'
  if (done) {
    el.style.backgroundColor = color
    el.style.color = contrastColor(color)
    el.style.borderColor = color
  } else {
    el.style.backgroundColor = washColor(color)
    el.style.color = color
    el.style.borderColor = color
  }
}

function saveErrorMessage(error) {
  if (error?.code === '23505') return 'Die sport staat al op deze dag.'
  return 'Kon niet opslaan. Ben je ingelogd?'
}

function closeEditor() {
  editor = null
  renderEditor()
}

function openPicker(dateKey) {
  if (availableTypesOn(dateKey).length === 0) {
    alert('Alle sporten staan al op deze dag. Voeg er een toe in Profiel.')
    return
  }
  editor = { dateKey, mode: 'pick' }
  renderEditor()
}

function openSession(session) {
  const dateKey = dateOnly(session.session_date)
  if (!planningMode && dateKey > todayKey) return

  if (!planningMode) {
    editor = { dateKey, sessionId: session.id, mode: 'complete' }
    renderEditor()
    return
  }

  editor = {
    dateKey,
    sessionId: session.id,
    mode: session.status === 'done' ? 'edit' : 'actions',
  }
  renderEditor()
}

function setGreyCell(td, dateKey) {
  td.className = 'habits-cell habits-cell--inactive'
  if (dateKey === todayKey) td.classList.add('habits-cell--today')
  td.textContent = ''
}

function fillChipStack(td, dateKey, items, { interactive, allowAdd }) {
  td.className = `habits-cell sport-day-cell${dateKey === todayKey ? ' habits-cell--today' : ''}`
  td.dataset.date = dateKey
  const stack = document.createElement('div')
  stack.className = 'sport-chip-stack'

  for (const session of items) {
    const type = typeById(session.sport_type_id)
    const chip = document.createElement(interactive ? 'button' : 'span')
    chip.className = `sport-chip ${session.status === 'done' ? 'sport-chip--done' : 'sport-chip--planned'}`
    chip.textContent = chipLabel(type?.name)
    applyChipStyle(chip, type, session.status === 'done')
    if (session.status === 'done') {
      const bits = []
      if (session.rating != null) bits.push(`Gevoel ${session.rating}`)
      if (session.note?.trim()) bits.push(session.note.trim())
      chip.title = bits.join(' · ') || type?.name || ''
    } else {
      chip.title = type ? `${type.name} — gepland` : 'Gepland'
    }
    if (interactive) {
      chip.type = 'button'
      chip.dataset.sessionId = session.id
    }
    stack.appendChild(chip)
  }

  if (allowAdd) {
    const add = document.createElement('button')
    add.type = 'button'
    add.className = 'sport-chip sport-chip--add'
    add.dataset.addDate = dateKey
    add.textContent = items.length ? '+' : '＋'
    add.setAttribute('aria-label', 'Sport plannen')
    stack.appendChild(add)
  }

  td.appendChild(stack)
}

function sessionDateKeys() {
  return sessions.map(item => dateOnly(item.session_date)).filter(Boolean)
}

function renderPlanGrid() {
  const tbody = document.getElementById('sportPlanBody')
  tbody.innerHTML = ''
  const thisMonday = mondayOfWeek(todayKey)
  const nextMonday = addDaysToKey(thisMonday, 7)
  const dates = sessionDateKeys()
  const earliest = dates.length
    ? dates.reduce((min, key) => (key < min ? key : min))
    : todayKey
  const latest = dates.length
    ? dates.reduce((max, key) => (key > max ? key : max))
    : todayKey

  const startMonday = mondayOfWeek(earliest < todayKey ? earliest : todayKey)
  let endMonday = planningMode ? nextMonday : thisMonday
  const latestMonday = mondayOfWeek(latest)
  if (latestMonday > endMonday) endMonday = latestMonday

  const planUntil = addDaysToKey(nextMonday, 6)

  for (let monday = endMonday; monday >= startMonday; monday = addDaysToKey(monday, -7)) {
    const tr = document.createElement('tr')
    const weekTh = document.createElement('th')
    weekTh.scope = 'row'
    if (planningMode) {
      const save = document.createElement('button')
      save.type = 'button'
      save.className = 'sport-week-save'
      save.dataset.saveWeek = monday
      save.textContent = `W${isoWeekNumber(monday)}`
      save.title = 'Week opslaan als template'
      weekTh.appendChild(save)
    } else {
      weekTh.textContent = `W${isoWeekNumber(monday)}`
    }
    tr.appendChild(weekTh)

    for (let d = 0; d < 7; d++) {
      const dateKey = addDaysToKey(monday, d)
      const td = document.createElement('td')
      const items = sessionsOn(dateKey)
      const canPlan = planningMode && dateKey >= thisMonday && dateKey <= planUntil

      if (items.length === 0 && !canPlan) {
        setGreyCell(td, dateKey)
      } else {
        fillChipStack(td, dateKey, items, {
          interactive: planningMode || dateKey <= todayKey,
          allowAdd: canPlan,
        })
      }

      tr.appendChild(td)
    }

    tbody.appendChild(tr)
  }
}

function itemsForWeekday(template, weekday) {
  return (template.items ?? [])
    .filter(item => item.weekday === weekday)
    .sort((a, b) => {
      const nameA = typeById(a.sport_type_id)?.name ?? ''
      const nameB = typeById(b.sport_type_id)?.name ?? ''
      return nameA.localeCompare(nameB)
    })
}

function fillTemplateDay(td, items) {
  if (items.length === 0) {
    setGreyCell(td)
    return
  }

  td.className = 'habits-cell sport-day-cell'
  const stack = document.createElement('div')
  stack.className = 'sport-chip-stack'
  for (const item of items) {
    const type = typeById(item.sport_type_id)
    const chip = document.createElement('span')
    chip.className = 'sport-chip sport-chip--planned'
    chip.textContent = chipLabel(type?.name)
    applyChipStyle(chip, type, false)
    stack.appendChild(chip)
  }
  td.appendChild(stack)
}

function renderTemplateGrid() {
  const wrap = document.getElementById('sportTemplatesWrap')
  const hint = document.getElementById('sportTemplatesHint')
  const tbody = document.getElementById('sportTemplateBody')
  const applyBtn = document.getElementById('templateApplyBtn')

  applyBtn.hidden = !planningMode
  applyBtn.classList.toggle('forecast-toggle--active', showingTemplates)
  applyBtn.setAttribute('aria-pressed', String(showingTemplates))
  wrap.hidden = !planningMode || !showingTemplates
  tbody.innerHTML = ''

  if (wrap.hidden) return

  if (templates.length === 0) {
    hint.textContent = 'Nog geen templates. Tik op een weeknummer om die week op te slaan.'
    return
  }

  hint.textContent = 'Tik op een rij om die planning in volgende week te zetten.'

  for (const template of templates) {
    const tr = document.createElement('tr')
    tr.className = 'sport-template-row'
    tr.dataset.templateId = template.id

    const nameTh = document.createElement('th')
    nameTh.scope = 'row'
    nameTh.className = 'sport-template-name'
    const name = document.createElement('span')
    name.textContent = template.name
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'sport-template-delete'
    remove.dataset.deleteTemplate = template.id
    remove.textContent = '×'
    remove.setAttribute('aria-label', `${template.name} verwijderen`)
    nameTh.append(name, remove)
    tr.appendChild(nameTh)

    for (let d = 0; d < 7; d++) {
      const td = document.createElement('td')
      fillTemplateDay(td, itemsForWeekday(template, d))
      tr.appendChild(td)
    }

    tbody.appendChild(tr)
  }
}

function editorTitle() {
  if (!editor) return ''
  return formatDayLabel(editor.dateKey)
}

function appendActions(container, buttons) {
  const row = document.createElement('div')
  row.className = 'sport-editor-actions'
  for (const spec of buttons) {
    const btn = document.createElement('button')
    btn.type = spec.submit ? 'submit' : 'button'
    btn.textContent = spec.label
    if (spec.danger) btn.className = 'settings-delete'
    if (spec.onClick) btn.addEventListener('click', spec.onClick)
    row.appendChild(btn)
  }
  container.appendChild(row)
}

function renderPicker(container) {
  const types = availableTypesOn(editor.dateKey)
  const intro = document.createElement('p')
  intro.className = 'settings-hint'
  intro.textContent = 'Kies een sport om te plannen.'
  container.appendChild(intro)

  const pick = document.createElement('div')
  pick.className = 'sport-type-pick'
  for (const type of types) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = type.name
    applyChipStyle(btn, type, true)
    btn.addEventListener('click', () => addPlanned(type.id))
    pick.appendChild(btn)
  }
  container.appendChild(pick)
  appendActions(container, [{ label: 'Sluiten', onClick: closeEditor }])
}

function renderActions(container) {
  const session = sessionById(editor.sessionId)
  const type = typeById(session?.sport_type_id)
  const intro = document.createElement('p')
  intro.className = 'settings-hint'
  intro.textContent = type ? `${type.name} staat gepland.` : 'Geplande sport'
  container.appendChild(intro)

  appendActions(container, [
    { label: 'Wijzigen', onClick: () => { editor.mode = 'edit'; renderEditor() } },
    { label: 'Verwijderen', danger: true, onClick: () => removeSession() },
    { label: 'Sluiten', onClick: closeEditor },
  ])
}

function sportSelect(selectedId, dateKey) {
  const select = document.createElement('select')
  select.id = 'sportTypeSelect'
  for (const type of availableTypesOn(dateKey, selectedId)) {
    const option = document.createElement('option')
    option.value = type.id
    option.textContent = type.name
    if (type.id === selectedId) option.selected = true
    select.appendChild(option)
  }
  return select
}

function renderComplete(container) {
  const session = sessionById(editor.sessionId)
  const type = typeById(session?.sport_type_id)
  const run = isRunSport(type)
  const intro = document.createElement('p')
  intro.className = 'settings-hint'
  intro.textContent = type
    ? `Hoe voelde ${type.name.toLowerCase()}?`
    : 'Hoe voelde de training?'
  container.appendChild(intro)

  const form = document.createElement('form')
  form.className = 'sleep-fields sport-complete-form'
  form.innerHTML = run
    ? `
    <label>
      Afstand (km)
      <input id="sportDistanceInput" type="number" step="0.01" min="0" required />
    </label>
    <label>
      Tempo (m:ss/km)
      <input id="sportTempoInput" type="text" inputmode="numeric" placeholder="6:25" required />
    </label>
    <label>
      Kuit (1–10)
      <input id="sportRatingInput" type="number" min="1" max="10" step="1" required />
    </label>
    <label class="sleep-note-label">
      Notitie
      <input id="sportNoteInput" type="text" placeholder="Optioneel" />
    </label>
  `
    : `
    <label>
      Gevoel (1–10)
      <input id="sportRatingInput" type="number" min="1" max="10" step="1" required />
    </label>
    <label class="sleep-note-label">
      Notitie
      <input id="sportNoteInput" type="text" placeholder="Optioneel" />
    </label>
  `
  const ratingInput = form.querySelector('#sportRatingInput')
  const noteInput = form.querySelector('#sportNoteInput')
  if (session?.rating != null) ratingInput.value = session.rating
  if (session?.note) noteInput.value = session.note
  if (run) {
    const distanceInput = form.querySelector('#sportDistanceInput')
    const tempoInput = form.querySelector('#sportTempoInput')
    if (session?.distance_km != null) distanceInput.value = session.distance_km
    if (session?.tempo_seconds != null) tempoInput.value = formatTempo(session.tempo_seconds).replace('/km', '')
  }

  form.addEventListener('submit', event => {
    event.preventDefault()
    markDone()
  })
  container.appendChild(form)
  appendActions(form, [
    { label: 'Opslaan', submit: true },
    {
      label: 'Annuleren',
      onClick: () => {
        if (planningMode && session?.status === 'planned') {
          editor.mode = 'actions'
          renderEditor()
          return
        }
        closeEditor()
      },
    },
  ])
}

function renderEdit(container) {
  const session = sessionById(editor.sessionId)
  if (!session) return

  const form = document.createElement('form')
  form.className = 'sleep-fields sport-complete-form'

  const sportLabel = document.createElement('label')
  sportLabel.append('Sport', sportSelect(session.sport_type_id, editor.dateKey))
  form.appendChild(sportLabel)

  if (session.status === 'done') {
    const type = typeById(session.sport_type_id)
    if (isRunSport(type)) {
      const distanceLabel = document.createElement('label')
      const distanceInput = document.createElement('input')
      distanceInput.id = 'sportDistanceInput'
      distanceInput.type = 'number'
      distanceInput.step = '0.01'
      distanceInput.min = '0'
      distanceInput.required = true
      distanceInput.value = session.distance_km ?? ''
      distanceLabel.append('Afstand (km)', distanceInput)
      form.appendChild(distanceLabel)

      const tempoLabel = document.createElement('label')
      const tempoInput = document.createElement('input')
      tempoInput.id = 'sportTempoInput'
      tempoInput.type = 'text'
      tempoInput.inputMode = 'numeric'
      tempoInput.placeholder = '6:25'
      tempoInput.required = true
      tempoInput.value = session.tempo_seconds != null
        ? formatTempo(session.tempo_seconds).replace('/km', '')
        : ''
      tempoLabel.append('Tempo (m:ss/km)', tempoInput)
      form.appendChild(tempoLabel)
    }

    const ratingLabel = document.createElement('label')
    const ratingInput = document.createElement('input')
    ratingInput.id = 'sportRatingInput'
    ratingInput.type = 'number'
    ratingInput.min = '1'
    ratingInput.max = '10'
    ratingInput.step = '1'
    ratingInput.required = true
    ratingInput.value = session.rating ?? ''
    ratingLabel.append(isRunSport(type) ? 'Kuit (1–10)' : 'Gevoel (1–10)', ratingInput)
    form.appendChild(ratingLabel)

    const noteLabel = document.createElement('label')
    noteLabel.className = 'sleep-note-label'
    const noteInput = document.createElement('input')
    noteInput.id = 'sportNoteInput'
    noteInput.type = 'text'
    noteInput.placeholder = 'Optioneel'
    noteInput.value = session.note ?? ''
    noteLabel.append('Notitie', noteInput)
    form.appendChild(noteLabel)
  }

  form.addEventListener('submit', event => {
    event.preventDefault()
    saveEdit()
  })
  container.appendChild(form)

  appendActions(form, [
    { label: 'Opslaan', submit: true },
    {
      label: 'Verwijderen',
      danger: true,
      onClick: () => removeSession(),
    },
    {
      label: 'Annuleren',
      onClick: () => {
        if (session.status === 'planned') {
          editor.mode = 'actions'
          renderEditor()
          return
        }
        closeEditor()
      },
    },
  ])
}

function renderEditor() {
  const panel = document.getElementById('sportEditor')
  panel.innerHTML = ''
  if (!editor) {
    panel.hidden = true
    return
  }

  panel.hidden = false
  const title = document.createElement('h3')
  title.textContent = editorTitle()
  panel.appendChild(title)

  if (editor.mode === 'pick') renderPicker(panel)
  else if (editor.mode === 'actions') renderActions(panel)
  else if (editor.mode === 'complete') renderComplete(panel)
  else if (editor.mode === 'edit') renderEdit(panel)

  panel.scrollIntoView({ block: 'nearest' })
}

function runPageOn() {
  return (enabledPages.length ? enabledPages : getCachedEnabledPages() ?? []).includes('run')
}

function renderDoneTable() {
  const tableBody = document.getElementById('sportDoneTableBody')
  tableBody.innerHTML = ''
  const showRun = runPageOn()
  document.querySelectorAll('[data-run-col]').forEach(el => {
    el.hidden = !showRun
  })

  const done = sessions
    .filter(item => item.status === 'done')
    .sort((a, b) => dateOnly(b.session_date).localeCompare(dateOnly(a.session_date)))

  for (const item of done) {
    const type = typeById(item.sport_type_id)
    const tr = document.createElement('tr')
    const cells = [
      parseDateKey(dateOnly(item.session_date)).toLocaleDateString('nl-NL', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
      type?.name ?? '—',
      item.rating ?? '—',
    ]
    if (showRun) {
      cells.push(
        item.distance_km != null ? `${Number(item.distance_km)} km` : '—',
        item.tempo_seconds != null ? formatTempo(item.tempo_seconds) : '—',
      )
    }
    cells.push(item.note?.trim() || '—')
    for (const text of cells) {
      const td = document.createElement('td')
      td.textContent = text
      tr.appendChild(td)
    }
    tableBody.appendChild(tr)
  }
}

function renderAll() {
  renderPlanGrid()
  renderTemplateGrid()
  renderEditor()
  renderDoneTable()
}

function replaceSession(row) {
  const index = sessions.findIndex(item => item.id === row.id)
  if (index >= 0) sessions[index] = row
  else sessions.push(row)
}

async function addPlanned(sportTypeId) {
  if (!currentUserId || !editor) return
  const { data, error } = await createSportSession({
    userId: currentUserId,
    sportTypeId,
    sessionDate: editor.dateKey,
  })
  if (error) {
    console.error(error)
    alert(saveErrorMessage(error))
    return
  }
  replaceSession(data)
  closeEditor()
  renderAll()
}

function readCompleteFields(type) {
  const rating = parseInt(document.getElementById('sportRatingInput').value, 10)
  if (Number.isNaN(rating) || rating < 1 || rating > 10) {
    alert(isRunSport(type) ? 'Kuit cijfer moet tussen 1 en 10 zijn.' : 'Gevoel moet tussen 1 en 10 zijn.')
    return null
  }

  const note = document.getElementById('sportNoteInput')?.value.trim() || null
  const updates = { rating, note }

  if (isRunSport(type)) {
    const distance = parseFloat(document.getElementById('sportDistanceInput').value.replace(',', '.'))
    const tempoSeconds = parseTempoInput(document.getElementById('sportTempoInput').value)
    if (Number.isNaN(distance) || distance <= 0) {
      alert('Voer een geldige afstand in (km).')
      return null
    }
    if (tempoSeconds == null) {
      alert('Voer tempo in als min:sec per km, bijv. 6:25')
      return null
    }
    updates.distance_km = distance
    updates.tempo_seconds = tempoSeconds
  }

  return updates
}

async function insertRunStat({ distanceKm, tempoSeconds, rating, dateKey }) {
  const { error } = await supabase
    .from(getTable('run_stats'))
    .insert({
      distance_km: distanceKm,
      tempo_seconds: tempoSeconds,
      rating,
      created_at: dateKeyToNoonIso(dateKey),
    })

  if (error) {
    console.error(error)
    alert('Kon de hardloopgegevens niet opslaan.')
    return false
  }
  return true
}

async function markDone() {
  const session = sessionById(editor.sessionId)
  const type = typeById(session?.sport_type_id)
  const fields = readCompleteFields(type)
  if (!fields) return

  const wasPlanned = session?.status === 'planned'
  const { data, error } = await updateSportSession(editor.sessionId, {
    status: 'done',
    ...fields,
  })
  if (error) {
    console.error(error)
    alert(saveErrorMessage(error))
    return
  }

  if (wasPlanned && isRunSport(type)) {
    const ok = await insertRunStat({
      distanceKm: fields.distance_km,
      tempoSeconds: fields.tempo_seconds,
      rating: fields.rating,
      dateKey: editor.dateKey,
    })
    if (!ok) {
      replaceSession(data)
      renderAll()
      return
    }
  }

  replaceSession(data)
  closeEditor()
  renderAll()
}

async function saveEdit() {
  const session = sessionById(editor.sessionId)
  if (!session) return

  const typeId = document.getElementById('sportTypeSelect')?.value
  const updates = {}
  if (typeId && typeId !== session.sport_type_id) updates.sport_type_id = typeId

  if (session.status === 'done') {
    const type = typeById(session.sport_type_id)
    const fields = readCompleteFields(type)
    if (!fields) return
    Object.assign(updates, fields)
  }

  if (Object.keys(updates).length === 0) {
    closeEditor()
    return
  }

  const { data, error } = await updateSportSession(session.id, updates)
  if (error) {
    console.error(error)
    alert(saveErrorMessage(error))
    return
  }
  replaceSession(data)
  closeEditor()
  renderAll()
}

async function removeSession() {
  const session = sessionById(editor.sessionId)
  const name = typeById(session?.sport_type_id)?.name ?? 'deze sport'
  if (!confirm(`Wil je ${name} verwijderen van ${formatDayLabel(editor.dateKey)}?`)) return

  const { error } = await deleteSportSession(editor.sessionId)
  if (error) {
    console.error(error)
    alert('Kon niet verwijderen.')
    return
  }
  sessions = sessions.filter(item => item.id !== editor.sessionId)
  closeEditor()
  renderAll()
}

function onPlanClick(event) {
  const saveWeek = event.target.closest('[data-save-week]')
  if (saveWeek) {
    saveWeekTemplate(saveWeek.dataset.saveWeek)
    return
  }

  const chip = event.target.closest('[data-session-id]')
  if (chip) {
    const session = sessionById(chip.dataset.sessionId)
    if (!session) return
    if (!planningMode && dateOnly(session.session_date) > todayKey) return
    openSession(session)
    return
  }

  if (!planningMode) return

  const add = event.target.closest('[data-add-date]')
  const cell = event.target.closest('td[data-date]')
  if (add || cell) {
    openPicker(add?.dataset.addDate ?? cell.dataset.date)
  }
}

function weekTemplateItems(mondayKey) {
  const items = []
  for (let d = 0; d < 7; d++) {
    const seen = new Set()
    for (const session of sessionsOn(addDaysToKey(mondayKey, d))) {
      if (seen.has(session.sport_type_id)) continue
      seen.add(session.sport_type_id)
      items.push({ weekday: d, sportTypeId: session.sport_type_id })
    }
  }
  return items
}

async function saveWeekTemplate(mondayKey) {
  const items = weekTemplateItems(mondayKey)
  if (items.length === 0) {
    alert('Deze week heeft nog geen sporten om op te slaan.')
    return
  }

  const fallback = `W${isoWeekNumber(mondayKey)}`
  const name = prompt('Naam voor deze template', fallback)?.trim()
  if (!name) return

  const { error } = await createSportTemplate({
    userId: currentUserId,
    name,
    items,
  })
  if (error) {
    console.error(error)
    alert('Kon template niet opslaan.')
    return
  }

  await refreshTemplates()
  showingTemplates = true
  renderTemplateGrid()
}

async function applyTemplate(templateId) {
  const template = templates.find(item => item.id === templateId)
  if (!template) return

  const nextMonday = addDaysToKey(mondayOfWeek(todayKey), 7)
  const nextSunday = addDaysToKey(nextMonday, 6)

  const { error: clearError } = await deletePlannedSessionsInRange(nextMonday, nextSunday)
  if (clearError) {
    console.error(clearError)
    alert('Kon bestaande planning niet vervangen.')
    return
  }

  sessions = sessions.filter(item => {
    const key = dateOnly(item.session_date)
    if (key < nextMonday || key > nextSunday) return true
    return item.status !== 'planned'
  })

  const remaining = new Set(
    sessions
      .filter(item => {
        const key = dateOnly(item.session_date)
        return key >= nextMonday && key <= nextSunday
      })
      .map(item => `${dateOnly(item.session_date)}:${item.sport_type_id}`)
  )

  const rows = (template.items ?? [])
    .filter(item => typeById(item.sport_type_id))
    .map(item => {
      const sessionDate = addDaysToKey(nextMonday, item.weekday)
      return {
        user_id: currentUserId,
        sport_type_id: item.sport_type_id,
        session_date: sessionDate,
        key: `${sessionDate}:${item.sport_type_id}`,
      }
    })
    .filter(row => !remaining.has(row.key))

  for (const row of rows) {
    const { data, error } = await createSportSession({
      userId: row.user_id,
      sportTypeId: row.sport_type_id,
      sessionDate: row.session_date,
    })
    if (error && error.code !== '23505') {
      console.error(error)
      alert(saveErrorMessage(error))
      await loadData()
      return
    }
    if (data) replaceSession(data)
  }

  showingTemplates = false
  renderAll()
}

async function removeTemplate(templateId) {
  const template = templates.find(item => item.id === templateId)
  if (!template) return
  if (!confirm(`Wil je template “${template.name}” verwijderen?`)) return

  const { error } = await deleteSportTemplate(templateId)
  if (error) {
    console.error(error)
    alert('Kon template niet verwijderen.')
    return
  }

  templates = templates.filter(item => item.id !== templateId)
  renderTemplateGrid()
}

function onTemplateClick(event) {
  const remove = event.target.closest('[data-delete-template]')
  if (remove) {
    event.stopPropagation()
    removeTemplate(remove.dataset.deleteTemplate)
    return
  }

  const row = event.target.closest('tr[data-template-id]')
  if (row) applyTemplate(row.dataset.templateId)
}

function setPlanningMode(on) {
  planningMode = on
  showingTemplates = false
  const btn = document.getElementById('planningToggle')
  btn.classList.toggle('forecast-toggle--active', on)
  btn.setAttribute('aria-pressed', String(on))
  closeEditor()
  renderAll()
}

async function refreshTemplates() {
  const { data, error } = await loadSportTemplates()
  if (error) {
    console.error(error)
    templates = []
    return
  }
  templates = data
}

async function loadData() {
  if (!currentUserId) return
  todayKey = dateOnly(getTodayDate())
  const { data: types, error: typesError } = await ensureDefaultSports(currentUserId)
  if (typesError) {
    console.error(typesError)
    alert('Kon sporten niet laden.')
    return
  }
  sportTypes = types

  const { data: rows, error: sessionsError } = await loadSportSessions()
  if (sessionsError) {
    console.error(sessionsError)
    alert('Kon planning niet laden.')
    return
  }
  sessions = rows
  await refreshTemplates()
  renderAll()
}

document.getElementById('sportPlanBody').addEventListener('click', onPlanClick)
document.getElementById('sportTemplateBody').addEventListener('click', onTemplateClick)
document.getElementById('planningToggle').addEventListener('click', () => {
  setPlanningMode(!planningMode)
})
document.getElementById('templateApplyBtn').addEventListener('click', () => {
  if (!planningMode) return
  showingTemplates = !showingTemplates
  closeEditor()
  renderTemplateGrid()
})

initAuth({
  onAuthenticated: async profile => {
    enabledPages = profile?.enabled_pages ?? getCachedEnabledPages() ?? []
    const { data: { user } } = await supabase.auth.getUser()
    currentUserId = user?.id ?? null
    await loadData()
  },
})

onDevTodayChange(() => {
  const app = document.getElementById('appSection')
  if (app && !app.hidden) loadData()
})
