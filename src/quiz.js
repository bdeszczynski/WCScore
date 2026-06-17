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
  "Calendula",
  "Calla Lily",
  "Clematis",
  "Clover",
  "Cornflower",
  "Cosmos",
  "Crocus",
  "Daffodil",
  "Delphinium",
  "Edelweiss",
  "Forget-me-not",
  "Foxglove",
  "Freesia",
  "Fuchsia",
  "Geranium",
  "Gladiolus",
  "Hellebore",
  "Hollyhock",
  "Honeysuckle",
  "Hyacinth",
  "Jasmine",
  "Lantana",
  "Lilac",
  "Lotus",
  "Lupine",
  "Morning Glory",
  "Nasturtium",
  "Oleander",
  "Pansy",
  "Passionflower",
  "Petunia",
  "Phlox",
  "Plumeria",
  "Primrose",
  "Ranunculus",
  "Rhododendron",
  "Snapdragon",
  "Snowdrop",
  "Sweet Pea",
  "Verbena",
  "Violet",
  "Wisteria",
  "Zinnia",
  "Aster",
  "Amaryllis",
  "Baby's Breath",
  "Bird of Paradise",
  "Bleeding Heart",
  "Borage",
  "Canterbury Bells",
  "Columbine",
  "Coreopsis",
  "Cyclamen",
  "Flax",
  "Gaillardia",
  "Gazania",
  "Heather",
  "Heliotrope",
  "Impatiens",
  "Kalanchoe",
  "Lisianthus",
  "Lobelia",
  "Mimosa",
  "Nerine",
  "Nigella",
  "Periwinkle",
  "Protea",
  "Salvia",
  "Scabiosa",
  "Stock",
  "Tuberose",
  "Wallflower",
  "Yarrow",
  "Yucca Flower",
  "Gerbera",
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

export function flowerPhotoUrl(name, index, width = 360, height = 240) {
  const tag = encodeURIComponent(name.toLowerCase().replaceAll(" ", "-").replaceAll("'", ""));
  return `https://loremflickr.com/${width}/${height}/${tag},flower?lock=${index + 1}`;
}

export function pickFlowerReward(random = Math.random) {
  const index = Math.floor(random() * FLOWER_REWARDS.length);
  const name = FLOWER_REWARDS[index];
  return {
    name,
    imageUrl: flowerPhotoUrl(name, index),
  };
}
