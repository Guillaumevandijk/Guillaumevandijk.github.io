const supabase = window.supabase.createClient(
  "YOUR_URL",
  "YOUR_ANON_KEY"
);

const input = document.getElementById("noteInput");

async function loadEntries() {

  const { data, error } = await supabase
    .from("entries")
    .select("*")
    .order("created_at", { ascending: false });

  const container = document.getElementById("entries");

  container.innerHTML = "";

  data.forEach(entry => {

    const div = document.createElement("div");
    div.className = "entry";

    div.innerHTML = `
      <div>${entry.text}</div>
      <div class="time">
        ${new Date(entry.created_at).toLocaleString()}
      </div>
    `;

    container.appendChild(div);
  });
}

async function addEntry() {

  const text = input.value;

  if (!text) return;

  await supabase
    .from("entries")
    .insert({
      text: text
    });

  input.value = "";

  loadEntries();
}

input.addEventListener("keypress", function(event) {
  if (event.key === "Enter") {
    addEntry();
  }
});

loadEntries();
