import { readFile, writeFile } from "node:fs/promises";
import { fetchWikipediaMatches, mergeMatchMetadata } from "./update-data.mjs";

const DATA_FILE = new URL("../public/data/world-cup.json", import.meta.url);
const MANUAL_VENUE_MATCHES = [
  {
    homeTeam: "United States",
    awayTeam: "Australia",
    venue: "Lumen Field",
    venueCity: "Seattle",
    venueCountry: "United States",
    venueWikiUrl: "https://en.wikipedia.org/wiki/Lumen_Field",
  },
  {
    homeTeam: "Turkey",
    awayTeam: "Paraguay",
    venue: "Levi's Stadium",
    venueCity: "Santa Clara",
    venueCountry: "United States",
    venueWikiUrl: "https://en.wikipedia.org/wiki/Levi%27s_Stadium",
  },
  {
    homeTeam: "Turkey",
    awayTeam: "United States",
    venue: "SoFi Stadium",
    venueCity: "Inglewood",
    venueCountry: "United States",
    venueWikiUrl: "https://en.wikipedia.org/wiki/SoFi_Stadium",
  },
  {
    homeTeam: "Paraguay",
    awayTeam: "Australia",
    venue: "Levi's Stadium",
    venueCity: "Santa Clara",
    venueCountry: "United States",
    venueWikiUrl: "https://en.wikipedia.org/wiki/Levi%27s_Stadium",
  },
];

async function main() {
  const data = JSON.parse(await readFile(DATA_FILE, "utf8"));
  const wikipediaMatches = await fetchWikipediaMatches();
  const matches = mergeMatchMetadata(data.matches, [...wikipediaMatches, ...MANUAL_VENUE_MATCHES]);
  const missing = matches.filter((match) => !match.venue || !match.venueWikiUrl);

  if (missing.length) {
    throw new Error(
      `Could not enrich venues for ${missing.length} matches:\n${missing
        .map((match) => `- ${match.id}: ${match.homeTeam} vs ${match.awayTeam}`)
        .join("\n")}`,
    );
  }

  await writeFile(DATA_FILE, `${JSON.stringify({ ...data, matches }, null, 2)}\n`);
  console.log(`Enriched venues for ${matches.length} matches`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
