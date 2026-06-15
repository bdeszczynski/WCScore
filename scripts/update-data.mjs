import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DATA_FILE = new URL("../public/data/world-cup.json", import.meta.url);
const WIKIPEDIA_PAGES = [
  "2026_FIFA_World_Cup",
  ...Array.from({ length: 12 }, (_, index) => `2026_FIFA_World_Cup_Group_${String.fromCharCode(65 + index)}`),
];
const FOOTBALL_DATA_URL = "https://api.football-data.org/v4/competitions/WC/matches";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const POLYMARKET_WINNER_URL = "https://gamma-api.polymarket.com/events/slug/world-cup-winner";
const POLYMARKET_MARKETS_URL = "https://gamma-api.polymarket.com/markets";
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

function normalizeFootballDataMatch(match) {
  const homeTeam = match.homeTeam?.name;
  const awayTeam = match.awayTeam?.name;
  if (!homeTeam || !awayTeam) return null;
  const fullTime = match.score?.fullTime || {};
  const penalties = match.score?.penalties || {};
  const finished = match.status === "FINISHED" && Number.isFinite(fullTime.home) && Number.isFinite(fullTime.away);
  const winnerAfterPenalties =
    Number.isFinite(penalties.home) && Number.isFinite(penalties.away) && penalties.home !== penalties.away
      ? penalties.home > penalties.away
        ? homeTeam
        : awayTeam
      : null;

  return {
    id: String(match.id || `${match.utcDate}-${homeTeam}-${awayTeam}`),
    stage: match.stage || match.group || "World Cup",
    group: match.group || null,
    matchNumber: Number.isFinite(match.matchday) ? match.matchday : null,
    kickoff: match.utcDate || null,
    homeTeam,
    awayTeam,
    status: finished ? "finished" : "scheduled",
    homeGoals: finished ? fullTime.home : null,
    awayGoals: finished ? fullTime.away : null,
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
  const sources = [];

  const footballData = await fetchFootballDataMatches();
  let matches = footballData?.matches || null;
  let footballDataMatchOdds = footballData?.matchOdds || [];
  if (matches?.length) {
    sources.push("football-data.org");
    matches = mergeMatchMetadata(matches, current.matches || []);
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

  let freshOdds = await fetchPolymarketOdds(current);
  if (!freshOdds) freshOdds = await fetchSunArticleOdds(current);
  const odds = freshOdds || current.odds;
  if (freshOdds?.source) sources.push(freshOdds.source);

  const freshPolymarketMatchOdds = await fetchPolymarketMatchOdds(matches);
  const freshMatchOdds = footballDataMatchOdds.length
    ? {
        source: "football-data.org match odds",
        updatedAt: new Date().toISOString(),
        type: "bookmaker_match",
        matches: footballDataMatchOdds,
      }
    : freshPolymarketMatchOdds.matches.length
      ? freshPolymarketMatchOdds
      : null;
  const matchOdds = freshMatchOdds || current.matchOdds || freshPolymarketMatchOdds;
  if (freshMatchOdds?.source) sources.push(freshMatchOdds.source);

  const next = {
    ...current,
    updatedAt: new Date().toISOString(),
    source: sources.join(" + "),
    matches,
    odds,
    matchOdds,
  };

  await writeFile(DATA_FILE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Updated ${matches.length} matches from ${next.source}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
