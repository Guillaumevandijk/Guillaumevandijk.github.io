/**
 * script.js — older / alternate version of the app (NOT used by the live site)
 *
 * index.html loads app.js instead (see: <script type="module" src="app.js">).
 * This file is kept for learning and comparison. It expects a different HTML setup:
 *   - input id="noteInput"
 *   - container id="entries"
 *   - Supabase table named "entries"
 *   - A <script> tag that loads Supabase globally as window.supabase
 *
 * Differences from app.js:
 *   - No ES modules (no import) — uses window.supabase from a CDN script tag
 *   - No login / auth
 *   - Different table and element IDs
 *   - Adds items when you press Enter (keypress listener)
 */

// -----------------------------------------------------------------------------
// 1. CREATE SUPABASE CLIENT (classic script tag approach)
// -----------------------------------------------------------------------------

// This assumes you added something like this in index.html BEFORE this file:
//   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
// That CDN script attaches the library to `window.supabase`.
//
// Placeholder values — replace with your real project URL and anon key
// (Supabase → Project Settings → API), same as in app.js.
const supabase = window.supabase.createClient(
  "YOUR_URL",
  "YOUR_ANON_KEY"
);

// -----------------------------------------------------------------------------
// 2. LINK TO HTML (DOM)
// -----------------------------------------------------------------------------

// Grabs the text input once at load time (must exist in HTML as id="noteInput").
// If the element is missing, `input` will be null and later code will throw.
const input = document.getElementById("noteInput");

// -----------------------------------------------------------------------------
// 3. FETCH DATA FROM SUPABASE (READ)
// -----------------------------------------------------------------------------

/**
 * Loads all rows from the "entries" table and renders them as divs.
 * `async` lets us use `await` while waiting for the network response.
 */
async function loadEntries() {

  // Query: table "entries", all columns, newest first.
  // Returns { data, error } — same pattern as app.js.
  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .order("created_at", { ascending: false });

  // NOTE: Unlike app.js, this version does NOT check `error`.
  // If the request fails, `data` may be null and the next line can crash.
  // Always check error in production code (see app.js loadData).

  // Container where each entry will be appended (id="entries" in HTML).
  const container = document.getElementById("entries");

  // Clear previous content before re-rendering the full list.
  container.innerHTML = "";

  // Loop over each database row and build DOM elements for it.
  data.forEach(entry => {

    const div = document.createElement("div");
    div.className = "entry";

    // Build HTML for this item: main text + formatted timestamp.
    div.innerHTML = `
      <div>${entry.text}</div>
      <div class="time">
        ${new Date(entry.created_at).toLocaleString()}
      </div>
    `;

    container.appendChild(div);
  });
}

// -----------------------------------------------------------------------------
// 4. ADD A NEW ROW (CREATE)
// -----------------------------------------------------------------------------

async function addEntry() {

  const text = input.value;

  // Skip empty submissions (no .trim() here — spaces-only would still insert).
  if (!text) return;

  // Insert one row. Shape: { text: "..." } must match your Supabase columns.
  // No error handling — if RLS blocks the insert, you won't see an alert.
  await supabase
    .from("entries")
    .insert({
      text: text
    });

  input.value = "";

  // Refresh the list so the new item appears.
  loadEntries();
}

// -----------------------------------------------------------------------------
// 5. EVENT LISTENER — ENTER KEY TO SUBMIT
// -----------------------------------------------------------------------------

// "keypress" fires when a key is pressed while the input is focused.
// app.js uses a button click instead; both patterns are common.
input.addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    addEntry();
  }
});

// -----------------------------------------------------------------------------
// 6. STARTUP — LOAD LIST WHEN PAGE OPENS
// -----------------------------------------------------------------------------

// Called once when the script runs (no auth check, no login screen).
loadEntries();
