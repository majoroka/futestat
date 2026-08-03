export const STANDINGS_ZONE_PRESETS = {
  "8": [
    { from: 1, to: 4, tone: "ucl", label: "Liga dos Campeões" },
    { from: 5, to: 5, tone: "uel", label: "Liga Europa" },
    { from: 6, to: 6, tone: "uecl", label: "Liga Conferência" },
    { from: 18, to: 20, tone: "relegation", label: "Despromoção" },
  ],
  "17": [
    { from: 1, to: 4, tone: "ucl", label: "Liga dos Campeões" },
    { from: 5, to: 5, tone: "uel", label: "Liga Europa" },
    { from: 6, to: 6, tone: "uecl", label: "Liga Conferência" },
    { from: 18, to: 20, tone: "relegation", label: "Despromoção" },
  ],
  "20": [
    { from: 1, to: 1, tone: "ucl", label: "Liga dos Campeões" },
    { from: 2, to: 3, tone: "uecl", label: "Competições europeias" },
    { from: 14, to: 14, tone: "playoff", label: "Play-off manutenção" },
    { from: 15, to: 16, tone: "relegation", label: "Despromoção" },
  ],
  "23": [
    { from: 1, to: 4, tone: "ucl", label: "Liga dos Campeões" },
    { from: 5, to: 5, tone: "uel", label: "Liga Europa" },
    { from: 6, to: 6, tone: "uecl", label: "Liga Conferência" },
    { from: 18, to: 20, tone: "relegation", label: "Despromoção" },
  ],
  "35": [
    { from: 1, to: 4, tone: "ucl", label: "Liga dos Campeões" },
    { from: 5, to: 5, tone: "uel", label: "Liga Europa" },
    { from: 6, to: 6, tone: "uecl", label: "Liga Conferência" },
    { from: 16, to: 16, tone: "playoff", label: "Play-off manutenção" },
    { from: 17, to: 18, tone: "relegation", label: "Despromoção" },
  ],
  "39": [
    { from: 1, to: 6, tone: "championship", label: "Play-off Campeão" },
    { from: 7, to: 12, tone: "relegation", label: "Play-off Despromoção" },
  ],
  "46": [
    { from: 1, to: 6, tone: "championship", label: "Grupo do campeão" },
    { from: 7, to: 12, tone: "relegation", label: "Grupo de manutenção" },
  ],
  "152": [
    { from: 1, to: 6, tone: "championship", label: "Play-off Campeão" },
    { from: 7, to: 16, tone: "relegation", label: "Play-off manutenção" },
  ],
  "155": [
    { from: 1, to: 1, tone: "libertadores", label: "Libertadores" },
    { from: 2, to: 6, tone: "sudamericana", label: "Competições continentais" },
    { from: 27, to: 30, tone: "relegation", label: "Despromoção" },
  ],
  "170": [
    { from: 1, to: 1, tone: "ucl", label: "Liga dos Campeões" },
    { from: 2, to: 4, tone: "uecl", label: "Competições europeias" },
    { from: 9, to: 10, tone: "relegation", label: "Despromoção" },
  ],
  "211": [
    { from: 1, to: 6, tone: "championship", label: "Grupo do campeão" },
    { from: 7, to: 12, tone: "relegation", label: "Grupo de manutenção" },
  ],
  "212": [
    { from: 1, to: 1, tone: "ucl", label: "Liga dos Campeões" },
    { from: 2, to: 3, tone: "uecl", label: "Competições europeias" },
    { from: 9, to: 9, tone: "playoff", label: "Play-off manutenção" },
    { from: 10, to: 10, tone: "relegation", label: "Despromoção" },
  ],
  "218": [
    { from: 1, to: 1, tone: "ucl", label: "Liga dos Campeões" },
    { from: 2, to: 4, tone: "uecl", label: "Competições europeias" },
    { from: 13, to: 14, tone: "relegation", label: "Despromoção" },
  ],
  "238": [
    { from: 1, to: 2, tone: "ucl", label: "Liga dos Campeões" },
    { from: 3, to: 3, tone: "uel", label: "Liga Europa" },
    { from: 4, to: 4, tone: "uecl", label: "Liga Conferência" },
    { from: 16, to: 16, tone: "playoff", label: "Play-off manutenção" },
    { from: 17, to: 18, tone: "relegation", label: "Despromoção" },
  ],
  "247": [
    { from: 1, to: 4, tone: "championship", label: "Grupo do título" },
    { from: 5, to: 8, tone: "uecl", label: "Grupo europeu" },
    { from: 9, to: 16, tone: "relegation", label: "Grupo de manutenção" },
  ],
  "325": [
    { from: 1, to: 6, tone: "libertadores", label: "Libertadores" },
    { from: 7, to: 12, tone: "sudamericana", label: "Copa Sul-Americana" },
    { from: 17, to: 20, tone: "relegation", label: "Despromoção" },
  ],
};

export function getStandingsZonePreset(competitionId) {
  if (!competitionId) {
    return [];
  }

  return STANDINGS_ZONE_PRESETS[String(competitionId)] ?? [];
}
