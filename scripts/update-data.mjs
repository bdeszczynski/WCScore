import { readFile, writeFile } from "node:fs/promises";

const DATA_FILE = new URL("../public/data/world-cup.json", import.meta.url);
const WIKIPEDIA_PAGES = [
  "2026_FIFA_World_Cup",
  ...Array.from({ length: 12 }, (_, index) => `2026_FIFA_World_Cup_Group_${String.fromCharCode(65 + index)}`),
];
const FOOTBALL_DATA_URL = "https://api.football-data.org/v4/competitions/WC/matches";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ODDSCHECKER_WINNER_URL = "https://www.oddschecker.com/football/world-cup/winner";
const ODDSCHECKER_TEAMS = [
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
  "https://nypost.com/2026/05/18/betting/2026-world-cup-odds-france-spain-co-favorites-to-lift-the-trophy/",
  "https://www.kiplinger.com/taxes/world-cup-betting-odds-and-gambling-tax",
];
const FALLBACK_WINNER_ODDS = [
  { team: "Brazil", american: 900, source: "The Sun public odds article" },
  { team: "France", american: 450, source: "The Sun public odds article" },
  { team: "Netherlands", fractional: "20/1", source: "New York Post public odds article" },
  { team: "Portugal", american: 850, source: "The Sun public odds article" },
];

const fifaCodeMap = new Map(
  Object.entries({
    ARG: "Argentina",
    AUS: "Australia",
    BEL: "Belgium",
    BRA: "Brazil",
    CAN: "Canada",
    COL: "Colombia",
    CRO: "Croatia",
    DEN: "Denmark",
    ECU: "Ecuador",
    EGY: "Egypt",
    ENG: "England",
    ESP: "Spain",
    FRA: "France",
    GER: "Germany",
    IRN: "Iran",
    ITA: "Italy",
    JPN: "Japan",
    KOR: "South Korea",
    MAR: "Morocco",
    MEX: "Mexico",
    NED: "Netherlands",
    NOR: "Norway",
    POR: "Portugal",
    QAT: "Qatar",
    SUI: "Switzerland",
    URU: "Uruguay",
    USA: "United States",
  }),
);

function normalizeTeam(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ");
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

function fallbackWinnerOdds() {
  return FALLBACK_WINNER_ODDS.map((entry) => ({
    team: entry.team,
    decimal: entry.american ? americanToDecimal(entry.american) : fractionalToDecimal(entry.fractional),
    bookmaker: entry.source,
  }));
}

function extractPublicOdds(html, team) {
  const escaped = team.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const american = new RegExp(`${escaped}[\\s\\S]{0,90}?\\+(\\d{3,4})`, "i").exec(html);
  if (american) return americanToDecimal(american[1]);
  const fractional = new RegExp(`${escaped}[\\s\\S]{0,90}?(\\d{1,2}\\s*/\\s*1)`, "i").exec(html);
  if (fractional) return fractionalToDecimal(fractional[1]);
  return null;
}

function decodeHtml(value) {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToLines(html) {
  return decodeHtml(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<[^>]+>/g, "\n"),
  )
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function isOddscheckerTeam(line) {
  const normalized = normalizeTeam(line);
  return ODDSCHECKER_TEAMS.find((team) => normalizeTeam(team) === normalized) || null;
}

function parseOddscheckerToken(line) {
  const token = line.replace(/\s*\/\s*/g, "/");
  if (!/^\d{1,3}(?:\/\d{1,3})?$/.test(token)) return null;
  const decimal = fractionalToDecimal(token);
  if (!decimal || decimal < 1.01 || decimal > 501) return null;
  return { token, decimal };
}

function extractOddscheckerRows(html, limit = 5) {
  const lines = htmlToLines(html);
  const starts = lines.map((line, index) => (line === "QuickBet" ? index : -1)).filter((index) => index >= 0);

  for (const start of starts) {
    const rows = [];
    for (let index = start + 1; index < lines.length && rows.length < limit; index += 1) {
      const team = isOddscheckerTeam(lines[index]);
      if (!team) continue;

      const odds = [];
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        if (isOddscheckerTeam(lines[cursor]) || lines[cursor] === "Sort By") break;
        const parsed = parseOddscheckerToken(lines[cursor]);
        if (parsed) odds.push(parsed);
      }

      if (odds.length < 4) continue;
      const best = odds.reduce((bestPrice, current) => (current.decimal > bestPrice.decimal ? current : bestPrice), odds[0]);
      rows.push({
        rank: rows.length + 1,
        team,
        decimal: Number(best.decimal.toFixed(2)),
        fractional: best.token,
        bookmaker: "Oddschecker best public price",
      });
    }

    if (rows.length >= limit) return rows;
  }

  return [];
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

  text = text.replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1").replace(/\[\[([^\]]+)\]\]/g, "$1");
  text = text.replace(/\{\{[^}]+\}\}/g, "");
  return text.replace(/\s+/g, " ").trim();
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
  const marker = "{{football box";
  let index = 0;

  while (index < wikitext.length) {
    const start = wikitext.toLowerCase().indexOf(marker, index);
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
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    response = await fetch(url, {
      headers: { "User-Agent": "WCScore/1.0 (static score tracker)" },
    });
    if (response.ok) break;
    if (response.status !== 429 || attempt === 3) break;
    await sleep(2000 * attempt);
  }
  if (!response.ok) throw new Error(`Wikipedia request failed for ${page}: ${response.status}`);
  const json = await response.json();
  const wikitext = json?.parse?.wikitext?.["*"];
  if (!wikitext) throw new Error(`Wikipedia response did not contain wikitext for ${page}`);
  return wikitext;
}

async function fetchWikipediaMatches() {
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

        return {
          id: `wiki-${page.toLowerCase().replaceAll("_", "-")}-${index + 1}-${normalizeTeam(homeTeam).replaceAll(" ", "-")}-${normalizeTeam(awayTeam).replaceAll(" ", "-")}`,
          stage,
          kickoff,
          homeTeam,
          awayTeam,
          ...score,
          winnerAfterPenalties,
        };
      })
      .filter(Boolean);

    matches.push(...pageMatches);
    await sleep(900);
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
    kickoff: match.utcDate || null,
    homeTeam,
    awayTeam,
    status: finished ? "finished" : "scheduled",
    homeGoals: finished ? fullTime.home : null,
    awayGoals: finished ? fullTime.away : null,
    winnerAfterPenalties,
  };
}

async function fetchFootballDataMatches() {
  if (!process.env.FOOTBALL_DATA_TOKEN) return null;
  const response = await fetch(FOOTBALL_DATA_URL, {
    headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_TOKEN },
  });
  if (!response.ok) throw new Error(`football-data.org request failed: ${response.status}`);
  const json = await response.json();
  return json.matches.map(normalizeFootballDataMatch).filter(Boolean);
}

async function fetchOddscheckerOdds() {
  try {
    const response = await fetch(ODDSCHECKER_WINNER_URL, {
      headers: { "User-Agent": "WCScore/1.0 (static score tracker)" },
    });
    if (!response.ok) throw new Error(`Oddschecker request failed: ${response.status}`);

    const rows = extractOddscheckerRows(await response.text());
    if (rows.length < 5) throw new Error(`Oddschecker scrape found ${rows.length} usable rows`);

    return {
      source: "Oddschecker World Cup Winner odds",
      updatedAt: new Date().toISOString(),
      teams: rows,
    };
  } catch (error) {
    console.warn(`Oddschecker scrape failed: ${error.message}`);
    return null;
  }
}

async function fetchPublicArticleOdds() {
  const odds = new Map(fallbackWinnerOdds().map((entry) => [normalizeTeam(entry.team), entry]));

  for (const url of PUBLIC_ODDS_SOURCES) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "WCScore/1.0 (static score tracker)" },
      });
      if (!response.ok) continue;
      const html = await response.text();
      for (const entry of FALLBACK_WINNER_ODDS) {
        const decimal = extractPublicOdds(html, entry.team);
        if (decimal) {
          odds.set(normalizeTeam(entry.team), {
            team: entry.team,
            decimal,
            bookmaker: "Public odds article",
          });
        }
      }
    } catch (error) {
      console.warn(`Public odds scrape failed for ${url}: ${error.message}`);
    }
  }

  return {
    source: "Public World Cup odds articles",
    updatedAt: new Date().toISOString(),
    teams: [...odds.values()].sort((a, b) => a.team.localeCompare(b.team)),
  };
}

async function main() {
  const current = JSON.parse(await readFile(DATA_FILE, "utf8"));
  const sources = [];

  let matches = await fetchFootballDataMatches();
  if (matches?.length) {
    sources.push("football-data.org");
  } else {
    matches = await fetchWikipediaMatches();
    if (matches.length) {
      sources.push("Wikipedia");
    } else {
      matches = current.matches;
      sources.push("Existing fixtures; no fresh matches found");
    }
  }

  let freshOdds = await fetchOddscheckerOdds();
  if (!freshOdds && (current.odds?.teams || []).length < 5) {
    freshOdds = await fetchPublicArticleOdds();
  }
  const odds = freshOdds || current.odds;
  if (freshOdds?.source) sources.push(freshOdds.source);

  const next = {
    ...current,
    updatedAt: new Date().toISOString(),
    source: sources.join(" + "),
    matches,
    odds,
  };

  await writeFile(DATA_FILE, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Updated ${matches.length} matches from ${next.source}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
