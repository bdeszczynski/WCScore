import {
  aggregateTeam as aggregateTeamForMatches,
  bonusStatus as bonusStatusForMatches,
  countRemainingGroupMatches as countRemainingGroupMatchesForMatches,
  comparePlayerTotals,
  getPlayerBonusSelections,
  isFinished,
  isSameTeam,
  normalizeTeam,
  stageKind,
} from "./scoring.js?v=30";

const DATA_URL = new URL("../public/data/world-cup.json", import.meta.url);

const state = {
  data: null,
  ownerFilter: "all",
  matchFilter: "tracked",
  activeView: "score",
};

const selectedTeamNames = new Set();
const COUNTRY_CODES = {
  Algeria: "DZ",
  Argentina: "AR",
  Australia: "AU",
  Belgium: "BE",
  "Bosnia and Herzegovina": "BA",
  Brazil: "BR",
  Canada: "CA",
  Colombia: "CO",
  Czechia: "CZ",
  "DR Congo": "CD",
  Ecuador: "EC",
  Egypt: "EG",
  England: "GB-ENG",
  France: "FR",
  Germany: "DE",
  Haiti: "HT",
  Iran: "IR",
  Iraq: "IQ",
  Japan: "JP",
  Mexico: "MX",
  Morocco: "MA",
  Netherlands: "NL",
  "New Zealand": "NZ",
  Norway: "NO",
  Portugal: "PT",
  Qatar: "QA",
  Scotland: "GB-SCT",
  Senegal: "SN",
  "South Africa": "ZA",
  "South Korea": "KR",
  Spain: "ES",
  Sweden: "SE",
  Switzerland: "CH",
  Tunisia: "TN",
  Uruguay: "UY",
  Uzbekistan: "UZ",
};

const fmtDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dubai",
});

async function loadData() {
  const response = await fetch(`${DATA_URL}?t=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Could not load ${DATA_URL}`);
  }
  state.data = await response.json();
  for (const player of state.data.players) {
    player.pointsTeams.forEach((team) => selectedTeamNames.add(team.name));
    player.winnerPicks.forEach((team) => selectedTeamNames.add(team.name));
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function flagForTeam(teamName) {
  const code = COUNTRY_CODES[teamName];
  if (!code) return "";
  if (code === "GB-ENG") return "🏴";
  if (code === "GB-SCT") return "🏴";
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function teamLabel(teamName, tracked = false) {
  const flag = flagForTeam(teamName);
  return `
    <span class="team-label">
      ${tracked ? `<span class="tracked-star" aria-hidden="true">★</span>` : ""}
      ${flag ? `<span class="flag-icon" aria-hidden="true">${flag}</span>` : ""}
      <span>${escapeHtml(teamName)}</span>
    </span>
  `;
}

function ownerAvatar(owner) {
  const kind = owner === "Sara" ? "sara" : "bruno";
  const label = owner === "Sara" ? "Sara icon" : "Bruno icon";
  return `
    <span class="owner-icon ${kind}" role="img" aria-label="${label}">
      <span class="hair"></span>
      <span class="face"></span>
    </span>
  `;
}

function ownerClass(owner) {
  return owner === "Sara" ? "Sara" : "Bruno";
}

function aggregateTeam(teamName, owner) {
  return aggregateTeamForMatches(state.data.matches, teamName, owner);
}

function countRemainingGroupMatches(teamName) {
  return countRemainingGroupMatchesForMatches(state.data.matches, teamName);
}

function bonusStatus(teamName) {
  return bonusStatusForMatches(state.data.matches, teamName);
}

function getTeamOdds(teamName) {
  return state.data.odds?.teams?.find((entry) => isSameTeam(entry.team, teamName));
}

function getSelectedTeamOwner(teamName) {
  return state.data.players.find((player) => {
    return (
      player.pointsTeams.some((team) => isSameTeam(team.name, teamName)) ||
      player.winnerPicks.some((team) => isSameTeam(team.name, teamName))
    );
  })?.name;
}

function getStandings() {
  return state.data.players
    .flatMap((player) => player.pointsTeams.map((team) => aggregateTeam(team.name, player.name)))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.teamName.localeCompare(b.teamName);
    });
}

function getGoalStandings() {
  return getStandings().sort((a, b) => {
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    if (a.ga !== b.ga) return a.ga - b.ga;
    return a.teamName.localeCompare(b.teamName);
  });
}

function getPlayerTotals() {
  return state.data.players.map((player) => {
    const pointTeams = player.pointsTeams.map((team) => aggregateTeam(team.name, player.name));
    const teamPoints = pointTeams.reduce((sum, team) => sum + team.points, 0);
    const matchesPlayed = pointTeams.reduce((sum, team) => sum + team.played, 0);
    const groupMatchesRemaining = player.pointsTeams.reduce((sum, team) => sum + countRemainingGroupMatches(team.name), 0);
    const gf = pointTeams.reduce((sum, team) => sum + team.gf, 0);
    const ga = pointTeams.reduce((sum, team) => sum + team.ga, 0);
    const bonusPoints = getPlayerBonusSelections(player).reduce((sum, team) => sum + bonusStatus(team.name).points, 0);
    return {
      name: player.name,
      pointsTeams: player.pointsTeams.map((team) => team.name),
      teamPoints,
      matchesPlayed,
      groupMatchesRemaining,
      gf,
      ga,
      gd: gf - ga,
      bonusPoints,
      total: teamPoints + bonusPoints,
    };
  });
}

function renderScoreStrip() {
  const totals = getPlayerTotals();
  const displayTotals = [...totals].sort((a, b) => comparePlayerTotals(a, b) || a.name.localeCompare(b.name));
  const leader = displayTotals[0];
  const leadIsTied = displayTotals.filter((player) => comparePlayerTotals(player, leader) === 0).length > 1;
  const container = document.querySelector("#score-strip");

  container.innerHTML = displayTotals
    .map(
      (player) => `
        <article class="score-card ${ownerClass(player.name).toLowerCase()}">
          <div class="score-head">
            <div class="owner-title">
              ${ownerAvatar(player.name)}
              <h2>${escapeHtml(player.name)}</h2>
            </div>
            ${
              comparePlayerTotals(player, leader) === 0
                ? `<span class="pill leader-pill"><span class="leader-medal" role="img" aria-label="Trophy">🏆</span>${leadIsTied ? "Tied" : "Leader"}</span>`
                : `<span class="pill">${leaderStatusText(player, leader)}</span>`
            }
          </div>
          <div class="score-total">${player.total}</div>
          <div class="score-breakdown" aria-label="${escapeHtml(player.name)} score breakdown">
            <div class="stat-cell primary">
              <span>Team points</span>
              <strong>${player.teamPoints} <small>(Goal diff: ${player.gd > 0 ? "+" : ""}${player.gd})</small></strong>
            </div>
            <div class="stat-cell">
              <span>Played</span>
              <strong>${player.matchesPlayed}</strong>
            </div>
            <div class="stat-cell">
              <span>Group left</span>
              <strong>${player.groupMatchesRemaining}</strong>
            </div>
            <div class="stat-cell">
              <span>Goals for</span>
              <strong>${player.gf}</strong>
            </div>
            <div class="stat-cell">
              <span>Goals against</span>
              <strong>${player.ga}</strong>
            </div>
            <div class="stat-cell">
              <span>Bonus pts</span>
              <strong>${player.bonusPoints}</strong>
            </div>
          </div>
          <div class="selected-team-row" aria-label="${escapeHtml(player.name)} selected teams">
            ${player.pointsTeams.map((teamName) => `<span>${teamLabel(teamName)}</span>`).join("")}
          </div>
        </article>
      `,
    )
    .join("");
}

function leaderStatusText(player, leader) {
  if (leader.total !== player.total) return `${leader.total - player.total} behind`;
  if (leader.gd !== player.gd) return "Behind on goal diff";
  return "Behind on goals for";
}

function renderStandings() {
  const rows = getStandings().filter((row) => state.ownerFilter === "all" || row.owner === state.ownerFilter);
  const body = document.querySelector("#standings-body");

  body.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${teamLabel(row.teamName)}</td>
          <td><span class="owner-cell">${ownerAvatar(row.owner)} ${escapeHtml(row.owner)}</span></td>
          <td>${row.points}</td>
          <td>${row.win}</td>
          <td>${row.draw}</td>
          <td>${row.loss}</td>
          <td>${row.gf}</td>
          <td>${row.ga}</td>
          <td>${row.gd > 0 ? "+" : ""}${row.gd}</td>
          <td>${row.penaltyBonus}</td>
        </tr>
      `,
    )
    .join("");

  renderGoalStandings();
}

function renderGoalStandings() {
  const rows = getGoalStandings().filter((row) => state.ownerFilter === "all" || row.owner === state.ownerFilter);
  const container = document.querySelector("#goal-standings");

  container.innerHTML = rows
    .map(
      (row, index) => `
        <article class="goal-row">
          <div class="goal-rank">${index + 1}</div>
          <div>
            <h3>${teamLabel(row.teamName)}</h3>
            <p class="muted"><span class="owner-cell">${ownerAvatar(row.owner)} ${escapeHtml(row.owner)}</span></p>
          </div>
          <div class="goal-stats">
            <strong>${row.gd > 0 ? "+" : ""}${row.gd}</strong>
            <span>GD</span>
          </div>
          <div class="goal-stats">
            <strong>${row.gf}</strong>
            <span>GF</span>
          </div>
          <div class="goal-stats">
            <strong>${row.ga}</strong>
            <span>GA</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderOdds() {
  const topOdds = [...(state.data.odds?.teams || [])]
    .filter((entry) => Number.isFinite(Number(entry.decimal)))
    .sort((a, b) => {
      const rankA = Number.isFinite(Number(a.rank)) ? Number(a.rank) : Number.POSITIVE_INFINITY;
      const rankB = Number.isFinite(Number(b.rank)) ? Number(b.rank) : Number.POSITIVE_INFINITY;
      if (rankA !== rankB) return rankA - rankB;
      return Number(a.decimal) - Number(b.decimal);
    })
    .slice(0, 10);

  document.querySelector("#odds-list").innerHTML = topOdds
    .map((odds, index) => {
      const decimal = odds?.decimal ? Number(odds.decimal) : null;
      const implied = decimal ? `${((1 / decimal) * 100).toFixed(1)}% implied` : "No live odds";
      const owner = getSelectedTeamOwner(odds.team);
      return `
        <article class="odds-row">
          <div class="odds-main">
            <div class="odds-rank">${index + 1}</div>
            <div>
              <h3>${teamLabel(odds.team)}</h3>
              <p class="muted">${escapeHtml(odds?.bookmaker || state.data.odds?.source || "Public odds")}</p>
            </div>
          </div>
          ${owner ? `<div class="odds-owner-badge">${ownerAvatar(owner)}<span>${escapeHtml(owner)} selected</span></div>` : ""}
          <div class="odds-price">
            <strong>${decimal ? decimal.toFixed(2) : "—"}</strong>
            <span class="muted">${implied}</span>
          </div>
        </article>
      `;
    })
    .join("") || `<div class="empty-state">No winner odds loaded yet.</div>`;
}

function renderWinnerPicks() {
  document.querySelector("#winner-picks").innerHTML = state.data.players
    .map((player) => {
      const picks = getPlayerBonusSelections(player).map((team) => ({ ...team, status: bonusStatus(team.name) }));
      return `
        <section class="bonus-column ${ownerClass(player.name)}" aria-label="${escapeHtml(player.name)} bonus teams">
          <div class="bonus-column-head">
            <div class="owner-title compact">
              ${ownerAvatar(player.name)}
              <h3>${escapeHtml(player.name)}</h3>
            </div>
            <span class="pill">${picks.reduce((sum, pick) => sum + pick.status.points, 0)} pts</span>
          </div>
          <div class="bonus-list">
            ${picks
              .map(
                (pick) => `
                  <article class="winner-card ${ownerClass(player.name)}">
                    <div>
                      <h3>${teamLabel(pick.name)}</h3>
                      <p class="muted bonus-role">${escapeHtml(pick.roles.join(" + "))}</p>
                    </div>
                    <div class="winner-points">
                      <span class="pill">${pick.status.semiReached ? "Semi +3" : "Semi pending"}</span>
                      <span class="pill">${pick.status.wonCup ? "Champion +7" : "Champion pending"}</span>
                      <span class="pill">${pick.status.points} pts</span>
                    </div>
                  </article>
                `,
              )
              .join("")}
          </div>
        </section>
      `;
    })
    .join("");
}

function matchIncludesTrackedTeam(match) {
  return [...selectedTeamNames].some((team) => isSameTeam(team, match.homeTeam) || isSameTeam(team, match.awayTeam));
}

function getVisibleMatches() {
  return state.data.matches
    .filter((match) => {
      if (state.matchFilter === "tracked") return matchIncludesTrackedTeam(match);
      if (state.matchFilter === "finished") return isFinished(match);
      if (state.matchFilter === "upcoming") return !isFinished(match);
      return true;
    })
    .sort((a, b) => String(a.kickoff || "").localeCompare(String(b.kickoff || "")));
}

function formatKickoff(match) {
  if (!match.kickoff) return "Time TBC";
  const date = new Date(match.kickoff);
  if (Number.isNaN(date.getTime())) return escapeHtml(match.kickoff);
  return fmtDate.format(date);
}

function renderMatches() {
  const matches = getVisibleMatches();
  const container = document.querySelector("#match-list");
  if (!matches.length) {
    container.innerHTML = `<div class="empty-state">No matches loaded for this filter yet.</div>`;
    return;
  }

  container.innerHTML = matches
    .map((match) => {
      const homeTracked = matchIncludesTrackedTeam({ homeTeam: match.homeTeam, awayTeam: "" });
      const awayTracked = matchIncludesTrackedTeam({ homeTeam: match.awayTeam, awayTeam: "" });
      const score = isFinished(match) ? `${match.homeGoals} - ${match.awayGoals}` : "vs";
      return `
        <article class="match-card">
          <div class="match-teams">
            <div class="match-team">
              <strong>${teamLabel(match.homeTeam, homeTracked)}</strong>
              <span class="match-score">${isFinished(match) ? match.homeGoals : ""}</span>
            </div>
            <div class="match-team">
              <strong>${teamLabel(match.awayTeam, awayTracked)}</strong>
              <span class="match-score">${isFinished(match) ? match.awayGoals : ""}</span>
            </div>
          </div>
          <div class="match-meta">
            <div>${escapeHtml(match.stage || "Stage TBC")}</div>
            <div>${isFinished(match) ? score : formatKickoff(match)}</div>
            ${match.winnerAfterPenalties ? `<div>${escapeHtml(match.winnerAfterPenalties)} won pens</div>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

function getQuizTeams() {
  const names = new Set();
  for (const player of state.data.players) {
    player.pointsTeams.forEach((team) => names.add(team.name));
    player.winnerPicks.forEach((team) => names.add(team.name));
  }
  for (const match of state.data.matches) {
    names.add(match.homeTeam);
    names.add(match.awayTeam);
  }
  return [...names].filter((team) => flagForTeam(team)).sort((a, b) => a.localeCompare(b));
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function showFlagQuiz() {
  const teams = getQuizTeams();
  if (teams.length < 3) return;

  const correct = teams[Math.floor(Math.random() * teams.length)];
  const options = shuffle([correct, ...shuffle(teams.filter((team) => team !== correct)).slice(0, 2)]);
  const modal = document.createElement("section");
  modal.className = "quiz-overlay";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "quiz-title");
  modal.innerHTML = `
    <div class="quiz-dialog">
      <div class="quiz-head">
        <div>
          <p class="eyebrow">Flag quiz</p>
          <h2 id="quiz-title">Which country is this?</h2>
        </div>
        <button class="quiz-close" type="button" aria-label="Close quiz">×</button>
      </div>
      <div class="quiz-flag" aria-hidden="true">${flagForTeam(correct)}</div>
      <div class="quiz-options">
        ${options.map((team) => `<button type="button" data-quiz-answer="${escapeHtml(team)}">${escapeHtml(team)}</button>`).join("")}
      </div>
      <p class="quiz-feedback" aria-live="polite"></p>
    </div>
  `;

  const close = () => modal.remove();
  modal.querySelector(".quiz-close").addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
  modal.querySelectorAll("[data-quiz-answer]").forEach((button) => {
    button.addEventListener("click", () => {
      const picked = button.dataset.quizAnswer;
      const right = isSameTeam(picked, correct);
      modal.querySelectorAll("[data-quiz-answer]").forEach((item) => {
        item.disabled = true;
        item.classList.toggle("correct", isSameTeam(item.dataset.quizAnswer, correct));
        item.classList.toggle("wrong", item === button && !right);
      });
      const feedback = modal.querySelector(".quiz-feedback");
      feedback.textContent = right ? "Correct." : `It was ${correct}.`;
      setTimeout(close, right ? 850 : 1400);
    });
  });

  document.body.append(modal);
}

function renderMeta() {
  const updated = state.data.updatedAt ? fmtDate.format(new Date(state.data.updatedAt)) : "Never";
  const source = state.data.source ? ` · ${state.data.source}` : "";
  document.querySelector("#last-updated").textContent = `Last updated ${updated} Dubai time${source}`;
}

function bindEvents() {
  document.querySelectorAll("[data-view-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      switchView(button.dataset.viewTab);
    });
  });

  document.querySelectorAll("[data-owner-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.ownerFilter = button.dataset.ownerFilter;
      document.querySelectorAll("[data-owner-filter]").forEach((item) => item.classList.toggle("active", item === button));
      renderStandings();
    });
  });

  document.querySelector("#match-filter").addEventListener("change", (event) => {
    state.matchFilter = event.target.value;
    renderMatches();
  });
}

function switchView(view) {
  state.activeView = view;
  document.querySelectorAll("[data-view-tab]").forEach((button) => {
    const active = button.dataset.viewTab === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-view]").forEach((panel) => {
    const active = panel.dataset.view === view;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

function render() {
  renderMeta();
  renderScoreStrip();
  renderStandings();
  renderOdds();
  renderWinnerPicks();
  renderMatches();
}

loadData()
  .then(() => {
    bindEvents();
    render();
    showFlagQuiz();
    registerServiceWorker();
  })
  .catch((error) => {
    document.querySelector("#last-updated").textContent = error.message;
  });

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const workerUrl = new URL("../sw.js", import.meta.url);
  navigator.serviceWorker.register(workerUrl).catch((error) => {
    console.warn("Service worker registration failed", error);
  });
}
