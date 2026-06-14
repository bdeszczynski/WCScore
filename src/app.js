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
  France: "FR",
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
  Sweden: "SE",
  Switzerland: "CH",
  Tunisia: "TN",
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

function normalizeTeam(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ");
}

function isSameTeam(a, b) {
  return normalizeTeam(a) === normalizeTeam(b);
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

function stageKind(stage = "") {
  const value = stage.toLowerCase();
  if (value.includes("group")) return "group";
  if (value.includes("semi")) return "semi";
  if (value.includes("final") && !value.includes("semi")) return "final";
  if (value.includes("round") || value.includes("quarter") || value.includes("knockout")) {
    return "knockout";
  }
  return "unknown";
}

function isFinished(match) {
  return match.status === "finished" && Number.isFinite(match.homeGoals) && Number.isFinite(match.awayGoals);
}

function scoreMatchForTeam(match, teamName) {
  if (!isFinished(match)) return null;
  const isHome = isSameTeam(match.homeTeam, teamName);
  const isAway = isSameTeam(match.awayTeam, teamName);
  if (!isHome && !isAway) return null;

  const gf = isHome ? match.homeGoals : match.awayGoals;
  const ga = isHome ? match.awayGoals : match.homeGoals;
  const penaltyLost =
    stageKind(match.stage) !== "group" &&
    match.winnerAfterPenalties &&
    !isSameTeam(match.winnerAfterPenalties, teamName);

  let points = 0;
  let win = 0;
  let draw = 0;
  let loss = 0;
  let penaltyBonus = 0;

  if (gf > ga) {
    points = 3;
    win = 1;
  } else if (gf === ga) {
    points = 1;
    draw = 1;
  } else {
    loss = 1;
  }

  if (penaltyLost) {
    points += 1;
    penaltyBonus = 1;
  }

  return { points, win, draw, loss, gf, ga, penaltyBonus };
}

function aggregateTeam(teamName, owner) {
  const totals = {
    teamName,
    owner,
    points: 0,
    win: 0,
    draw: 0,
    loss: 0,
    gf: 0,
    ga: 0,
    penaltyBonus: 0,
    played: 0,
  };

  for (const match of state.data.matches) {
    const result = scoreMatchForTeam(match, teamName);
    if (!result) continue;
    totals.points += result.points;
    totals.win += result.win;
    totals.draw += result.draw;
    totals.loss += result.loss;
    totals.gf += result.gf;
    totals.ga += result.ga;
    totals.penaltyBonus += result.penaltyBonus;
    totals.played += 1;
  }

  totals.gd = totals.gf - totals.ga;
  return totals;
}

function winnerPickStatus(teamName) {
  const semiReached = state.data.matches.some((match) => {
    const kind = stageKind(match.stage);
    return (kind === "semi" || kind === "final") && (isSameTeam(match.homeTeam, teamName) || isSameTeam(match.awayTeam, teamName));
  });

  const final = state.data.matches.find((match) => stageKind(match.stage) === "final" && isFinished(match));
  const champion =
    final &&
    (final.winnerAfterPenalties ||
      (final.homeGoals > final.awayGoals ? final.homeTeam : final.awayGoals > final.homeGoals ? final.awayTeam : ""));

  const wonCup = champion && isSameTeam(champion, teamName);
  return {
    semiReached,
    wonCup,
    points: (semiReached ? 3 : 0) + (wonCup ? 7 : 0),
  };
}

function getTeamOdds(teamName) {
  return state.data.odds?.teams?.find((entry) => isSameTeam(entry.team, teamName));
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

function getPlayerTotals() {
  return state.data.players.map((player) => {
    const pointTeams = player.pointsTeams.map((team) => aggregateTeam(team.name, player.name));
    const teamPoints = pointTeams.reduce((sum, team) => sum + team.points, 0);
    const winnerPoints = player.winnerPicks.reduce((sum, team) => sum + winnerPickStatus(team.name).points, 0);
    return {
      name: player.name,
      teamPoints,
      winnerPoints,
      total: teamPoints + winnerPoints,
    };
  });
}

function renderScoreStrip() {
  const totals = getPlayerTotals();
  const leader = [...totals].sort((a, b) => b.total - a.total)[0];
  const container = document.querySelector("#score-strip");

  container.innerHTML = totals
    .map(
      (player) => `
        <article class="score-card ${player.name.toLowerCase()}">
          <div class="score-head">
            <div class="owner-title">
              ${ownerAvatar(player.name)}
              <h2>${player.name}</h2>
            </div>
            <span class="pill">${leader.total === player.total ? "Leader" : `${leader.total - player.total} behind`}</span>
          </div>
          <div class="score-total">${player.total}</div>
          <div class="score-breakdown">
            <span class="pill">${player.teamPoints} team pts</span>
            <span class="pill">${player.winnerPoints} winner pts</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderStandings() {
  const rows = getStandings().filter((row) => state.ownerFilter === "all" || row.owner === state.ownerFilter);
  const body = document.querySelector("#standings-body");

  body.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${teamLabel(row.teamName)}</td>
          <td><span class="owner-cell">${ownerAvatar(row.owner)} ${row.owner}</span></td>
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
}

function renderOdds() {
  const trackedWinnerTeams = state.data.players.flatMap((player) =>
    player.winnerPicks.map((team) => ({ ...team, owner: player.name })),
  );

  document.querySelector("#odds-list").innerHTML = trackedWinnerTeams
    .map((pick) => {
      const odds = getTeamOdds(pick.name);
      const decimal = odds?.decimal ? Number(odds.decimal) : null;
      const implied = decimal ? `${((1 / decimal) * 100).toFixed(1)}% implied` : "No live odds";
      return `
        <article class="odds-row">
          <div>
            <h3>${teamLabel(pick.name)}</h3>
            <p class="muted">${pick.owner}${odds?.bookmaker ? ` · ${odds.bookmaker}` : ""}</p>
          </div>
          <div class="odds-price">
            <strong>${decimal ? decimal.toFixed(2) : "—"}</strong>
            <span class="muted">${implied}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderWinnerPicks() {
  const picks = state.data.players.flatMap((player) =>
    player.winnerPicks.map((team) => ({ ...team, owner: player.name, status: winnerPickStatus(team.name) })),
  );

  document.querySelector("#winner-picks").innerHTML = picks
    .map(
      (pick) => `
        <article class="winner-card ${pick.owner}">
          <p class="eyebrow">${pick.owner}</p>
          <div class="owner-title compact">
            ${ownerAvatar(pick.owner)}
            <h3>${teamLabel(pick.name)}</h3>
          </div>
          <div class="winner-points">
            <span class="pill">${pick.status.semiReached ? "Semi +3" : "Semi pending"}</span>
            <span class="pill">${pick.status.wonCup ? "Champion +7" : "Champion pending"}</span>
            <span class="pill">${pick.status.points} pts</span>
          </div>
        </article>
      `,
    )
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
  if (Number.isNaN(date.getTime())) return match.kickoff;
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
            <div>${match.stage || "Stage TBC"}</div>
            <div>${isFinished(match) ? score : formatKickoff(match)}</div>
            ${match.winnerAfterPenalties ? `<div>${match.winnerAfterPenalties} won pens</div>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
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
