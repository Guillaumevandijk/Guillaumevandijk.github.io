import { supabase, getTable } from './supabase-client.js'
import { initAuth } from './auth.js'
import { saveProfile } from './profile.js'
import { NUTRITION_FIELDS, ensureFoodHabits } from './habit-catalog.js'
import { mountHabitsSection } from './habits-ui.js'

const CHEAT_TABLE = getTable('cheat_meals')

let profile = null
let editingPlan = false
let currentUserId = null
let cheatMeals = []

function planValues() {
  return profile?.nutrition_plan && typeof profile.nutrition_plan === 'object'
    ? profile.nutrition_plan
    : {}
}

function renderPlanTitle() {
  const name = profile?.display_name?.trim() || 'Voeding'
  document.getElementById('nutritionTitle').textContent = `${name} – voedingsplan`
}

function rawPlanValue(field, stored) {
  const value = String(stored ?? '').trim()
  if (!value) return ''
  if (!field.suffix) return value
  const match = value.replace(',', '.').match(/[\d.]+/)
  return match ? match[0].replace(/\.0+$/, '') : value
}

function formatPlanLine(field, stored) {
  const raw = rawPlanValue(field, stored)
  if (!raw) {
    return { text: `${field.label} - leeg`, empty: true }
  }
  if (!field.suffix) {
    return { text: `${field.label}: ${raw}`, empty: false }
  }
  return {
    text: `${field.label}: ${field.prefix ?? ''}${raw}${field.suffix}`,
    empty: false,
  }
}

function renderPlan() {
  renderPlanTitle()
  const list = document.getElementById('nutritionList')
  list.innerHTML = ''
  const values = planValues()

  for (const field of NUTRITION_FIELDS) {
    const li = document.createElement('li')
    const stored = String(values[field.key] ?? '').trim()

    if (editingPlan) {
      const label = document.createElement('label')
      const input = document.createElement('input')
      input.type = field.suffix ? 'number' : 'text'
      if (field.suffix) {
        input.step = 'any'
        input.min = '0'
      }
      input.dataset.planKey = field.key
      input.value = rawPlanValue(field, stored)
      label.append(`${field.label}`, input)
      li.appendChild(label)
    } else {
      const line = formatPlanLine(field, stored)
      li.textContent = line.text
      if (line.empty) li.classList.add('nutrition-empty')
    }

    list.appendChild(li)
  }

  document.getElementById('changePlanBtn').hidden = editingPlan
  document.getElementById('savePlanBtn').hidden = !editingPlan
  document.getElementById('cancelPlanBtn').hidden = !editingPlan
}

function planUpdatesFromInputs() {
  const plan = { ...planValues() }
  document.querySelectorAll('#nutritionList input[data-plan-key]').forEach(input => {
    plan[input.dataset.planKey] = input.value.trim()
  })
  return plan
}

async function onSavePlan() {
  const { data, error } = await saveProfile({ nutrition_plan: planUpdatesFromInputs() })
  if (error) {
    console.error(error)
    alert('Kon voedingsplan niet opslaan. Voer eerst de nieuwste migratie uit in Supabase.')
    return
  }
  profile = data
  editingPlan = false
  renderPlan()
}

initAuth({
  onAuthenticated: async loaded => {
    profile = loaded
    editingPlan = false
    renderPlan()
    const { data: { user } } = await supabase.auth.getUser()
    currentUserId = user?.id ?? null
    if (currentUserId) {
      const { error } = await ensureFoodHabits(currentUserId)
      if (error) console.error(error)
    }
    await mountHabitsSection({
      page: 'voeding',
      container: 'habitsSection',
      heading: 'Dagelijks',
      showGrid: true,
    })
    await loadCheatMeals()
  },
})

document.getElementById('changePlanBtn').addEventListener('click', () => {
  editingPlan = true
  renderPlan()
})

document.getElementById('cancelPlanBtn').addEventListener('click', () => {
  editingPlan = false
  renderPlan()
})

document.getElementById('savePlanBtn').addEventListener('click', onSavePlan)

function renderCheatMeals() {
  const tableBody = document.getElementById('cheatMealTableBody')
  tableBody.innerHTML = ''

  for (const item of cheatMeals) {
    const row = document.createElement('tr')
    const eaten = document.createElement('td')
    const description = document.createElement('td')
    const calories = document.createElement('td')
    eaten.textContent = new Date(item.eaten_at).toLocaleString()
    description.textContent = item.description
    calories.textContent = `${item.calories}`
    row.append(eaten, description, calories)
    tableBody.appendChild(row)
  }
}

async function loadCheatMeals() {
  const { data, error } = await supabase
    .from(CHEAT_TABLE)
    .select('*')
    .order('eaten_at', { ascending: false })

  if (error) {
    console.error(error)
    return
  }

  cheatMeals = data ?? []
  renderCheatMeals()
}

function parseCalories(text) {
  const match = String(text ?? '').replace(/\s/g, '').match(/(\d{2,5})/)
  if (!match) return null
  const value = parseInt(match[1], 10)
  if (Number.isNaN(value) || value < 1 || value > 19999) return null
  return value
}

async function estimateCalories(description) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Niet ingelogd')

  const { data, error } = await supabase.functions.invoke('openai-private-proxy', {
    body: {
      model: 'gpt-5.4-nano',
      messages: [
        {
          role: 'system',
          content:
            'Je schat hoeveel kilocalorieën een maaltijd of snack bevat. Antwoord alleen met één geheel getal, zonder eenheid of uitleg.',
        },
        {
          role: 'user',
          content: `Schat het aantal kcal in deze cheat meal: ${description}`,
        },
      ],
    },
  })

  if (error) throw error
  const calories = parseCalories(data?.content)
  if (calories == null) throw new Error('Geen geldige calorienschatting')
  return calories
}

function setCheatStatus(text) {
  const status = document.getElementById('cheatMealStatus')
  status.hidden = !text
  status.textContent = text ?? ''
}

async function addCheatMeal() {
  const input = document.getElementById('cheatMealInput')
  const button = document.getElementById('addCheatMealBtn')
  const description = input.value.trim()
  if (!description) {
    alert('Vul een omschrijving in.')
    return
  }
  if (!currentUserId) {
    alert('Kon niet opslaan. Ben je ingelogd?')
    return
  }

  button.disabled = true
  setCheatStatus('AI schat de calorieën…')

  let calories
  try {
    calories = await estimateCalories(description)
  } catch (err) {
    console.error(err)
    button.disabled = false
    setCheatStatus('')
    alert('Kon de calorieën niet schatten. Probeer het opnieuw.')
    return
  }

  const { error } = await supabase
    .from(CHEAT_TABLE)
    .insert({
      user_id: currentUserId,
      description,
      calories,
      eaten_at: new Date().toISOString(),
    })

  button.disabled = false
  if (error) {
    console.error(error)
    setCheatStatus('')
    alert('Kon cheat maal niet opslaan. Voer eerst de nieuwste migratie uit in Supabase.')
    return
  }

  input.value = ''
  setCheatStatus('')
  await loadCheatMeals()
}

document.getElementById('addCheatMealBtn').addEventListener('click', addCheatMeal)
document.getElementById('cheatMealInput').addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault()
    addCheatMeal()
  }
})

