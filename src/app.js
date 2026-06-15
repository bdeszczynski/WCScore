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
} from "./scoring.js?v=31";
import { flagUrlForTeam } from "./flags.js?v=34";

const DATA_URL = new URL("../public/data/world-cup.json", import.meta.url);
const APP_VERSION = "v58-football-data-match-odds";

const state = {
  data: null,
  ownerFilter: "all",
  matchFilter: "upcoming",
  ladderRound: "round32",
  activeView: "score",
};

const GROUP_TEAMS = [
  { group: "A", teams: ["Mexico", "South Africa", "South Korea", "Czechia"] },
  { group: "B", teams: ["Canada", "Bosnia-Herzegovina", "Qatar", "Switzerland"] },
  { group: "C", teams: ["Brazil", "Morocco", "Haiti", "Scotland"] },
  { group: "D", teams: ["United States", "Paraguay", "Australia", "Turkey"] },
  { group: "E", teams: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"] },
  { group: "F", teams: ["Netherlands", "Japan", "Sweden", "Tunisia"] },
  { group: "G", teams: ["Belgium", "Egypt", "Iran", "New Zealand"] },
  { group: "H", teams: ["Spain", "Cape Verde Islands", "Saudi Arabia", "Uruguay"] },
  { group: "I", teams: ["France", "Senegal", "Iraq", "Norway"] },
  { group: "J", teams: ["Argentina", "Algeria", "Austria", "Jordan"] },
  { group: "K", teams: ["Portugal", "Congo DR", "Uzbekistan", "Colombia"] },
  { group: "L", teams: ["England", "Croatia", "Ghana", "Panama"] },
];
const ROUND_OF_32 = [
  { match: 73, slots: [{ group: "A", position: 2 }, { group: "B", position: 2 }] },
  { match: 74, slots: [{ group: "E", position: 1 }, { third: ["A", "B", "C", "D", "F"] }] },
  { match: 75, slots: [{ group: "F", position: 1 }, { group: "C", position: 2 }] },
  { match: 76, slots: [{ group: "C", position: 1 }, { group: "F", position: 2 }] },
  { match: 77, slots: [{ group: "I", position: 1 }, { third: ["C", "D", "F", "G", "H"] }] },
  { match: 78, slots: [{ group: "E", position: 2 }, { group: "I", position: 2 }] },
  { match: 79, slots: [{ group: "A", position: 1 }, { third: ["C", "E", "F", "H", "I"] }] },
  { match: 80, slots: [{ group: "L", position: 1 }, { third: ["E", "H", "I", "J", "K"] }] },
  { match: 81, slots: [{ group: "D", position: 1 }, { third: ["B", "E", "F", "I", "J"] }] },
  { match: 82, slots: [{ group: "G", position: 1 }, { third: ["A", "E", "H", "I", "J"] }] },
  { match: 83, slots: [{ group: "K", position: 2 }, { group: "L", position: 2 }] },
  { match: 84, slots: [{ group: "H", position: 1 }, { group: "J", position: 2 }] },
  { match: 85, slots: [{ group: "B", position: 1 }, { third: ["E", "F", "G", "I", "J"] }] },
  { match: 86, slots: [{ group: "J", position: 1 }, { group: "H", position: 2 }] },
  { match: 87, slots: [{ group: "K", position: 1 }, { third: ["D", "E", "I", "J", "L"] }] },
  { match: 88, slots: [{ group: "D", position: 2 }, { group: "G", position: 2 }] },
];
const ROUND_OF_16 = [
  { match: 89, from: [73, 75] },
  { match: 90, from: [74, 77] },
  { match: 91, from: [76, 78] },
  { match: 92, from: [79, 80] },
  { match: 93, from: [83, 84] },
  { match: 94, from: [81, 82] },
  { match: 95, from: [86, 88] },
  { match: 96, from: [85, 87] },
];

const selectedTeamNames = new Set();
let leaderConfettiShown = false;

const fmtDate = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Dubai",
});

const fmtCompactDate = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
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

function teamLabel(teamName, tracked = false) {
  const flagUrl = flagUrlForTeam(teamName);
  return `
    <span class="team-label">
      ${tracked ? `<span class="tracked-star" aria-hidden="true">★</span>` : ""}
      ${flagUrl ? `<img class="flag-icon" src="${flagUrl}" alt="" loading="lazy" decoding="async" />` : ""}
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

function teamOddsProbability(teamName) {
  const odds = getTeamOdds(teamName);
  const probability = Number(odds?.probability);
  if (Number.isFinite(probability)) return probability;
  const decimal = Number(odds?.decimal);
  return Number.isFinite(decimal) && decimal > 0 ? 1 / decimal : 0;
}

function totalMarketProbability() {
  return (state.data.odds?.teams || []).reduce((sum, odds) => {
    const probability = Number(odds?.probability);
    if (Number.isFinite(probability)) return sum + probability;
    const decimal = Number(odds?.decimal);
    return Number.isFinite(decimal) && decimal > 0 ? sum + 1 / decimal : sum;
  }, 0);
}

function formatChance(value, fallback = "No chance loaded") {
  const probability = Number(value);
  if (!Number.isFinite(probability) || probability <= 0) return fallback;
  return `${(probability * 100).toFixed(1)}%`;
}

function oddsChanceLabel(odds) {
  if (Number.isFinite(Number(odds?.probability))) return `${formatChance(odds.probability)} market chance`;
  const decimal = Number(odds?.decimal);
  return Number.isFinite(decimal) && decimal > 0 ? `${((1 / decimal) * 100).toFixed(1)}% implied` : "No live odds";
}

function selectedTeamChanceLabel(odds) {
  const now = Number.isFinite(Number(odds?.probability))
    ? formatChance(odds.probability)
    : Number.isFinite(Number(odds?.decimal))
      ? `${((1 / Number(odds.decimal)) * 100).toFixed(1)}%`
      : "No live odds";
  const start = Number.isFinite(Number(odds?.startingProbability)) ? formatChance(odds.startingProbability) : "not set";
  return `Now ${now} · Start ${start}`;
}

function getMatchOdds(match) {
  return (state.data.matchOdds?.matches || []).find((entry) => {
    if (entry.matchId && entry.matchId === match.id) return true;
    return isSameTeam(entry.homeTeam, match.homeTeam) && isSameTeam(entry.awayTeam, match.awayTeam);
  });
}

function matchTeamMarketBadge(match, side) {
  const odds = getMatchOdds(match);
  const probability = side === "home" ? Number(odds?.homeProbability) : Number(odds?.awayProbability);
  if (!Number.isFinite(probability) || probability <= 0) return "";
  return `<span class="match-market-chance" title="Polymarket match win chance">${escapeHtml(formatChance(probability))}</span>`;
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

function groupMatches() {
  return state.data.matches.filter((match) => stageKind(match.stage) === "group");
}

function groupStandings() {
  return GROUP_TEAMS.map((component) => {
    const { group, teams } = component;
    const matches = groupMatches().filter((match) => teams.some((team) => isSameTeam(team, match.homeTeam) || isSameTeam(team, match.awayTeam)));
    const rows = teams
      .map((team) => ({ ...aggregateTeamForMatches(matches, team, ""), group }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.teamName.localeCompare(b.teamName);
      })
      .map((row, rowIndex) => ({ ...row, position: rowIndex + 1 }));
    return { group, rows };
  });
}

function thirdPlaceRows(groups = groupStandings()) {
  return groups
    .map((entry) => entry.rows[2])
    .filter(Boolean)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.teamName.localeCompare(b.teamName);
    })
    .map((row, index) => ({ ...row, thirdRank: index + 1 }));
}

function slotTeams(slot, groups, thirds) {
  if (slot.group) {
    const team = groups.find((entry) => entry.group === slot.group)?.rows[slot.position - 1];
    return team ? [{ ...team, slotLabel: `${slot.group}${slot.position}` }] : [];
  }
  return slot.third
    .map((group) => thirds.find((row) => row.group === group))
    .filter(Boolean)
    .map((team) => ({ ...team, slotLabel: `${team.group}3`, inThirdEight: team.thirdRank <= 8 }));
}

function matchNumber(match) {
  for (const value of [match.matchNumber, match.matchday, match.number]) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function knockoutMatchesByNumber() {
  const byNumber = new Map();
  for (const match of state.data.matches || []) {
    if (stageKind(match.stage) === "group") continue;
    const number = matchNumber(match);
    if (number) byNumber.set(number, match);
  }
  return byNumber;
}

function knockoutWinner(match) {
  if (!isFinished(match)) return null;
  if (match.winnerAfterPenalties) return match.winnerAfterPenalties;
  if (match.homeGoals > match.awayGoals) return match.homeTeam;
  if (match.awayGoals > match.homeGoals) return match.awayTeam;
  return null;
}

function actualMatchTeams(match) {
  if (!match) return null;
  const winner = knockoutWinner(match);
  return [
    [{ teamName: match.homeTeam, slotLabel: "Home", actual: true, winner: winner && isSameTeam(winner, match.homeTeam) }],
    [{ teamName: match.awayTeam, slotLabel: "Away", actual: true, winner: winner && isSameTeam(winner, match.awayTeam) }],
  ];
}

function r32Cards() {
  const groups = groupStandings();
  const thirds = thirdPlaceRows(groups);
  const actualMatches = knockoutMatchesByNumber();
  return ROUND_OF_32.map((match) => ({
    ...match,
    actualMatch: actualMatches.get(match.match) || null,
    teams: actualMatchTeams(actualMatches.get(match.match)) || match.slots.map((slot) => slotTeams(slot, groups, thirds)),
  }));
}

function uniqueTeams(rows) {
  const teams = new Map();
  for (const row of rows.flat()) {
    teams.set(normalizeTeam(row.teamName), row);
  }
  return [...teams.values()];
}

function flagChip(row, extraClass = "") {
  const flag = flagUrlForTeam(row.teamName, 80);
  const tracked = selectedTeamNames.has(row.teamName);
  const classes = [tracked ? "tracked" : "", row.winner ? "winner" : "", row.actual ? "actual" : "", extraClass].filter(Boolean).join(" ");
  return flag
    ? `<span class="ladder-flag ${classes}" title="${escapeHtml(`${row.teamName} · ${row.slotLabel || `${row.group}${row.position}`}`)}" aria-label="${escapeHtml(row.teamName)}"><img src="${flag}" alt="" loading="lazy" decoding="async" /></span>`
    : "";
}

function renderR32Ladder(cards = r32Cards()) {
  return cards
    .map(
      (card) => `
        <article class="ladder-card ${card.actualMatch ? "actual" : ""} ${isFinished(card.actualMatch || {}) ? "finished" : ""}">
          <div class="ladder-match-no">${card.match}</div>
          <div class="ladder-versus">
            <div class="ladder-slot">${card.teams[0].map((team) => flagChip(team, team.inThirdEight === false ? "out" : "")).join("")}</div>
            <span class="versus-dot"></span>
            <div class="ladder-slot">${card.teams[1].map((team) => flagChip(team, team.inThirdEight === false ? "out" : "")).join("")}</div>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderR16Ladder(cards = r32Cards()) {
  const byMatch = new Map(cards.map((card) => [card.match, card]));
  const actualMatches = knockoutMatchesByNumber();
  return ROUND_OF_16.map((match) => {
    const actual = actualMatches.get(match.match) || null;
    const pools = actualMatchTeams(actual) || match.from.map((matchNo) => {
      const source = byMatch.get(matchNo);
      const winner = knockoutWinner(source?.actualMatch);
      return winner ? [{ teamName: winner, slotLabel: `Winner ${matchNo}`, actual: true, winner: true }] : uniqueTeams(source?.teams || []);
    });
    return `
      <article class="ladder-card round16-card ${actual ? "actual" : ""} ${isFinished(actual || {}) ? "finished" : ""}">
        <div class="ladder-match-no">${match.match}</div>
        <div class="ladder-versus">
          <div class="ladder-source">W${match.from[0]}</div>
          <div class="ladder-slot">${pools[0].map((team) => flagChip(team)).join("")}</div>
          <span class="versus-dot"></span>
          <div class="ladder-source">W${match.from[1]}</div>
          <div class="ladder-slot">${pools[1].map((team) => flagChip(team)).join("")}</div>
        </div>
      </article>
    `;
  }).join("");
}

function renderThirdPlaceLadder() {
  return thirdPlaceRows()
    .map(
      (row) => `
        <article class="third-card ${row.thirdRank <= 8 ? "in" : "out"}">
          <span class="third-rank">${row.thirdRank}</span>
          ${flagChip({ ...row, slotLabel: `${row.group}3` })}
          <span class="third-stats">${row.points}-${row.gd > 0 ? "+" : ""}${row.gd}-${row.gf}</span>
        </article>
      `,
    )
    .join("");
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

function playerMarketShare(player) {
  const marketTotal = totalMarketProbability();
  if (marketTotal <= 0) return 0;
  const rawWinProbability = getPlayerBonusSelections(player).reduce((sum, team) => sum + teamOddsProbability(team.name), 0);
  return Math.min(rawWinProbability / marketTotal, 1);
}

function renderScoreStrip() {
  const totals = getPlayerTotals();
  const displayTotals = [...totals].sort((a, b) => comparePlayerTotals(a, b) || a.name.localeCompare(b.name));
  const leader = displayTotals[0];
  const leadIsTied = displayTotals.filter((player) => comparePlayerTotals(player, leader) === 0).length > 1;
  const container = document.querySelector("#score-strip");

  container.innerHTML = displayTotals
    .map(
      (player) => {
        const isLeader = comparePlayerTotals(player, leader) === 0;
        return `
        <article class="score-card ${ownerClass(player.name).toLowerCase()} ${isLeader ? "current-leader" : ""}" data-player-card="${escapeHtml(player.name)}" ${isLeader ? 'data-leader="true"' : ""}>
          <div class="score-head">
            <div class="owner-title">
              ${ownerAvatar(player.name)}
              <h2>${escapeHtml(player.name)}</h2>
            </div>
            ${
              isLeader
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
      `;
      },
    )
    .join("");
}

function currentLeaders() {
  const totals = getPlayerTotals();
  const displayTotals = [...totals].sort((a, b) => comparePlayerTotals(a, b) || a.name.localeCompare(b.name));
  const leader = displayTotals[0];
  return displayTotals.filter((player) => comparePlayerTotals(player, leader) === 0).map((player) => player.name);
}

function playCrowdCheer() {
  const AudioContext = globalThis.window?.AudioContext || globalThis.window?.webkitAudioContext;
  if (!AudioContext) return;

  try {
    const audio = new AudioContext();
    const duration = 1.1;
    const sampleRate = audio.sampleRate;
    const buffer = audio.createBuffer(1, sampleRate * duration, sampleRate);
    const samples = buffer.getChannelData(0);

    for (let index = 0; index < samples.length; index += 1) {
      const progress = index / samples.length;
      const attack = Math.min(progress / 0.12, 1);
      const release = Math.max(1 - progress, 0);
      samples[index] = (Math.random() * 2 - 1) * attack * release * 0.28;
    }

    const noise = audio.createBufferSource();
    noise.buffer = buffer;

    const filter = audio.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1450, audio.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2100, audio.currentTime + 0.22);
    filter.Q.value = 1.4;

    const crowdGain = audio.createGain();
    crowdGain.gain.setValueAtTime(0.001, audio.currentTime);
    crowdGain.gain.exponentialRampToValueAtTime(0.08, audio.currentTime + 0.06);
    crowdGain.gain.exponentialRampToValueAtTime(0.018, audio.currentTime + duration);

    noise.connect(filter);
    filter.connect(crowdGain);
    crowdGain.connect(audio.destination);
    noise.start();
    noise.stop(audio.currentTime + duration);

    const voiceCount = 9;
    for (let index = 0; index < voiceCount; index += 1) {
      const start = audio.currentTime + Math.random() * 0.055;
      const voiceDuration = 0.52 + Math.random() * 0.2;
      const baseFrequency = 170 + Math.random() * 260;
      const voiceGain = audio.createGain();
      const formantA = audio.createBiquadFilter();
      const formantB = audio.createBiquadFilter();

      formantA.type = "bandpass";
      formantA.frequency.setValueAtTime(720 + Math.random() * 140, start);
      formantA.frequency.exponentialRampToValueAtTime(1020 + Math.random() * 180, start + 0.18);
      formantA.Q.value = 7;

      formantB.type = "bandpass";
      formantB.frequency.setValueAtTime(2100 + Math.random() * 280, start);
      formantB.frequency.exponentialRampToValueAtTime(1450 + Math.random() * 180, start + 0.38);
      formantB.Q.value = 5;

      voiceGain.gain.setValueAtTime(0.001, start);
      voiceGain.gain.exponentialRampToValueAtTime(0.045, start + 0.045);
      voiceGain.gain.exponentialRampToValueAtTime(0.018, start + 0.2);
      voiceGain.gain.exponentialRampToValueAtTime(0.001, start + voiceDuration);

      for (const detune of [-8, 0, 9]) {
        const voice = audio.createOscillator();
        voice.type = "sawtooth";
        voice.frequency.setValueAtTime(baseFrequency + detune, start);
        voice.frequency.exponentialRampToValueAtTime((baseFrequency + detune) * 1.75, start + 0.13);
        voice.frequency.exponentialRampToValueAtTime((baseFrequency + detune) * 1.18, start + voiceDuration);
        voice.connect(formantA);
        voice.start(start);
        voice.stop(start + voiceDuration);
      }

      formantA.connect(formantB);
      formantB.connect(voiceGain);
      voiceGain.connect(audio.destination);
    }

    setTimeout(() => audio.close(), 1500);
  } catch {
    // Some browsers only allow audio from a direct user gesture; confetti can continue silently.
  }
}

function showLeaderConfetti() {
  const leaders = currentLeaders();
  if (!leaders.length || globalThis.window?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

  const leaderCards = [...document.querySelectorAll('[data-leader="true"]')];
  if (!leaderCards.length) return;

  const overlay = document.createElement("div");
  overlay.className = "confetti-overlay";
  overlay.setAttribute("aria-hidden", "true");
  playCrowdCheer();

  const colors = leaders.includes("Sara") && leaders.includes("Bruno")
    ? ["#d94f70", "#1f2937", "#f4b942", "#146b62"]
    : leaders[0] === "Sara"
      ? ["#d94f70", "#f4b942", "#f7d9e2", "#146b62"]
      : ["#1f2937", "#f4b942", "#6b7c72", "#146b62"];

  leaderCards.forEach((card, cardIndex) => {
    const rect = card.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + Math.min(rect.height * 0.42, 110);

    card.classList.add("leader-celebrating");
    setTimeout(() => card.classList.remove("leader-celebrating"), 2600);

    for (let index = 0; index < 44; index += 1) {
      const piece = document.createElement("span");
      const angle = -150 + Math.random() * 120;
      const distance = 140 + Math.random() * 180;
      const driftX = Math.cos((angle * Math.PI) / 180) * distance;
      const driftY = Math.sin((angle * Math.PI) / 180) * distance + 90;

      piece.style.setProperty("--origin-x", `${originX}px`);
      piece.style.setProperty("--origin-y", `${originY}px`);
      piece.style.setProperty("--drift-x", `${driftX}px`);
      piece.style.setProperty("--drift-y", `${driftY}px`);
      piece.style.setProperty("--delay", `${Math.random() * 0.16}s`);
      piece.style.setProperty("--duration", `${1.4 + Math.random() * 0.8}s`);
      piece.style.setProperty("--spin", `${180 + Math.random() * 540}deg`);
      piece.style.background = colors[(index + cardIndex * 7) % colors.length];
      overlay.append(piece);
    }
  });

  document.body.append(overlay);
  setTimeout(() => overlay.remove(), 3200);
}

function showLeaderConfettiOnce() {
  if (leaderConfettiShown) return;
  leaderConfettiShown = true;
  showLeaderConfetti();
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
      const owner = getSelectedTeamOwner(odds.team);
      return `
        <article class="odds-row">
          <div class="odds-main">
            <div class="odds-rank">${index + 1}</div>
            <div>
              <h3>${teamLabel(odds.team)}</h3>
            </div>
          </div>
          ${owner ? `<div class="odds-owner-badge icon-only" title="${escapeHtml(owner)} selected" aria-label="${escapeHtml(owner)} selected">${ownerAvatar(owner)}</div>` : ""}
          <div class="odds-price">
            <span class="muted">${escapeHtml(oddsChanceLabel(odds))}</span>
          </div>
        </article>
      `;
    })
    .join("") || `<div class="empty-state">No winner odds loaded yet.</div>`;
}

function renderOddsMeta() {
  const source = state.data.odds?.source || "No odds source";
  const sourceLabel = source.includes("Polymarket") ? "Polymarket" : source.includes("The Sun") ? "The Sun" : source;
  const updatedAt = state.data.odds?.updatedAt;
  const updated = updatedAt ? fmtCompactDate.format(new Date(updatedAt)) : "Never";
  document.querySelector("#odds-source").textContent = sourceLabel;
  document.querySelector("#odds-updated").textContent = updated;
}

function renderWinnerPicks() {
  document.querySelector("#winner-picks").innerHTML = state.data.players
    .map((player) => {
      const picks = getPlayerBonusSelections(player)
        .map((team) => ({ ...team, status: bonusStatus(team.name) }))
        .sort((a, b) => teamOddsProbability(b.name) - teamOddsProbability(a.name) || a.name.localeCompare(b.name));
      const marketShare = playerMarketShare(player);
      return `
        <section class="bonus-column ${ownerClass(player.name)}" aria-label="${escapeHtml(player.name)} bonus teams">
          <div class="bonus-column-head">
            <div class="owner-title compact">
              ${ownerAvatar(player.name)}
              <h3>${escapeHtml(player.name)}</h3>
            </div>
            <div class="bonus-column-metrics">
              <span class="pill">${picks.reduce((sum, pick) => sum + pick.status.points, 0)} pts</span>
              <span class="market-share-pill">
                <span>Market ${formatChance(marketShare, "0.0%")}</span>
                <span
                  class="info-dot"
                  tabindex="0"
                  role="img"
                  aria-label="Selected team probability divided by total loaded Polymarket probability"
                  title="Selected team probability divided by total loaded Polymarket probability"
                >i</span>
              </span>
            </div>
          </div>
          <div class="bonus-list">
            ${picks
              .map(
                (pick) => {
                  const odds = getTeamOdds(pick.name);
                  const chance = selectedTeamChanceLabel(odds);
                  return `
                  <article class="winner-card ${ownerClass(player.name)}">
                    <div>
                      <h3>${teamLabel(pick.name)}</h3>
                      <p class="muted bonus-role">${escapeHtml(pick.roles.join(" + "))}</p>
                      <p class="muted chance-line"><span>${escapeHtml(chance)}</span></p>
                    </div>
                    <div class="winner-points">
                      <span class="pill">${pick.status.semiReached ? "Semi +3" : "Semi pending"}</span>
                      <span class="pill">${pick.status.wonCup ? "Champion +7" : "Champion pending"}</span>
                      <span class="pill">${pick.status.points} pts</span>
                    </div>
                  </article>
                `;
                },
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

function formatStageLabel(stage) {
  return String(stage || "Stage TBC").replace(/_/g, " ");
}

function safeVenueWikiUrl(url) {
  const value = String(url || "");
  return value.startsWith("https://en.wikipedia.org/wiki/") ? value : "";
}

function renderVenue(match) {
  if (!match.venue) return "";
  const hostFlag = flagUrlForTeam(match.venueCountry);
  const city = match.venueCity ? `, ${escapeHtml(match.venueCity)}` : "";
  const safeUrl = safeVenueWikiUrl(match.venueWikiUrl);
  const venue = safeUrl
    ? `<a class="venue-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(match.venue)}</a>`
    : escapeHtml(match.venue);
  return `
    <div class="venue-line">
      ${hostFlag ? `<img class="venue-host-flag" src="${hostFlag}" alt="" loading="lazy" decoding="async" />` : ""}
      <span>${venue}${city}</span>
    </div>
  `;
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
              <strong>${teamLabel(match.homeTeam, homeTracked)}${!isFinished(match) ? matchTeamMarketBadge(match, "home") : ""}</strong>
              <span class="match-score">${isFinished(match) ? match.homeGoals : ""}</span>
            </div>
            <div class="match-team">
              <strong>${teamLabel(match.awayTeam, awayTracked)}${!isFinished(match) ? matchTeamMarketBadge(match, "away") : ""}</strong>
              <span class="match-score">${isFinished(match) ? match.awayGoals : ""}</span>
            </div>
          </div>
          <div class="match-meta">
            <div>${escapeHtml(formatStageLabel(match.stage))}</div>
            <div>${isFinished(match) ? score : formatKickoff(match)}</div>
            ${renderVenue(match)}
            ${match.winnerAfterPenalties ? `<div>${escapeHtml(match.winnerAfterPenalties)} won pens</div>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderLadder(round = state.ladderRound) {
  const container = document.querySelector("#knockout-ladder");
  if (!container) return;
  const activeRound = round;
  const content =
    activeRound === "round16"
      ? renderR16Ladder()
      : activeRound === "third"
        ? renderThirdPlaceLadder()
        : activeRound === "round32"
          ? renderR32Ladder()
          : `<div class="ladder-coming-soon">Coming soon</div>`;
  container.className = `ladder-board ${activeRound === "third" ? "third-board" : ""} ${!["round32", "round16", "third"].includes(activeRound) ? "soon-board" : ""}`;
  container.dataset.round = activeRound;
  container.innerHTML = content || `<div class="empty-state">No ladder data loaded yet.</div>`;
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
  return [...names].filter((team) => flagUrlForTeam(team)).sort((a, b) => a.localeCompare(b));
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function showFlagQuiz() {
  const teams = getQuizTeams();
  if (teams.length < 3) return false;

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
      </div>
      <img class="quiz-flag" alt="" width="160" height="120" />
      <div class="quiz-options"></div>
      <p class="quiz-feedback" aria-live="polite"></p>
    </div>
  `;

  let correct = "";
  let attempts = 0;
  const feedback = modal.querySelector(".quiz-feedback");
  const flag = modal.querySelector(".quiz-flag");
  const optionsContainer = modal.querySelector(".quiz-options");

  const renderQuestion = () => {
    correct = teams[Math.floor(Math.random() * teams.length)];
    const options = shuffle([correct, ...shuffle(teams.filter((team) => team !== correct)).slice(0, 2)]);
    flag.src = flagUrlForTeam(correct, 320);
    optionsContainer.innerHTML = options
      .map((team) => `<button type="button" data-quiz-answer="${escapeHtml(team)}">${escapeHtml(team)}</button>`)
      .join("");
    feedback.textContent =
      attempts > 0 ? "To use the app efficiently, you need to be able to recognize countries by their flags. Try again." : "";
  };

  const close = () => {
    modal.remove();
    showLeaderConfettiOnce();
  };

  optionsContainer.addEventListener("click", (event) => {
    const button = event.target.closest("[data-quiz-answer]");
    if (!button) return;
    const picked = button.dataset.quizAnswer;
    const right = isSameTeam(picked, correct);
    optionsContainer.querySelectorAll("[data-quiz-answer]").forEach((item) => {
      item.disabled = true;
      item.classList.toggle("correct", isSameTeam(item.dataset.quizAnswer, correct));
      item.classList.toggle("wrong", item === button && !right);
    });
    if (right) {
      feedback.textContent = "Correct.";
      setTimeout(close, 850);
      return;
    }
    attempts += 1;
    feedback.textContent = "Not quite. Try another flag.";
    setTimeout(renderQuestion, 900);
  });

  renderQuestion();
  document.body.append(modal);
  return true;
}

function renderMeta() {
  const updated = state.data.updatedAt ? fmtDate.format(new Date(state.data.updatedAt)) : "Never";
  const source = state.data.source ? ` · ${state.data.source}` : "";
  document.querySelector("#last-updated").textContent = `Last updated ${updated} Dubai time${source}`;
}

function bindEvents() {
  const selectLadderRound = (selected) => {
    state.ladderRound = selected.dataset.ladderRound;
    document.querySelectorAll("[data-ladder-round]").forEach((item) => item.classList.toggle("active", item === selected));
    renderLadder(state.ladderRound);
  };

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

  document.querySelector(".ladder-heading")?.addEventListener("click", (event) => {
    const selected = event.target.closest("[data-ladder-round]");
    if (!selected) return;
    selectLadderRound(selected);
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
  document.body.dataset.appVersion = APP_VERSION;
  renderMeta();
  renderScoreStrip();
  renderStandings();
  renderOdds();
  renderOddsMeta();
  renderWinnerPicks();
  renderLadder();
  renderMatches();
}

loadData()
  .then(() => {
    bindEvents();
    render();
    if (!showFlagQuiz()) showLeaderConfettiOnce();
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
