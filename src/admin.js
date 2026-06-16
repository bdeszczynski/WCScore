const DATA_URL = new URL("../public/data/world-cup.json", import.meta.url);
const MANUAL_RESULTS_URL = new URL("../public/data/manual-results.json", import.meta.url);
const DEFAULT_NOTES =
  'Manual match result overrides. Keep matches empty unless the API result needs a correction. Shape: {"id":"537327","status":"finished","homeGoals":2,"awayGoals":1,"winnerAfterPenalties":null,"note":"optional"}. Overrides are applied after API refreshes and win until removed.';

const state = {
  matches: [],
  manualResults: { updatedAt: null, notes: DEFAULT_NOTES, matches: [] },
};

const elements = {
  match: document.querySelector("#admin-match"),
  context: document.querySelector("#admin-match-context"),
  homeLabel: document.querySelector("#home-score-label"),
  awayLabel: document.querySelector("#away-score-label"),
  homeGoals: document.querySelector("#home-goals"),
  awayGoals: document.querySelector("#away-goals"),
  penaltyWinner: document.querySelector("#penalty-winner"),
  note: document.querySelector("#result-note"),
  form: document.querySelector("#result-form"),
  remove: document.querySelector("#remove-override"),
  output: document.querySelector("#manual-results-output"),
  copy: document.querySelector("#copy-manual-results"),
  download: document.querySelector("#download-manual-results"),
  status: document.querySelector("#admin-status"),
};

function fmtDate(value) {
  if (!value) return "Kickoff TBC";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Dubai",
  }).format(new Date(value));
}

function matchLabel(match) {
  const matchNumber = match.matchNumber ? `#${match.matchNumber} ` : "";
  return `${matchNumber}${match.homeTeam} vs ${match.awayTeam} - ${fmtDate(match.kickoff)}`;
}

function selectedMatch() {
  return state.matches.find((match) => String(match.id) === elements.match.value) || null;
}

function overrideFor(matchId) {
  return state.manualResults.matches.find((match) => String(match.id) === String(matchId)) || null;
}

function renderOutput() {
  const payload = {
    updatedAt: state.manualResults.matches.length ? new Date().toISOString() : null,
    notes: state.manualResults.notes || DEFAULT_NOTES,
    matches: state.manualResults.matches,
  };
  elements.output.value = `${JSON.stringify(payload, null, 2)}\n`;
}

function renderPenaltyOptions(match) {
  elements.penaltyWinner.innerHTML = "";
  for (const [value, label] of [
    ["", "None"],
    [match.homeTeam, match.homeTeam],
    [match.awayTeam, match.awayTeam],
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    elements.penaltyWinner.append(option);
  }
}

function renderSelectedMatch() {
  const match = selectedMatch();
  if (!match) return;

  const existing = overrideFor(match.id);
  elements.homeLabel.textContent = `${match.homeTeam} goals`;
  elements.awayLabel.textContent = `${match.awayTeam} goals`;
  renderPenaltyOptions(match);

  elements.homeGoals.value = existing?.homeGoals ?? (match.status === "finished" ? match.homeGoals : "");
  elements.awayGoals.value = existing?.awayGoals ?? (match.status === "finished" ? match.awayGoals : "");
  elements.penaltyWinner.value = existing?.winnerAfterPenalties || "";
  elements.note.value = existing?.note || "";
  elements.remove.disabled = !existing;

  const currentScore =
    match.status === "finished" ? `${match.homeGoals}-${match.awayGoals}${match.winnerAfterPenalties ? `, ${match.winnerAfterPenalties} won pens` : ""}` : "Not finished";
  elements.context.textContent = existing
    ? `Override exists. Current generated result: ${currentScore}.`
    : `Current generated result: ${currentScore}.`;
}

function renderMatches() {
  elements.match.innerHTML = "";
  for (const match of state.matches) {
    const option = document.createElement("option");
    option.value = match.id;
    option.textContent = matchLabel(match);
    elements.match.append(option);
  }
  renderSelectedMatch();
  renderOutput();
}

function sortedMatches(matches) {
  return [...matches].sort((a, b) => {
    const kickoffA = a.kickoff ? Date.parse(a.kickoff) : Number.POSITIVE_INFINITY;
    const kickoffB = b.kickoff ? Date.parse(b.kickoff) : Number.POSITIVE_INFINITY;
    return kickoffA - kickoffB || Number(a.matchNumber || 0) - Number(b.matchNumber || 0);
  });
}

function setStatus(message) {
  elements.status.textContent = message;
}

async function loadJson(url) {
  const response = await fetch(`${url}?t=${Date.now()}`);
  if (!response.ok) throw new Error(`Could not load ${url.pathname}`);
  return response.json();
}

async function loadData() {
  const [data, manualResults] = await Promise.all([loadJson(DATA_URL), loadJson(MANUAL_RESULTS_URL)]);
  state.matches = sortedMatches(data.matches || []);
  state.manualResults = {
    updatedAt: manualResults.updatedAt || null,
    notes: manualResults.notes || DEFAULT_NOTES,
    matches: Array.isArray(manualResults.matches) ? manualResults.matches : [],
  };
  renderMatches();
}

function saveOverride(event) {
  event.preventDefault();
  const match = selectedMatch();
  if (!match) return;

  const homeGoals = Number(elements.homeGoals.value);
  const awayGoals = Number(elements.awayGoals.value);
  if (!Number.isInteger(homeGoals) || homeGoals < 0 || !Number.isInteger(awayGoals) || awayGoals < 0) {
    setStatus("Enter whole-number goals for both teams.");
    return;
  }

  const next = {
    id: String(match.id),
    status: "finished",
    homeGoals,
    awayGoals,
    winnerAfterPenalties: elements.penaltyWinner.value || null,
  };
  if (elements.note.value.trim()) next.note = elements.note.value.trim();

  state.manualResults.matches = state.manualResults.matches.filter((entry) => String(entry.id) !== String(match.id));
  state.manualResults.matches.push(next);
  state.manualResults.matches.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  renderSelectedMatch();
  renderOutput();
  setStatus("Override prepared. Copy the JSON into manual-results.json, commit it, then run Refresh data.");
}

function removeOverride() {
  const match = selectedMatch();
  if (!match) return;
  state.manualResults.matches = state.manualResults.matches.filter((entry) => String(entry.id) !== String(match.id));
  renderSelectedMatch();
  renderOutput();
  setStatus("Override removed from the prepared JSON.");
}

async function copyOutput() {
  try {
    await navigator.clipboard.writeText(elements.output.value);
    setStatus("Copied. Paste it into manual-results.json, commit it, then run Refresh data.");
  } catch {
    elements.output.focus();
    elements.output.select();
    setStatus("Copy failed. Select the JSON text manually from the box.");
  }
}

function downloadOutput() {
  const blob = new Blob([elements.output.value], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "manual-results.json";
  link.click();
  URL.revokeObjectURL(url);
  setStatus("Downloaded manual-results.json.");
}

elements.match.addEventListener("change", renderSelectedMatch);
elements.form.addEventListener("submit", saveOverride);
elements.remove.addEventListener("click", removeOverride);
elements.copy.addEventListener("click", copyOutput);
elements.download.addEventListener("click", downloadOutput);

loadData().catch((error) => {
  setStatus(error.message);
});
