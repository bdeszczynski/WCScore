import { flagUrlForTeam } from "./flags.js";
import { isSameTeam } from "./scoring.js";

export const SIMILAR_FLAG_CHOICES = {
  Australia: ["New Zealand", "Fiji"],
  "New Zealand": ["Australia", "Fiji"],
  "Ivory Coast": ["Ireland", "Italy"],
  Mexico: ["Italy", "Ireland"],
  Italy: ["Mexico", "Ireland"],
  France: ["Netherlands", "Russia"],
  Netherlands: ["France", "Luxembourg"],
  Senegal: ["Ghana", "Cameroon"],
  Ghana: ["Senegal", "Cameroon"],
  Egypt: ["Iraq", "Syria"],
  Iraq: ["Egypt", "Syria"],
  Qatar: ["Bahrain", "Kuwait"],
  "Saudi Arabia": ["Pakistan", "Iran"],
  Jordan: ["Palestine", "Sudan"],
  Morocco: ["Tunisia", "Turkey"],
  Tunisia: ["Turkey", "Morocco"],
  Turkey: ["Tunisia", "Morocco"],
  Paraguay: ["Netherlands", "Croatia"],
  Croatia: ["Paraguay", "Serbia"],
  Ecuador: ["Colombia", "Venezuela"],
  Colombia: ["Ecuador", "Venezuela"],
  "United States": ["Malaysia", "Liberia"],
  England: ["Georgia", "Denmark"],
  Scotland: ["Greece", "Finland"],
  Norway: ["Iceland", "Faroe Islands"],
  Sweden: ["Finland", "Iceland"],
  Switzerland: ["Denmark", "Georgia"],
  Japan: ["Bangladesh", "Palau"],
  "South Korea": ["Japan", "Mongolia"],
};

export const FLOWER_REWARDS = [
  "Rose",
  "Tulip",
  "Sunflower",
  "Daisy",
  "Lily",
  "Orchid",
  "Iris",
  "Peony",
  "Dahlia",
  "Hydrangea",
  "Lavender",
  "Marigold",
  "Carnation",
  "Chrysanthemum",
  "Hibiscus",
  "Gardenia",
  "Magnolia",
  "Poppy",
  "Anemone",
  "Camellia",
  "Azalea",
  "Begonia",
  "Bluebell",
  "Bougainvillea",
  "Buttercup",
];

export const CAPITAL_QUESTIONS = {
  Algeria: { capital: "Algiers", choices: ["Tunis", "Rabat"] },
  Argentina: { capital: "Buenos Aires", choices: ["Montevideo", "Santiago"] },
  Australia: { capital: "Canberra", choices: ["Sydney", "Melbourne"] },
  Austria: { capital: "Vienna", choices: ["Bratislava", "Prague"] },
  Belgium: { capital: "Brussels", choices: ["Amsterdam", "Luxembourg"] },
  "Bosnia-Herzegovina": { capital: "Sarajevo", choices: ["Belgrade", "Zagreb"] },
  Brazil: { capital: "Brasilia", choices: ["Rio de Janeiro", "Sao Paulo"] },
  Canada: { capital: "Ottawa", choices: ["Toronto", "Montreal"] },
  "Cape Verde Islands": { capital: "Praia", choices: ["Mindelo", "Bissau"] },
  Colombia: { capital: "Bogota", choices: ["Quito", "Caracas"] },
  "Congo DR": { capital: "Kinshasa", choices: ["Brazzaville", "Luanda"] },
  Croatia: { capital: "Zagreb", choices: ["Belgrade", "Sarajevo"] },
  Curaçao: { capital: "Willemstad", choices: ["Oranjestad", "Kralendijk"] },
  Czechia: { capital: "Prague", choices: ["Bratislava", "Vienna"] },
  Ecuador: { capital: "Quito", choices: ["Bogota", "Lima"] },
  Egypt: { capital: "Cairo", choices: ["Alexandria", "Amman"] },
  England: { capital: "London", choices: ["Cardiff", "Edinburgh"] },
  France: { capital: "Paris", choices: ["Lyon", "Marseille"] },
  Germany: { capital: "Berlin", choices: ["Munich", "Frankfurt"] },
  Ghana: { capital: "Accra", choices: ["Kumasi", "Abidjan"] },
  Haiti: { capital: "Port-au-Prince", choices: ["Santo Domingo", "Kingston"] },
  Iran: { capital: "Tehran", choices: ["Isfahan", "Baghdad"] },
  Iraq: { capital: "Baghdad", choices: ["Basra", "Tehran"] },
  "Ivory Coast": { capital: "Yamoussoukro", choices: ["Abidjan", "Accra"] },
  Japan: { capital: "Tokyo", choices: ["Kyoto", "Osaka"] },
  Jordan: { capital: "Amman", choices: ["Aqaba", "Damascus"] },
  Mexico: { capital: "Mexico City", choices: ["Guadalajara", "Monterrey"] },
  Morocco: { capital: "Rabat", choices: ["Casablanca", "Marrakesh"] },
  Netherlands: { capital: "Amsterdam", choices: ["Rotterdam", "The Hague"] },
  "New Zealand": { capital: "Wellington", choices: ["Auckland", "Christchurch"] },
  Norway: { capital: "Oslo", choices: ["Bergen", "Stockholm"] },
  Panama: { capital: "Panama City", choices: ["San Jose", "Medellin"] },
  Paraguay: { capital: "Asuncion", choices: ["Montevideo", "La Paz"] },
  Portugal: { capital: "Lisbon", choices: ["Porto", "Madrid"] },
  Qatar: { capital: "Doha", choices: ["Manama", "Abu Dhabi"] },
  "Saudi Arabia": { capital: "Riyadh", choices: ["Jeddah", "Doha"] },
  Scotland: { capital: "Edinburgh", choices: ["Glasgow", "Cardiff"] },
  Senegal: { capital: "Dakar", choices: ["Banjul", "Bamako"] },
  "South Africa": { capital: "Pretoria", choices: ["Cape Town", "Johannesburg"] },
  "South Korea": { capital: "Seoul", choices: ["Busan", "Pyongyang"] },
  Spain: { capital: "Madrid", choices: ["Barcelona", "Lisbon"] },
  Sweden: { capital: "Stockholm", choices: ["Gothenburg", "Oslo"] },
  Switzerland: { capital: "Bern", choices: ["Zurich", "Geneva"] },
  Tunisia: { capital: "Tunis", choices: ["Sfax", "Algiers"] },
  Turkey: { capital: "Ankara", choices: ["Istanbul", "Izmir"] },
  "United States": { capital: "Washington, D.C.", choices: ["New York", "Philadelphia"] },
  Uruguay: { capital: "Montevideo", choices: ["Asuncion", "Buenos Aires"] },
  Uzbekistan: { capital: "Tashkent", choices: ["Samarkand", "Bishkek"] },
};

export function shuffle(items, random = Math.random) {
  return [...items].sort(() => random() - 0.5);
}

export function buildFlagQuizOptions(correct, teams, random = Math.random) {
  const similar = SIMILAR_FLAG_CHOICES[correct] || [];
  const fallback = shuffle(
    teams.filter((team) => !isSameTeam(team, correct) && !similar.some((choice) => isSameTeam(choice, team))),
    random,
  );
  const options = [correct, ...similar, ...fallback];
  const unique = [];
  for (const option of options) {
    if (!unique.some((existing) => isSameTeam(existing, option))) unique.push(option);
    if (unique.length === 3) break;
  }
  return shuffle(unique, random);
}

export function buildCapitalQuizQuestion(teams, random = Math.random) {
  const candidates = shuffle(
    teams.filter((team) => CAPITAL_QUESTIONS[team]?.capital),
    random,
  );
  const country = candidates[0];
  if (!country) return null;
  const row = CAPITAL_QUESTIONS[country];
  return {
    country,
    correct: row.capital,
    options: shuffle([row.capital, ...row.choices].slice(0, 3), random),
  };
}

export function flagQuestionForTeam(team) {
  return {
    kind: "flag",
    eyebrow: "Flag quiz",
    title: "Which country is this?",
    imageUrl: flagUrlForTeam(team, 320),
    correct: team,
  };
}

export function flowerImageUrl(name, index, width = 360, height = 240) {
  const palettes = [
    ["#d94b5f", "#ffd6de", "#f8b24e"],
    ["#f28b30", "#ffe0a8", "#8f4c23"],
    ["#f2c94c", "#fff2a6", "#5b4226"],
    ["#f7f7f2", "#f4d35e", "#65845f"],
    ["#ffffff", "#f6c1d6", "#5b7f72"],
    ["#b56bd8", "#efd4ff", "#e7b33f"],
    ["#5f6fd6", "#cdd5ff", "#f2c14e"],
    ["#f0769f", "#ffd6e7", "#7f4f24"],
    ["#b93a32", "#ffb199", "#443627"],
    ["#6aa6d9", "#d8eefb", "#4c6f73"],
    ["#8d6ac8", "#d9c8ff", "#6c7d47"],
    ["#d66b2f", "#ffd3a3", "#80521f"],
    ["#e65a73", "#ffc7d1", "#775241"],
    ["#f0b13c", "#ffe1a1", "#606c38"],
    ["#e4475d", "#ffb4c1", "#40513b"],
    ["#f8efe4", "#f2c078", "#4f6f52"],
    ["#f4d7dc", "#fff0f5", "#728c69"],
    ["#df443a", "#ffb1a9", "#2f3e46"],
    ["#7a5cc9", "#d8cafd", "#466365"],
    ["#f0b6c7", "#ffe3ed", "#567d46"],
    ["#e24d60", "#ffc4ce", "#6f4e37"],
    ["#ef8fa7", "#ffd4df", "#6b705c"],
    ["#497bd1", "#c9dbff", "#587d71"],
    ["#d8509d", "#ffc6e9", "#5a6f43"],
    ["#ffd34d", "#fff0a8", "#5b5f2a"],
  ];
  const [petal, petalLight, center] = palettes[index % palettes.length];
  const rotation = (index * 17) % 360;
  const petalCount = 8 + (index % 5);
  const petals = Array.from({ length: petalCount }, (_, petalIndex) => {
    const angle = (360 / petalCount) * petalIndex + rotation;
    return `<ellipse cx="180" cy="88" rx="28" ry="68" fill="${petal}" opacity="0.9" transform="rotate(${angle} 180 120)" />`;
  }).join("");
  const sparkles = Array.from({ length: 8 }, (_, sparkleIndex) => {
    const x = 48 + ((sparkleIndex * 37 + index * 19) % 264);
    const y = 28 + ((sparkleIndex * 29 + index * 13) % 176);
    const size = 2 + ((sparkleIndex + index) % 4);
    return `<circle cx="${x}" cy="${y}" r="${size}" fill="${petalLight}" opacity="0.55" />`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 360 240" role="img" aria-label="${name}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fffaf2" />
        <stop offset="1" stop-color="#efe9dd" />
      </linearGradient>
      <radialGradient id="petalGlow" cx="50%" cy="35%" r="65%">
        <stop offset="0" stop-color="${petalLight}" />
        <stop offset="1" stop-color="${petal}" />
      </radialGradient>
    </defs>
    <rect width="360" height="240" rx="20" fill="url(#bg)" />
    ${sparkles}
    <path d="M180 141 C152 159 129 181 118 213" fill="none" stroke="#5e7d55" stroke-width="9" stroke-linecap="round" />
    <path d="M148 179 C126 166 100 164 76 178 C107 192 130 191 148 179Z" fill="#7da966" opacity="0.9" />
    <path d="M180 170 C205 154 232 152 258 168 C230 186 204 186 180 170Z" fill="#678f57" opacity="0.9" />
    <g>
      ${petals}
      <circle cx="180" cy="120" r="42" fill="url(#petalGlow)" opacity="0.32" />
      <circle cx="180" cy="120" r="27" fill="${center}" />
      <circle cx="171" cy="111" r="7" fill="#fff4c7" opacity="0.72" />
    </g>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function pickFlowerReward(random = Math.random) {
  const index = Math.min(FLOWER_REWARDS.length - 1, Math.floor(random() * FLOWER_REWARDS.length));
  const name = FLOWER_REWARDS[index];
  return {
    name,
    imageUrl: flowerImageUrl(name, index),
  };
}
