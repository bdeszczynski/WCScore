import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { aggregateTeam, bonusStatus, comparePlayerTotals } from "../src/scoring.js";

const DATA_FILE = new URL("../public/data/world-cup.json", import.meta.url);
const MANUAL_RESULTS_FILE = new URL("../public/data/manual-results.json", import.meta.url);
const WIKIPEDIA_PAGES = [
  "2026_FIFA_World_Cup",
  ...Array.from({ length: 12 }, (_, index) => `2026_FIFA_World_Cup_Group_${String.fromCharCode(65 + index)}`),
];
const FOOTBALL_DATA_URL = "https://api.football-data.org/v4/competitions/WC/matches";
const FOOTBALL_DATA_SCORERS_URL = "https://api.football-data.org/v4/competitions/WC/scorers?season=2026&limit=20";
const NATIVE_STATS_WC_URL = "https://native-stats.org/competition/WC/";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const POLYMARKET_WINNER_URL = "https://gamma-api.polymarket.com/events/slug/world-cup-winner";
const POLYMARKET_MARKETS_URL = "https://gamma-api.polymarket.com/markets";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_COMMENTARY_TIMEOUT_MS = 12000;
const OPENAI_COMMENTARY_MAX_CHARS = 420;
const OPENAI_COMMENTARY_MAX_OUTPUT_TOKENS = 600;
const PUBLIC_ODDS_TEAMS = [
  "France",
  "Spain",
  "England",
  "Portugal",
  "Brazil",
  "Argentina",
  "Germany",
  "Netherlands",
  "Morocco",
  "Belgium",
  "Uruguay",
  "Croatia",
  "Colombia",
  "Mexico",
  "Japan",
  "Norway",
  "Switzerland",
  "Egypt",
  "South Korea",
];
const PUBLIC_ODDS_SOURCES = [
  "https://www.the-sun.com/sport/16467419/world-cup-2026-winner-odds/",
  "https://www.thesun.co.uk/betting/36354428/world-cup-2026-odds-tips/",
];
const MANUAL_STARTING_WINNER_PROBABILITIES = [
  ["Spain", 0.182],
  ["France", 0.174],
  ["England", 0.118],
  ["Portugal", 0.105],
  ["Brazil", 0.105],
  ["Argentina", 0.1],
  ["Germany", 0.067],
  ["Netherlands", 0.058],
  ["Norway", 0.024],
  ["Belgium", 0.024],
  ["Colombia", 0.024],
  ["Morocco", 0.018],
  ["Japan", 0.016],
  ["United States", 0.016],
  ["Uruguay", 0.015],
  ["Switzerland", 0.015],
  ["Mexico", 0.012],
  ["Ecuador", 0.012],
  ["Croatia", 0.011],
  ["Turkey", 0.011],
  ["Sweden", 0.01],
  ["Senegal", 0.009],
  ["Egypt", 0.008],
  ["Paraguay", 0.007],
  ["Austria", 0.007],
  ["Scotland", 0.005],
  ["Canada", 0.005],
  ["Bosnia-Herzegovina", 0.004],
  ["Czechia", 0.004],
  ["Ivory Coast", 0.004],
  ["Ghana", 0.003],
  ["Algeria", 0.003],
  ["South Korea", 0.002],
  ["Tunisia", 0.002],
  ["Australia", 0.002],
  ["Iran", 0.002],
  ["Congo DR", 0.0014],
  ["South Africa", 0.0012],
  ["Uzbekistan", 0.001],
  ["Cape Verde Islands", 0.001],
  ["Saudi Arabia", 0.001],
  ["Qatar", 0.001],
  ["Panama", 0.001],
  ["New Zealand", 0.001],
  ["Iraq", 0.001],
  ["Curaçao", 0.0005],
  ["Jordan", 0.0005],
  ["Haiti", 0.0004],
];
const manualStartingProbabilityByTeam = new Map(
  MANUAL_STARTING_WINNER_PROBABILITIES.map(([team, probability]) => [normalizeTeam(team), probability]),
);

const fifaCodeMap = new Map(
  Object.entries({
    ALG: "Algeria",
    ARG: "Argentina",
    AUS: "Australia",
    AUT: "Austria",
    BEL: "Belgium",
    BIH: "Bosnia-Herzegovina",
    BRA: "Brazil",
    CAN: "Canada",
    CPV: "Cape Verde Islands",
    CIV: "Ivory Coast",
    COL: "Colombia",
    COD: "Congo DR",
    CRO: "Croatia",
    CUW: "Curaçao",
    DEN: "Denmark",
    ECU: "Ecuador",
    EGY: "Egypt",
    ENG: "England",
    ESP: "Spain",
    FRA: "France",
    GER: "Germany",
    GHA: "Ghana",
    HAI: "Haiti",
    IRN: "Iran",
    ITA: "Italy",
    IRQ: "Iraq",
    JPN: "Japan",
    JOR: "Jordan",
    KOR: "South Korea",
    KSA: "Saudi Arabia",
    MAR: "Morocco",
    MEX: "Mexico",
    NED: "Netherlands",
    NZL: "New Zealand",
    NOR: "Norway",
    PAN: "Panama",
    PAR: "Paraguay",
    POR: "Portugal",
    QAT: "Qatar",
    RSA: "South Africa",
    SCO: "Scotland",
    SEN: "Senegal",
    SUI: "Switzerland",
    SWE: "Sweden",
    TUN: "Tunisia",
    TUR: "Turkey",
    URU: "Uruguay",
    USA: "United States",
    UZB: "Uzbekistan",
    CZE: "Czechia",
  }),
);

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

const KNOWN_ROUND_OF_32_MATCHUPS = [
  [73, "South Africa", "Canada"],
  [74, "Germany", "Paraguay"],
  [75, "Netherlands", "Morocco"],
  [76, "Brazil", "Japan"],
  [77, "France", "Sweden"],
  [78, "Ivory Coast", "Norway"],
  [79, "Mexico", "Ecuador"],
  [80, "England", "Congo DR"],
  [81, "United States", "Bosnia-Herzegovina"],
  [82, "Belgium", "Senegal"],
  [83, "Portugal", "Croatia"],
  [84, "Spain", "Austria"],
  [85, "Switzerland", "Algeria"],
  [86, "Argentina", "Cape Verde Islands"],
  [87, "Colombia", "Ghana"],
  [88, "Australia", "Egypt"],
];
const KNOWN_ROUND_OF_16_MATCHUPS = [
  [89, "Canada", "Morocco"],
  [90, "Paraguay", "France"],
  [91, "Brazil", "Norway"],
  [92, "Mexico", "England"],
  [93, "Portugal", "Spain"],
  [94, "United States", "Belgium"],
  [95, "Argentina", "Egypt"],
  [96, "Switzerland", "Colombia"],
];
const knownKnockoutMatchNumbers = new Map(
  [...KNOWN_ROUND_OF_32_MATCHUPS, ...KNOWN_ROUND_OF_16_MATCHUPS].flatMap(([matchNumber, homeTeam, awayTeam]) => [
    [`${normalizeTeam(homeTeam)}|${normalizeTeam(awayTeam)}`, matchNumber],
    [`${normalizeTeam(awayTeam)}|${normalizeTeam(homeTeam)}`, matchNumber],
  ]),
);

function knownKnockoutMatchNumber(match) {
  return knownKnockoutMatchNumbers.get(`${normalizeTeam(match.homeTeam)}|${normalizeTeam(match.awayTeam)}`) || null;
}

function americanToDecimal(american) {
  const value = Number(american);
  if (!Number.isFinite(value)) return null;
  return value > 0 ? 1 + value / 100 : 1 + 100 / Math.abs(value);
}

function fractionalToDecimal(fractional) {
  const value = String(fractional).trim();
  const fraction = value.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (!denominator) return null;
    return 1 + Number(fraction[1]) / denominator;
  }
  const integer = value.match(/^\d+(?:\.\d+)?$/);
  if (!integer) return null;
  return 1 + Number(value);
}

function probabilityToDecimal(probability) {
  const value = Number(probability);
  if (!Number.isFinite(value) || value <= 0 || value >= 1) return null;
  return 1 / value;
}

function roundDecimal(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(number.toFixed(digits));
}

function normalizeProbabilities(values) {
  const probabilities = values.map((value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return null;
    return number > 1 ? 1 / number : number;
  });
  if (probabilities.some((value) => value === null)) return null;
  const total = probabilities.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) return null;
  return probabilities.map((value) => roundDecimal(value / total, 4));
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value || ""));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value = "") {
  return decodeHtml(String(value).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function teamFromWinnerQuestion(question = "") {
  const match = String(question).match(/^Will\s+(.+?)\s+win\s+the\s+2026\s+FIFA\s+World\s+Cup\??$/i);
  return match?.[1]?.trim() || "";
}

function isUsableWinnerTeam(team) {
  const normalized = normalizeTeam(team);
  return Boolean(normalized && normalized !== "other" && !normalized.startsWith("team "));
}

function selectedTeamNamesFromData(data) {
  const names = new Set();
  for (const player of data.players || []) {
    for (const team of player.pointsTeams || []) names.add(normalizeTeam(team.name));
    for (const team of player.winnerPicks || []) names.add(normalizeTeam(team.name));
  }
  return names;
}

function applyStartingProbabilities(rows, currentRows = []) {
  const currentByTeam = new Map((currentRows || []).map((entry) => [normalizeTeam(entry.team), entry]));
  return rows.map((row) => {
    const teamKey = normalizeTeam(row.team);
    const existing = currentByTeam.get(teamKey);
    const startingProbability = Number(existing?.startingProbability ?? manualStartingProbabilityByTeam.get(teamKey));
    return Number.isFinite(startingProbability) && startingProbability > 0
      ? { ...row, startingProbability: roundDecimal(startingProbability, 4) }
      : row;
  });
}

function includeSelectedRows(rows, selectedTeams, limit = 10) {
  if (!selectedTeams?.size) return rows.slice(0, limit);
  const topRows = rows.slice(0, limit);
  const included = new Set(topRows.map((row) => normalizeTeam(row.team)));
  const selectedRows = rows.filter((row) => selectedTeams.has(normalizeTeam(row.team)) && !included.has(normalizeTeam(row.team)));
  return [...topRows, ...selectedRows];
}

function getPlayerPointTotals(data) {
  return (data.players || []).map((player) => {
    const rows = (player.pointsTeams || []).map((team) => aggregateTeam(data.matches || [], team.name, player.name));
    const points = rows.reduce((sum, row) => sum + row.points, 0);
    const gf = rows.reduce((sum, row) => sum + row.gf, 0);
    const ga = rows.reduce((sum, row) => sum + row.ga, 0);
    const bonusPoints = [...(player.pointsTeams || []), ...(player.winnerPicks || [])]
      .filter((team, index, teams) => teams.findIndex((candidate) => isSameTeam(candidate.name, team.name)) === index)
      .reduce((sum, team) => sum + bonusStatus(data.matches || [], team.name).points, 0);

    return {
      name: player.name,
      teamPoints: points,
      bonusPoints,
      total: points + bonusPoints,
      gd: gf - ga,
      gf,
      ga,
      pointTeams: rows.map((row) => ({
        team: row.teamName,
        points: row.points,
        played: row.played,
        gd: row.gd,
        gf: row.gf,
        ga: row.ga,
      })),
      winnerPicks: (player.winnerPicks || []).map((team) => {
        const row = aggregateTeam(data.matches || [], team.name, player.name);
        const status = bonusStatus(data.matches || [], team.name);
        return {
          team: team.name,
          trackingPoints: row.points,
          played: row.played,
          gd: row.gd,
          gf: row.gf,
          semiReached: status.semiReached,
          wonCup: status.wonCup,
        };
      }),
    };
  });
}

function buildCommentaryFacts(data) {
  const players = getPlayerPointTotals(data).sort((a, b) => comparePlayerTotals(a, b) || a.name.localeCompare(b.name));
  const oddsByTeam = new Map((data.odds?.teams || []).map((entry) => [normalizeTeam(entry.team), entry]));
  const finishedMatches = (data.matches || [])
    .filter((match) => match.status === "finished")
    .slice(-8)
    .map((match) => {
      const pens = match.winnerAfterPenalties ? `, ${match.winnerAfterPenalties} won penalties` : "";
      return `${match.homeTeam} ${match.homeGoals}-${match.awayGoals} ${match.awayTeam}${pens}`;
    });
  const topTeams = players.flatMap((player) => player.pointTeams.map((team) => ({ ...team, owner: player.name }))).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.team.localeCompare(b.team);
  });

  return {
    updatedAt: data.updatedAt,
    rules: {
      pointTeamScoring: "Selected points teams score 3 challenge points for a win and 1 for a draw in every round they play.",
      knockoutPenaltyShootouts:
        "In knockout rounds, a selected points team that wins on penalties gets 3 challenge points. A selected points team that loses on penalties gets 1 consolation point.",
      challengeTieBreakers: "If Bruno and Sara have equal total challenge points, leader is decided by combined points-team goal difference, then combined points-team goals for. If still equal, they are tied.",
      winnerPickBonus:
        "Selected winner picks do not score ordinary match points for the challenge. Any selected team, including points teams and winner picks, gives its owner 3 bonus points for reaching the semi-finals and 7 bonus points for winning the World Cup.",
      winnerPickTracking: "Winner-pick standings are only progress tracking and do not add match points to the challenge score.",
    },
    players: players.map((player) => ({
      ...player,
      pointTeamNames: (data.players || []).find((entry) => entry.name === player.name)?.pointsTeams?.map((team) => team.name) || [],
      winnerPickNames: (data.players || []).find((entry) => entry.name === player.name)?.winnerPicks?.map((team) => team.name) || [],
      winnerPicks: player.winnerPicks.map((pick) => {
        const odds = oddsByTeam.get(normalizeTeam(pick.team));
        return {
          ...pick,
          marketProbability: Number.isFinite(Number(odds?.probability)) ? odds.probability : null,
          startingProbability: Number.isFinite(Number(odds?.startingProbability)) ? odds.startingProbability : null,
        };
      }),
    })),
    leader: players[0]?.name || null,
    recentFinishedMatches: finishedMatches,
    bestPointTeams: topTeams.slice(0, 6),
    instruction: "Predict the likely Bruno vs Sara challenge winner from current score, tiebreakers, selected teams, winner picks, and market probabilities only.",
  };
}

function extractResponseText(json) {
  if (typeof json?.output_text === "string") return json.output_text;
  const parts = [];
  for (const item of json?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && content.text) parts.push(content.text);
    }
  }
  return parts.join(" ");
}

function cleanCommentaryText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, OPENAI_COMMENTARY_MAX_CHARS);
}

async function requestOpenAiCommentary(facts, { apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_COMMENTARY_TIMEOUT_MS);
  try {
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-nano",
        reasoning: { effort: "low" },
        max_output_tokens: OPENAI_COMMENTARY_MAX_OUTPUT_TOKENS,
        input: [
          {
            role: "developer",
            content:
              "Write one short VAR-bot says pundit verdict for Bruno vs Sara's World Cup challenge. It should feel like a sharp football studio segment, not a bland recap. Start exactly with 'Prediction: Bruno.', 'Prediction: Sara.', or 'Prediction: too close to call.'. Then explain the forecast from current points, goal-difference/goals-for tiebreakers, selected teams, winner-pick upside, and market probabilities. Include one forward-looking risk or comeback path and one affectionate trash-talk line. Use only supplied facts. Do not invent matches, results, injuries, odds, or context. Keep it under 95 words. No markdown.",
          },
          {
            role: "user",
            content: JSON.stringify(facts),
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`OpenAI commentary request failed: ${response.status}`);
    const text = cleanCommentaryText(extractResponseText(await response.json()));
    if (!text) throw new Error("OpenAI commentary request returned no text");
    return text ? { updatedAt: new Date().toISOString(), text } : null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateVarBotCommentary(data, currentCommentary, options = {}) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return currentCommentary || null;
  try {
    const commentary = await requestOpenAiCommentary(buildCommentaryFacts(data), { apiKey, fetchImpl: options.fetchImpl });
    if (commentary) {
      if (!options.silent) console.log(`VAR-bot commentary refreshed at ${commentary.updatedAt}`);
      return commentary;
    }
    if (!options.silent) console.warn("VAR-bot commentary skipped: no commentary returned");
    return currentCommentary || null;
  } catch (error) {
    if (!options.silent) console.warn(`VAR-bot commentary skipped: ${error.message}`);
    return currentCommentary || null;
  }
}

export function parsePolymarketWinnerEvent(event, { limit = 10, selectedTeams = new Set(), currentRows = [] } = {}) {
  const markets = Array.isArray(event?.markets) ? event.markets : [];
  const rows = markets
    .map((market) => {
      const team = String(market.groupItemTitle || teamFromWinnerQuestion(market.question)).trim();
      const outcomePrices = parseJsonArray(market.outcomePrices);
      const probability = Number(outcomePrices[0]);
      const decimal = probabilityToDecimal(probability);
      if (market.active === false || market.closed || !isUsableWinnerTeam(team) || !decimal) return null;
      return {
        team,
        decimal: roundDecimal(decimal),
        probability: roundDecimal(probability, 4),
        bookmaker: "Polymarket market probability",
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.probability - a.probability || a.team.localeCompare(b.team))
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return applyStartingProbabilities(includeSelectedRows(rows, selectedTeams, limit), currentRows);
}

function marketVolume(market) {
  return Number(market.volumeNum ?? market.volume ?? 0) || 0;
}

function polymarketMarketUrl(market) {
  const eventSlug = market?.events?.[0]?.slug;
  const slug = eventSlug || market?.slug;
  return slug ? `https://polymarket.com/event/${slug}` : null;
}

export function parsePolymarketMatchMarket(market, match) {
  if (!market || market.active === false || market.closed) return null;
  const outcomes = parseJsonArray(market.outcomes);
  const outcomePrices = parseJsonArray(market.outcomePrices);
  if (outcomes.length !== outcomePrices.length || outcomes.length < 2) return null;

  const homeIndex = outcomes.findIndex((outcome) => isSameTeam(outcome, match.homeTeam));
  const awayIndex = outcomes.findIndex((outcome) => isSameTeam(outcome, match.awayTeam));
  const drawIndex = outcomes.findIndex((outcome) => ["draw", "tie"].includes(normalizeTeam(outcome)));
  if (homeIndex < 0 || awayIndex < 0) return null;

  const homeProbability = Number(outcomePrices[homeIndex]);
  const awayProbability = Number(outcomePrices[awayIndex]);
  const drawProbability = drawIndex >= 0 ? Number(outcomePrices[drawIndex]) : null;
  if (!Number.isFinite(homeProbability) || !Number.isFinite(awayProbability) || homeProbability <= 0 || awayProbability <= 0) {
    return null;
  }
  if (drawProbability !== null && (!Number.isFinite(drawProbability) || drawProbability < 0)) return null;

  const text = normalizeTeam(
    [market.question, market.groupItemTitle, market.description, ...(market.events || []).map((event) => event.title)].join(" "),
  );
  if (!text.includes(normalizeTeam(match.homeTeam)) || !text.includes(normalizeTeam(match.awayTeam))) return null;

  return {
    matchId: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeProbability: roundDecimal(homeProbability, 4),
    drawProbability: drawProbability === null ? null : roundDecimal(drawProbability, 4),
    awayProbability: roundDecimal(awayProbability, 4),
    question: String(market.question || "").trim(),
    url: polymarketMarketUrl(market),
    volume: roundDecimal(marketVolume(market), 2),
  };
}

export function parseFootballDataMatchOdds(apiMatch, normalizedMatch) {
  const odds = apiMatch?.odds || {};
  const home = odds.homeWin ?? odds.home ?? odds.homeTeam;
  const draw = odds.draw;
  const away = odds.awayWin ?? odds.away ?? odds.awayTeam;
  const probabilities = normalizeProbabilities([home, draw, away]);
  if (!probabilities) return null;
  return {
    matchId: normalizedMatch.id,
    homeTeam: normalizedMatch.homeTeam,
    awayTeam: normalizedMatch.awayTeam,
    homeProbability: probabilities[0],
    drawProbability: probabilities[1],
    awayProbability: probabilities[2],
    question: `${normalizedMatch.homeTeam} vs ${normalizedMatch.awayTeam}`,
    url: null,
    volume: null,
  };
}

function extractPublicOdds(html, team) {
  const escaped = team.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const american = new RegExp(`${escaped}[\\s\\S]{0,90}?\\+(\\d{3,4})`, "i").exec(html);
  if (american) return americanToDecimal(american[1]);
  const fractional = new RegExp(`${escaped}[\\s\\S]{0,90}?(\\d{1,2}\\s*/\\s*1)`, "i").exec(html);
  if (fractional) return fractionalToDecimal(fractional[1]);
  return null;
}

function cleanWikiText(value = "") {
  let text = String(value)
    .replace(/<ref[\s\S]*?<\/ref>/gi, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/'''?/g, "")
    .trim();

  text = text.replace(/\{\{\s*(?:fb|flagicon|flag|country data)\s*\|\s*([A-Z]{2,3})[^}]*\}\}/gi, (_, code) => {
    return fifaCodeMap.get(code.toUpperCase()) || code.toUpperCase();
  });
  text = text.replace(/\{\{#invoke:\s*flag\s*\|\s*fb(?:-[^|}]+)?\s*\|\s*([A-Z]{2,3})[^}]*\}\}/gi, (_, code) => {
    return fifaCodeMap.get(code.toUpperCase()) || code.toUpperCase();
  });

  text = text.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1").replace(/\[\[([^\]]+)\]\]/g, "$1");
  text = text.replace(/\{\{[^}]+\}\}/g, "");
  return text.replace(/\s+/g, " ").trim();
}

function wikiPageUrl(title) {
  if (!title) return null;
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.trim().replace(/\s+/g, "_"))}`;
}

function inferVenueCountry(venueCity = "") {
  const value = String(venueCity).toLowerCase();
  if (/(mexico city|guadalajara|zapopan|monterrey|guadalupe)/.test(value)) return "Mexico";
  if (/(toronto|vancouver)/.test(value)) return "Canada";
  if (value) return "United States";
  return null;
}

function parseWikiLinks(value = "") {
  return [...String(value).matchAll(/\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g)].map((match) => ({
    title: cleanWikiText(match[1]),
    label: cleanWikiText(match[2] || match[1]),
  }));
}

export function parseVenue(stadiumField = "") {
  const links = parseWikiLinks(stadiumField);
  if (!links.length) return {};
  const [stadium, city] = links;
  const venueCity = city?.label || null;
  return {
    venue: stadium.label,
    venueCity,
    venueCountry: inferVenueCountry(venueCity),
    venueWikiUrl: wikiPageUrl(stadium.title),
  };
}

function parseTemplateFields(block) {
  const fields = new Map();
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("|")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(1, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();
    fields.set(key, value);
  }
  return fields;
}

function findFootballBoxes(wikitext) {
  const boxes = [];
  const markers = ["{{football box", "{{#invoke:football box"];
  let index = 0;

  while (index < wikitext.length) {
    const lower = wikitext.toLowerCase();
    const starts = markers.map((marker) => lower.indexOf(marker, index)).filter((position) => position >= 0);
    const start = starts.length ? Math.min(...starts) : -1;
    if (start === -1) break;

    let cursor = start;
    let depth = 0;
    while (cursor < wikitext.length) {
      if (wikitext.startsWith("{{", cursor)) {
        depth += 1;
        cursor += 2;
        continue;
      }
      if (wikitext.startsWith("}}", cursor)) {
        depth -= 1;
        cursor += 2;
        if (depth === 0) break;
        continue;
      }
      cursor += 1;
    }

    boxes.push(wikitext.slice(start, cursor));
    index = cursor;
  }

  return boxes;
}

function parseScore(scoreText) {
  const cleaned = cleanWikiText(scoreText).replace(/[–—]/g, "-");
  const score = cleaned.match(/(\d+)\s*-\s*(\d+)/);
  if (!score) return { status: "scheduled", homeGoals: null, awayGoals: null };
  return {
    status: "finished",
    homeGoals: Number(score[1]),
    awayGoals: Number(score[2]),
  };
}

function parsePenaltyWinner(fields, homeTeam, awayTeam) {
  const penaltyScore = cleanWikiText(fields.get("penaltyscore") || "").replace(/[–—]/g, "-");
  const match = penaltyScore.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  const homePens = Number(match[1]);
  const awayPens = Number(match[2]);
  if (homePens === awayPens) return null;
  return homePens > awayPens ? homeTeam : awayTeam;
}

function parseKickoff(fields) {
  const date = cleanWikiText(fields.get("date") || "");
  const time = cleanWikiText(fields.get("time") || "");
  const startDate = `${fields.get("date") || ""} ${fields.get("time") || ""}`.match(
    /\{\{\s*start date\s*\|\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})(?:\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2}))?/i,
  );
  if (startDate) {
    const [, year, month, day, hour = "00", minute = "00"] = startDate;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute))).toISOString();
  }

  const textual = `${date} ${time}`.trim();
  const parsed = Date.parse(textual);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function inferStage(fields, kickoff) {
  const round = cleanWikiText(fields.get("round") || fields.get("stage") || "");
  if (round) return round;
  if (!kickoff) return "Group stage";
  const date = new Date(kickoff);
  if (date < new Date("2026-06-28T00:00:00Z")) return "Group stage";
  if (date < new Date("2026-07-04T00:00:00Z")) return "Round of 32";
  if (date < new Date("2026-07-10T00:00:00Z")) return "Quarter-finals";
  if (date < new Date("2026-07-15T00:00:00Z")) return "Semi-finals";
  return "Final";
}

async function fetchWikipediaWikitext(page) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", page);
  url.searchParams.set("prop", "wikitext");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  let response;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    response = await fetch(url, {
      headers: { "User-Agent": "WCScore/1.0 (static score tracker)" },
    });
    if (response.ok) break;
    if (response.status !== 429 || attempt === 5) break;
    await sleep(5000 * attempt);
  }
  if (!response.ok) throw new Error(`Wikipedia request failed for ${page}: ${response.status}`);
  const json = await response.json();
  const wikitext = json?.parse?.wikitext?.["*"];
  if (!wikitext) throw new Error(`Wikipedia response did not contain wikitext for ${page}`);
  return wikitext;
}

export async function fetchWikipediaMatches() {
  const matches = [];

  for (const page of WIKIPEDIA_PAGES) {
    let wikitext;
    try {
      wikitext = await fetchWikipediaWikitext(page);
    } catch (error) {
      console.warn(error.message);
      continue;
    }
    const pageMatches = findFootballBoxes(wikitext)
      .map((block, index) => {
        const fields = parseTemplateFields(block);
        const homeTeam = cleanWikiText(fields.get("team1") || fields.get("home") || "");
        const awayTeam = cleanWikiText(fields.get("team2") || fields.get("away") || "");
        if (!homeTeam || !awayTeam) return null;

        const kickoff = parseKickoff(fields);
        const score = parseScore(fields.get("score") || "");
        const stage = inferStage(fields, kickoff);
        const winnerAfterPenalties = parsePenaltyWinner(fields, homeTeam, awayTeam);
        const venue = parseVenue(fields.get("stadium") || fields.get("venue") || "");

        return {
          id: `wiki-${page.toLowerCase().replaceAll("_", "-")}-${index + 1}-${normalizeTeam(homeTeam).replaceAll(" ", "-")}-${normalizeTeam(awayTeam).replaceAll(" ", "-")}`,
          stage,
          kickoff,
          homeTeam,
          awayTeam,
          ...score,
          winnerAfterPenalties,
          ...venue,
        };
      })
      .filter(Boolean);

    matches.push(...pageMatches);
    await sleep(1800);
  }

  return matches;
}

export function normalizeFootballDataMatch(match) {
  const homeTeam = match.homeTeam?.name;
  const awayTeam = match.awayTeam?.name;
  if (!homeTeam || !awayTeam) return null;
  const fullTime = match.score?.fullTime || {};
  const regularTime = match.score?.regularTime || {};
  const extraTime = match.score?.extraTime || {};
  const penalties = match.score?.penalties || {};
  const hasPenaltyScore = Number.isFinite(penalties.home) && Number.isFinite(penalties.away);
  const matchScore =
    hasPenaltyScore && Number.isFinite(regularTime.home) && Number.isFinite(regularTime.away)
      ? regularTime
      : hasPenaltyScore && Number.isFinite(extraTime.home) && Number.isFinite(extraTime.away)
        ? extraTime
        : fullTime;
  const finished = match.status === "FINISHED" && Number.isFinite(matchScore.home) && Number.isFinite(matchScore.away);
  const winnerAfterPenalties =
    hasPenaltyScore && penalties.home !== penalties.away
      ? penalties.home > penalties.away
        ? homeTeam
        : awayTeam
      : null;

  return {
    id: String(match.id || `${match.utcDate}-${homeTeam}-${awayTeam}`),
    stage: match.stage || match.group || "World Cup",
    group: match.group || null,
    matchNumber: Number.isFinite(match.matchday) ? match.matchday : knownKnockoutMatchNumber({ stage: match.stage, homeTeam, awayTeam }),
    kickoff: match.utcDate || null,
    homeTeam,
    awayTeam,
    status: finished ? "finished" : "scheduled",
    homeGoals: finished ? matchScore.home : null,
    awayGoals: finished ? matchScore.away : null,
    winnerAfterPenalties,
    ...parseVenue(match.venue || ""),
  };
}

function metadataKey(match) {
  return [
    normalizeTeam(match.homeTeam),
    normalizeTeam(match.awayTeam),
    String(match.kickoff || "").slice(0, 10),
  ].join("|");
}

function teamsKey(match) {
  return [normalizeTeam(match.homeTeam), normalizeTeam(match.awayTeam)].join("|");
}

export function mergeMatchMetadata(matches, metadataMatches) {
  const byId = new Map(metadataMatches.map((match) => [String(match.id), match]));
  const byTeamsAndDate = new Map(metadataMatches.map((match) => [metadataKey(match), match]));
  const byTeams = new Map(metadataMatches.map((match) => [teamsKey(match), match]));

  return matches.map((match) => {
    const metadata = byId.get(String(match.id)) || byTeamsAndDate.get(metadataKey(match)) || byTeams.get(teamsKey(match));
    if (!metadata) return match;
    return {
      ...match,
      venue: match.venue || metadata.venue || null,
      venueCity: match.venueCity || metadata.venueCity || null,
      venueCountry: match.venueCountry || metadata.venueCountry || null,
      venueWikiUrl: match.venueWikiUrl || metadata.venueWikiUrl || null,
    };
  });
}

export function matchesMissingVenueMetadata(matches) {
  return matches.filter((match) => !match.venue || !match.venueCountry || !match.venueWikiUrl);
}

export function applyManualResultOverrides(matches, manualResults = {}) {
  const overrides = Array.isArray(manualResults?.matches) ? manualResults.matches : [];
  if (!overrides.length) return matches;

  const matchIds = new Set(matches.map((match) => String(match.id)));
  const activeOverridesById = new Map();
  for (const override of overrides) {
    const id = String(override?.id || "").trim();
    if (!id) throw new Error(`Manual result override is missing an id: ${JSON.stringify(override)}`);
    if (!matchIds.has(id)) throw new Error(`Manual result override references unknown match id: ${id}`);
    if (override.manualOverride === true) activeOverridesById.set(id, override);
  }
  if (!activeOverridesById.size) return matches;

  return matches.map((match) => {
    const override = activeOverridesById.get(String(match.id));
    if (!override) return match;

    const hasHomeGoals = override.homeGoals !== undefined && override.homeGoals !== null;
    const hasAwayGoals = override.awayGoals !== undefined && override.awayGoals !== null;
    const status = override.status || (hasHomeGoals && hasAwayGoals ? "finished" : match.status);
    if (!["scheduled", "finished"].includes(status)) {
      throw new Error(`Manual result override has invalid status for ${match.id}: ${status}`);
    }

    const next = { ...match, status, resultSource: "manual" };
    if (override.note) next.resultNote = String(override.note);
    else delete next.resultNote;

    if (status === "finished") {
      const homeGoals = Number(override.homeGoals);
      const awayGoals = Number(override.awayGoals);
      if (!Number.isFinite(homeGoals) || !Number.isFinite(awayGoals)) {
        throw new Error(`Manual finished result override is missing score for ${match.id}`);
      }
      next.homeGoals = homeGoals;
      next.awayGoals = awayGoals;
    } else {
      next.homeGoals = null;
      next.awayGoals = null;
    }

    if (override.winnerAfterPenalties !== undefined) {
      const winner = override.winnerAfterPenalties || null;
      if (winner && ![match.homeTeam, match.awayTeam].some((team) => isSameTeam(team, winner))) {
        throw new Error(`Manual penalty winner is not in match ${match.id}: ${winner}`);
      }
      next.winnerAfterPenalties = winner;
    } else if (status !== "finished") {
      next.winnerAfterPenalties = null;
    }

    return next;
  });
}

export function syncManualResultSkeleton(matches, manualResults = {}) {
  const existingById = new Map((manualResults.matches || []).map((match) => [String(match.id), match]));
  return {
    updatedAt: new Date().toISOString(),
    notes:
      manualResults.notes ||
      "Ready-made manual result overrides. API/world-cup.json wins by default. To override a match, set manualOverride to true on that row, edit status/homeGoals/awayGoals/winnerAfterPenalties/note, commit this file, then run Refresh data. Turn manualOverride back to false or remove the row to let API data win again.",
    matches: matches.map((match) => {
      const existing = existingById.get(String(match.id)) || {};
      const manualOverride = existing.manualOverride === true;
      return {
        id: String(match.id),
        matchNumber: match.matchNumber ?? null,
        stage: match.stage ?? null,
        group: match.group ?? null,
        kickoff: match.kickoff ?? null,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        manualOverride,
        status: manualOverride ? existing.status || match.status : match.status,
        homeGoals: manualOverride ? existing.homeGoals ?? match.homeGoals : match.homeGoals,
        awayGoals: manualOverride ? existing.awayGoals ?? match.awayGoals : match.awayGoals,
        winnerAfterPenalties: manualOverride ? existing.winnerAfterPenalties ?? null : match.winnerAfterPenalties ?? null,
        note: existing.note || "",
      };
    }),
  };
}

async function readManualResults() {
  try {
    return JSON.parse(await readFile(MANUAL_RESULTS_FILE, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return { matches: [] };
    throw error;
  }
}

export function getFootballDataToken(env = process.env) {
  const token = env.FOOTBALL_DATA_TOKEN?.trim();
  if (token) return token;
  if (env.REQUIRE_FOOTBALL_DATA_TOKEN === "1") {
    throw new Error("FOOTBALL_DATA_TOKEN is required for this data update.");
  }
  return null;
}

async function fetchFootballDataMatches() {
  const token = getFootballDataToken();
  if (!token) return null;
  const response = await fetch(FOOTBALL_DATA_URL, {
    headers: { "X-Auth-Token": token },
  });
  if (!response.ok) throw new Error(`football-data.org request failed: ${response.status}`);
  const json = await response.json();
  const rows = json.matches
    .map((apiMatch) => {
      const match = normalizeFootballDataMatch(apiMatch);
      return match ? { match, matchOdds: parseFootballDataMatchOdds(apiMatch, match) } : null;
    })
    .filter(Boolean);
  return {
    matches: rows.map((row) => row.match),
    matchOdds: rows.map((row) => row.matchOdds).filter(Boolean),
  };
}

export function parseFootballDataScorers(json, { limit = 20 } = {}) {
  const rows = Array.isArray(json?.scorers) ? json.scorers : [];
  return rows
    .map((entry, index) => {
      const player = stripHtml(entry?.player?.name || "");
      const team = fifaCodeMap.get(entry?.team?.tla) || stripHtml(entry?.team?.shortName || entry?.team?.name || "");
      const goals = Number(entry?.goals);
      const assists = entry?.assists === null || entry?.assists === undefined ? null : Number(entry.assists);
      const penalties = entry?.penalties === null || entry?.penalties === undefined ? null : Number(entry.penalties);
      if (!player || !team || !Number.isFinite(goals)) return null;
      return {
        rank: index + 1,
        player,
        team,
        goals,
        assists: Number.isFinite(assists) ? assists : null,
        penalties: Number.isFinite(penalties) ? penalties : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.goals - a.goals || (b.assists ?? -1) - (a.assists ?? -1) || a.player.localeCompare(b.player))
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

async function fetchFootballDataTopScorers(currentTopScorers) {
  const token = getFootballDataToken();
  if (!token) return currentTopScorers || null;
  try {
    const response = await fetch(FOOTBALL_DATA_SCORERS_URL, {
      headers: { "X-Auth-Token": token },
    });
    if (!response.ok) {
      console.warn(`football-data.org scorers skipped: ${response.status}`);
      return currentTopScorers || null;
    }
    const scorers = parseFootballDataScorers(await response.json());
    if (!scorers.length) return currentTopScorers || null;
    return {
      source: "football-data.org scorers",
      updatedAt: new Date().toISOString(),
      type: "football_data_scorers",
      scorers,
    };
  } catch (error) {
    console.warn(`football-data.org scorers skipped: ${error.message}`);
    return currentTopScorers || null;
  }
}

function nativeStatsTeamNames(rowHtml) {
  return [...rowHtml.matchAll(/<span class="hidden text-gray-200 align-middle md:inline-block">\s*([\s\S]*?)\s*<\/span>/g)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean)
    .slice(0, 2);
}

export function parseNativeStatsMatchOdds(html, matches = []) {
  const body = /<tbody id="next_matches"[\s\S]*?>([\s\S]*?)<\/tbody>/i.exec(html)?.[1] || "";
  const matchesById = new Map(matches.map((match) => [String(match.id), match]));
  return [...body.matchAll(/<tr id="next-[^"]+">([\s\S]*?)(?=<\/tr>)/g)]
    .map((rowMatch) => {
      const rowHtml = rowMatch[1];
      const matchId = /\/match\/(\d+)/.exec(rowHtml)?.[1];
      const oddsMatch = /<td class="whitespace-nowrap">\s*([0-9.]+)\s*\/\s*([0-9.]+)\s*\/\s*([0-9.]+)\s*<\/td>/i.exec(rowHtml);
      if (!matchId || !oddsMatch) return null;

      const sourceMatch = matchesById.get(matchId);
      const [homeFromHtml, awayFromHtml] = nativeStatsTeamNames(rowHtml);
      const homeTeam = sourceMatch?.homeTeam || homeFromHtml;
      const awayTeam = sourceMatch?.awayTeam || awayFromHtml;
      if (!homeTeam || !awayTeam) return null;

      const probabilities = normalizeProbabilities([oddsMatch[1], oddsMatch[2], oddsMatch[3]]);
      if (!probabilities) return null;

      return {
        matchId,
        homeTeam,
        awayTeam,
        homeProbability: probabilities[0],
        drawProbability: probabilities[1],
        awayProbability: probabilities[2],
        question: `${homeTeam} vs ${awayTeam}`,
        url: "https://native-stats.org/competition/WC/",
        volume: null,
      };
    })
    .filter(Boolean);
}

export async function fetchNativeStatsMatchOdds(matches = []) {
  try {
    const response = await fetch(NATIVE_STATS_WC_URL, {
      headers: { "User-Agent": "WCScore/1.0 (static score tracker)" },
    });
    if (!response.ok) throw new Error(`Native Stats request failed: ${response.status}`);
    return {
      source: "Native Stats match odds",
      updatedAt: new Date().toISOString(),
      type: "bookmaker_match",
      matches: parseNativeStatsMatchOdds(await response.text(), unfinishedMatches(matches)),
    };
  } catch (error) {
    console.warn(`Native Stats match odds update failed: ${error.message}`);
    return {
      source: "Native Stats match odds",
      updatedAt: new Date().toISOString(),
      type: "bookmaker_match",
      matches: [],
    };
  }
}

export async function fetchPolymarketOdds(currentData = {}) {
  try {
    const response = await fetch(POLYMARKET_WINNER_URL, {
      headers: { "User-Agent": "WCScore/1.0 (static score tracker)" },
    });
    if (!response.ok) throw new Error(`Polymarket request failed: ${response.status}`);

    const rows = parsePolymarketWinnerEvent(await response.json(), {
      limit: Number.POSITIVE_INFINITY,
      selectedTeams: selectedTeamNamesFromData(currentData),
      currentRows: currentData.odds?.teams || [],
    });
    if (rows.filter((row) => row.rank <= 10).length < 10) {
      throw new Error(`Polymarket returned ${rows.length} usable winner markets`);
    }

    return {
      source: "Polymarket World Cup Winner market",
      updatedAt: new Date().toISOString(),
      type: "prediction_market",
      teams: rows,
    };
  } catch (error) {
    console.warn(`Polymarket odds update failed: ${error.message}`);
    return null;
  }
}

function unfinishedMatches(matches = []) {
  return matches.filter((match) => match.status !== "finished" && match.homeTeam && match.awayTeam);
}

async function fetchPolymarketMatchMarketsFor(match) {
  const url = new URL(POLYMARKET_MARKETS_URL);
  url.searchParams.set("search", `${match.homeTeam} ${match.awayTeam} World Cup`);
  url.searchParams.set("active", "true");
  url.searchParams.set("closed", "false");
  url.searchParams.set("limit", "20");

  const response = await fetch(url, {
    headers: { "User-Agent": "WCScore/1.0 (static score tracker)" },
  });
  if (!response.ok) throw new Error(`Polymarket match request failed: ${response.status}`);
  const markets = await response.json();
  return (Array.isArray(markets) ? markets : [])
    .map((market) => parsePolymarketMatchMarket(market, match))
    .filter(Boolean)
    .sort((a, b) => b.volume - a.volume);
}

export async function fetchPolymarketMatchOdds(matches = []) {
  const rows = [];
  for (const match of unfinishedMatches(matches)) {
    try {
      const [best] = await fetchPolymarketMatchMarketsFor(match);
      if (best) rows.push(best);
    } catch (error) {
      console.warn(`Polymarket match odds update failed for ${match.homeTeam} v ${match.awayTeam}: ${error.message}`);
    }
    await sleep(125);
  }

  return {
    source: "Polymarket match markets",
    updatedAt: new Date().toISOString(),
    type: "prediction_market_match",
    matches: rows,
  };
}

export function parseSunWinnerOdds(html, { limit = 10, selectedTeams = new Set(), currentRows = [] } = {}) {
  const rows = PUBLIC_ODDS_TEAMS.map((team) => {
    const decimal = extractPublicOdds(html, team);
    if (!decimal) return null;
    return {
      team,
      decimal: roundDecimal(decimal),
      probability: roundDecimal(1 / decimal, 4),
      bookmaker: "The Sun public odds article",
    };
  })
    .filter(Boolean)
    .sort((a, b) => a.decimal - b.decimal || a.team.localeCompare(b.team))
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return applyStartingProbabilities(includeSelectedRows(rows, selectedTeams, limit), currentRows);
}

async function fetchSunArticleOdds(currentData = {}) {
  const selectedTeams = selectedTeamNamesFromData(currentData);

  for (const url of PUBLIC_ODDS_SOURCES) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "WCScore/1.0 (static score tracker)" },
      });
      if (!response.ok) continue;
      const rows = parseSunWinnerOdds(await response.text(), {
        limit: 10,
        selectedTeams,
        currentRows: currentData.odds?.teams || [],
      });
      if (rows.length >= 4) {
        return {
          source: "The Sun World Cup winner odds article",
          updatedAt: new Date().toISOString(),
          type: "bookmaker_article",
          teams: rows,
        };
      }
    } catch (error) {
      console.warn(`The Sun odds scrape failed for ${url}: ${error.message}`);
    }
  }

  console.warn("The Sun odds update found no usable article odds");
  return null;
}

async function main() {
  const current = JSON.parse(await readFile(DATA_FILE, "utf8"));
  const manualResults = await readManualResults();
  const sources = [];

  const footballData = await fetchFootballDataMatches();
  let matches = footballData?.matches || null;
  let footballDataMatchOdds = footballData?.matchOdds || [];
  if (matches?.length) {
    sources.push("football-data.org");
    matches = mergeMatchMetadata(matches, current.matches || []);
    if (matchesMissingVenueMetadata(matches).length) {
      const wikipediaMatches = await fetchWikipediaMatches();
      if (wikipediaMatches.length) {
        matches = mergeMatchMetadata(matches, [...(current.matches || []), ...wikipediaMatches]);
        sources.push("Wikipedia venue metadata");
      }
    }
  } else {
    footballDataMatchOdds = [];
    matches = await fetchWikipediaMatches();
    if (matches.length) {
      sources.push("Wikipedia");
    } else {
      matches = current.matches;
      sources.push("Existing fixtures; no fresh matches found");
    }
  }
  const syncedManualResults = syncManualResultSkeleton(matches, manualResults);
  matches = applyManualResultOverrides(matches, syncedManualResults);

  let freshOdds = await fetchPolymarketOdds(current);
  if (!freshOdds) freshOdds = await fetchSunArticleOdds(current);
  const odds = freshOdds || current.odds;
  if (freshOdds?.source) sources.push(freshOdds.source);

  const topScorers = await fetchFootballDataTopScorers(current.topScorers);
  if (topScorers?.source && topScorers !== current.topScorers) sources.push(topScorers.source);

  const freshNativeStatsMatchOdds = footballDataMatchOdds.length ? null : await fetchNativeStatsMatchOdds(matches);
  const freshPolymarketMatchOdds =
    footballDataMatchOdds.length || freshNativeStatsMatchOdds?.matches.length ? null : await fetchPolymarketMatchOdds(matches);
  const freshMatchOdds = footballDataMatchOdds.length
    ? {
        source: "football-data.org match odds",
        updatedAt: new Date().toISOString(),
        type: "bookmaker_match",
        matches: footballDataMatchOdds,
      }
    : freshNativeStatsMatchOdds?.matches.length
      ? freshNativeStatsMatchOdds
      : freshPolymarketMatchOdds.matches.length
        ? freshPolymarketMatchOdds
        : null;
  const matchOdds =
    freshMatchOdds ||
    current.matchOdds ||
    freshNativeStatsMatchOdds ||
    freshPolymarketMatchOdds || {
      source: "No match odds source",
      updatedAt: new Date().toISOString(),
      type: "bookmaker_match",
      matches: [],
    };
  if (freshMatchOdds?.source) sources.push(freshMatchOdds.source);

  const next = {
    ...current,
    updatedAt: new Date().toISOString(),
    source: sources.join(" + "),
    matches,
    odds,
    topScorers,
    matchOdds,
  };
  if (!topScorers) delete next.topScorers;
  const commentary = await generateVarBotCommentary(next, current.commentary);
  if (commentary) {
    next.commentary = commentary;
  } else {
    delete next.commentary;
  }

  await writeFile(DATA_FILE, `${JSON.stringify(next, null, 2)}\n`);
  await writeFile(MANUAL_RESULTS_FILE, `${JSON.stringify(syncedManualResults, null, 2)}\n`);
  console.log(`Updated ${matches.length} matches from ${next.source}`);
  console.log(`Updated ${topScorers?.scorers?.length || 0} top scorers`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
