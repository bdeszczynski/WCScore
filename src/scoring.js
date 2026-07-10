export function normalizeTeam(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ");
}

export function isSameTeam(a, b) {
  return normalizeTeam(a) === normalizeTeam(b);
}

export function stageKind(stage = "") {
  const value = String(stage).toLowerCase();
  if (value.includes("group")) return "group";
  if (value.includes("semi")) return "semi";
  if (value.includes("round") || value.includes("last") || value.includes("quarter") || value.includes("knockout")) {
    return "knockout";
  }
  if (value.includes("final")) return "final";
  return "unknown";
}

export function isFinished(match) {
  return Boolean(match && match.status === "finished" && Number.isFinite(match.homeGoals) && Number.isFinite(match.awayGoals));
}

export function scoreMatchForTeam(match, teamName) {
  if (!isFinished(match)) return null;
  const isHome = isSameTeam(match.homeTeam, teamName);
  const isAway = isSameTeam(match.awayTeam, teamName);
  if (!isHome && !isAway) return null;

  const gf = isHome ? match.homeGoals : match.awayGoals;
  const ga = isHome ? match.awayGoals : match.homeGoals;
  const penaltyWinner = stageKind(match.stage) !== "group" && match.winnerAfterPenalties;
  const penaltyWon = penaltyWinner && isSameTeam(match.winnerAfterPenalties, teamName);
  const penaltyLost = penaltyWinner && !penaltyWon;

  let points = 0;
  let win = 0;
  let draw = 0;
  let loss = 0;
  let penaltyBonus = 0;

  if (penaltyWon) {
    points = 3;
    win = 1;
  } else if (penaltyLost) {
    loss = 1;
  } else if (gf > ga) {
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

export function aggregateTeam(matches, teamName, owner) {
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

  for (const match of matches) {
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

export function countRemainingGroupMatches(matches, teamName) {
  return matches.filter((match) => {
    if (isFinished(match) || stageKind(match.stage) !== "group") return false;
    return isSameTeam(match.homeTeam, teamName) || isSameTeam(match.awayTeam, teamName);
  }).length;
}

export function bonusStatus(matches, teamName) {
  const knockoutAdvancedToSemi = matches.some((match) => {
    if (stageKind(match.stage) !== "knockout" || !isFinished(match)) return false;
    const winner =
      match.winnerAfterPenalties ||
      (match.homeGoals > match.awayGoals ? match.homeTeam : match.awayGoals > match.homeGoals ? match.awayTeam : "");
    return Boolean(winner && isSameTeam(winner, teamName) && /quarter/i.test(String(match.stage)));
  });

  const semiReached = matches.some((match) => {
    const kind = stageKind(match.stage);
    return (kind === "semi" || kind === "final") && (isSameTeam(match.homeTeam, teamName) || isSameTeam(match.awayTeam, teamName));
  }) || knockoutAdvancedToSemi;

  const final = matches.find((match) => stageKind(match.stage) === "final" && isFinished(match));
  const champion =
    final &&
    (final.winnerAfterPenalties ||
      (final.homeGoals > final.awayGoals ? final.homeTeam : final.awayGoals > final.homeGoals ? final.awayTeam : ""));

  const wonCup = Boolean(champion && isSameTeam(champion, teamName));
  return {
    semiReached,
    wonCup,
    points: (semiReached ? 3 : 0) + (wonCup ? 7 : 0),
  };
}

export function getPlayerBonusSelections(player) {
  const selections = new Map();
  for (const team of player.pointsTeams) {
    selections.set(normalizeTeam(team.name), { name: team.name, roles: ["points team"] });
  }
  for (const team of player.winnerPicks) {
    const key = normalizeTeam(team.name);
    const current = selections.get(key);
    if (current) {
      current.roles.push("winner pick");
    } else {
      selections.set(key, { name: team.name, roles: ["winner pick"] });
    }
  }
  return [...selections.values()];
}

export function comparePlayerTotals(a, b) {
  if (b.total !== a.total) return b.total - a.total;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return 0;
}
