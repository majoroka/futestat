function preset(defaultZones, byRuleProfileId = {}) {
  return {
    default: defaultZones,
    byRuleProfileId,
  };
}

export const STANDINGS_ZONE_PRESETS = {
  "7": preset([], {
    "league-phase": [
      { from: 1, to: 8, tone: "ucl", label: "Oitavos de final" },
      { from: 9, to: 24, tone: "playoff", label: "Play-off de apuramento" },
    ],
    "knockout-qualification": [],
  }),
  "8": preset([
    { from: 1, to: 4, tone: "ucl", label: "Liga dos Campeões" },
    { from: 5, to: 5, tone: "uel", label: "Liga Europa" },
    { from: 6, to: 6, tone: "uecl", label: "Liga Conferência" },
    { from: 18, to: 20, tone: "relegation", label: "Despromoção" },
  ]),
  "17": preset([
    { from: 1, to: 4, tone: "ucl", label: "Liga dos Campeões" },
    { from: 5, to: 5, tone: "uel", label: "Liga Europa" },
    { from: 6, to: 6, tone: "uecl", label: "Liga Conferência" },
    { from: 18, to: 20, tone: "relegation", label: "Despromoção" },
  ]),
  "20": preset([
    { from: 1, to: 1, tone: "ucl", label: "Liga dos Campeões" },
    { from: 2, to: 3, tone: "uecl", label: "Competições europeias" },
    { from: 14, to: 14, tone: "playoff", label: "Play-off manutenção" },
    { from: 15, to: 16, tone: "relegation", label: "Despromoção" },
  ]),
  "23": preset([
    { from: 1, to: 4, tone: "ucl", label: "Liga dos Campeões" },
    { from: 5, to: 5, tone: "uel", label: "Liga Europa" },
    { from: 6, to: 6, tone: "uecl", label: "Liga Conferência" },
    { from: 18, to: 20, tone: "relegation", label: "Despromoção" },
  ]),
  "35": preset([
    { from: 1, to: 4, tone: "ucl", label: "Liga dos Campeões" },
    { from: 5, to: 5, tone: "uel", label: "Liga Europa" },
    { from: 6, to: 6, tone: "uecl", label: "Liga Conferência" },
    { from: 16, to: 16, tone: "playoff", label: "Play-off manutenção" },
    { from: 17, to: 18, tone: "relegation", label: "Despromoção" },
  ]),
  "39": preset([
    { from: 1, to: 6, tone: "championship", label: "Play-off Campeão" },
    { from: 7, to: 12, tone: "relegation", label: "Play-off Despromoção" },
  ]),
  "46": preset([
    { from: 1, to: 6, tone: "championship", label: "Grupo do campeão" },
    { from: 7, to: 12, tone: "relegation", label: "Grupo de manutenção" },
  ]),
  "152": preset([
    { from: 1, to: 6, tone: "championship", label: "Play-off Campeão" },
    { from: 7, to: 16, tone: "relegation", label: "Play-off manutenção" },
  ]),
  "155": preset([], {
    "arg-group-stage": [
      { from: 1, to: 8, tone: "playoff", label: "Apuramento para a fase a eliminar" },
    ],
  }),
  "170": preset([
    { from: 1, to: 1, tone: "ucl", label: "Liga dos Campeões" },
    { from: 2, to: 4, tone: "uecl", label: "Competições europeias" },
    { from: 9, to: 10, tone: "relegation", label: "Despromoção" },
  ]),
  "211": preset([
    { from: 1, to: 6, tone: "championship", label: "Grupo do campeão" },
    { from: 7, to: 12, tone: "relegation", label: "Grupo de manutenção" },
  ]),
  "212": preset([
    { from: 1, to: 1, tone: "ucl", label: "Liga dos Campeões" },
    { from: 2, to: 3, tone: "uecl", label: "Competições europeias" },
    { from: 9, to: 9, tone: "playoff", label: "Play-off manutenção" },
    { from: 10, to: 10, tone: "relegation", label: "Despromoção" },
  ]),
  "218": preset([
    { from: 1, to: 1, tone: "ucl", label: "Liga dos Campeões" },
    { from: 2, to: 4, tone: "uecl", label: "Competições europeias" },
    { from: 13, to: 14, tone: "relegation", label: "Despromoção" },
  ]),
  "238": preset([
    { from: 1, to: 2, tone: "ucl", label: "Liga dos Campeões" },
    { from: 3, to: 3, tone: "uel", label: "Liga Europa" },
    { from: 4, to: 4, tone: "uecl", label: "Liga Conferência" },
    { from: 16, to: 16, tone: "playoff", label: "Play-off manutenção" },
    { from: 17, to: 18, tone: "relegation", label: "Despromoção" },
  ]),
  "247": preset([
    { from: 1, to: 4, tone: "championship", label: "Grupo do título" },
    { from: 5, to: 8, tone: "uecl", label: "Grupo europeu" },
    { from: 9, to: 16, tone: "relegation", label: "Grupo de manutenção" },
  ]),
  "325": preset([
    { from: 1, to: 6, tone: "libertadores", label: "Libertadores" },
    { from: 7, to: 12, tone: "sudamericana", label: "Copa Sul-Americana" },
    { from: 17, to: 20, tone: "relegation", label: "Despromoção" },
  ]),
  "679": preset([], {
    "league-phase": [
      { from: 1, to: 8, tone: "ucl", label: "Oitavos de final" },
      { from: 9, to: 24, tone: "playoff", label: "Play-off de apuramento" },
    ],
    "knockout-qualification": [],
  }),
  "17015": preset([], {
    "league-phase": [
      { from: 1, to: 8, tone: "ucl", label: "Oitavos de final" },
      { from: 9, to: 24, tone: "playoff", label: "Play-off de apuramento" },
    ],
    "knockout-qualification": [],
  }),
};

export function getStandingsZonePreset(competitionId, ruleProfileId = null) {
  if (!competitionId) {
    return [];
  }

  const presetConfig = STANDINGS_ZONE_PRESETS[String(competitionId)] ?? null;
  if (!presetConfig) {
    return [];
  }

  if (Array.isArray(presetConfig)) {
    return presetConfig;
  }

  if (ruleProfileId && Array.isArray(presetConfig.byRuleProfileId?.[ruleProfileId])) {
    return presetConfig.byRuleProfileId[ruleProfileId];
  }

  return presetConfig.default ?? [];
}
