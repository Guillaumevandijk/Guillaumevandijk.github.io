import { supabase, getTable } from './supabase-client.js'
import { initAuth } from './auth.js'
import { LONG_GOAL_KEYS, SHORT_GOAL_KEYS, saveProfile } from './profile.js'

const NOTES_TABLE = getTable('notes')

let profile = null
let editingGoals = false

function setText(el, value) {
  el.textContent = value
}

function renderGoalList(listId, keys) {
  const list = document.getElementById(listId)
  list.innerHTML = ''

  keys.forEach((key, index) => {
    const li = document.createElement('li')
    const value = profile?.[key]?.trim() ?? ''

    if (editingGoals) {
      const input = document.createElement('input')
      input.type = 'text'
      input.dataset.goalKey = key
      input.value = value
      input.placeholder = `Doel ${index + 1}`
      li.appendChild(input)
    } else {
      const span = document.createElement('span')
      setText(span, value || `Doel ${index + 1} — nog leeg`)
      span.className = value ? '' : 'goal-empty'
      li.appendChild(span)
    }

    list.appendChild(li)
  })
}

function renderGoals() {
  renderGoalList('longGoals', LONG_GOAL_KEYS)
  renderGoalList('shortGoals', SHORT_GOAL_KEYS)

  const changeBtn = document.getElementById('changeGoalsBtn')
  const saveBtn = document.getElementById('saveGoalsBtn')
  const cancelBtn = document.getElementById('cancelGoalsBtn')
  changeBtn.hidden = editingGoals
  saveBtn.hidden = !editingGoals
  cancelBtn.hidden = !editingGoals
}

function goalUpdatesFromInputs() {
  const updates = {}
  document.querySelectorAll('input[data-goal-key]').forEach(input => {
    updates[input.dataset.goalKey] = input.value.trim() || null
  })
  return updates
}

async function onSaveGoals() {
  const { data, error } = await saveProfile(goalUpdatesFromInputs())
  if (error) {
    console.error(error)
    alert('Kon doelen niet opslaan.')
    return
  }
  profile = data
  editingGoals = false
  renderGoals()
}

function renderNotes(rows) {
  const tableBody = document.getElementById('notesTableBody')
  tableBody.innerHTML = ''

  rows.forEach(item => {
    const row = document.createElement('tr')
    const textCell = document.createElement('td')
    const dateCell = document.createElement('td')
    setText(textCell, item.text)
    setText(dateCell, new Date(item.created_at).toLocaleString())
    row.append(textCell, dateCell)
    tableBody.appendChild(row)
  })
}

async function loadNotes() {
  const { data, error } = await supabase
    .from(NOTES_TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error(error)
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
      await supabase.auth.signOut()
    }
    return
  }

  renderNotes(data ?? [])
}

async function addNote() {
  const input = document.getElementById('noteInput')
  const text = input.value.trim()
  if (!text) {
    alert('Schrijf eerst een notitie.')
    return
  }

  const { error } = await supabase
    .from(NOTES_TABLE)
    .insert([{ text }])

  if (error) {
    console.error(error)
    alert('Kon niet opslaan. Ben je ingelogd?')
    return
  }

  input.value = ''
  await loadNotes()
}

initAuth({
  onAuthenticated: loaded => {
    profile = loaded
    editingGoals = false
    renderGoals()
    loadNotes()
  },
})

document.getElementById('changeGoalsBtn').addEventListener('click', () => {
  editingGoals = true
  renderGoals()
})

document.getElementById('cancelGoalsBtn').addEventListener('click', () => {
  editingGoals = false
  renderGoals()
})

document.getElementById('saveGoalsBtn').addEventListener('click', onSaveGoals)
document.getElementById('addNoteBtn').addEventListener('click', addNote)
