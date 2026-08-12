export interface CompetitionTeamSeed {
  sofascoreTeamId: string;
  teamName: string;
  countryName: string;
}

const DEFAULT_COMPETITION_TEAM_SEEDS = new Map<string, CompetitionTeamSeed[]>([
  [
    "49",
    [
      { sofascoreTeamId: "2216", teamName: "Slavia Praha", countryName: "Czech Republic" },
      { sofascoreTeamId: "2205", teamName: "Jablonec", countryName: "Czech Republic" },
      { sofascoreTeamId: "2224", teamName: "Mladá Boleslav", countryName: "Czech Republic" },
      { sofascoreTeamId: "2208", teamName: "Teplice", countryName: "Czech Republic" },
      { sofascoreTeamId: "2217", teamName: "Hradec Králové", countryName: "Czech Republic" },
      { sofascoreTeamId: "2219", teamName: "Slovan Liberec", countryName: "Czech Republic" },
      { sofascoreTeamId: "2210", teamName: "Zbrojovka Brno", countryName: "Czech Republic" },
      { sofascoreTeamId: "2207", teamName: "SK Sigma Olomouc", countryName: "Czech Republic" },
      { sofascoreTeamId: "6064", teamName: "Bohemians Praha 1905", countryName: "Czech Republic" },
      { sofascoreTeamId: "2218", teamName: "Sparta Praha", countryName: "Czech Republic" },
      { sofascoreTeamId: "2204", teamName: "Baník Ostrava", countryName: "Czech Republic" },
      { sofascoreTeamId: "4502", teamName: "Viktoria Plzeň", countryName: "Czech Republic" },
      { sofascoreTeamId: "35264", teamName: "SK Artis Brno", countryName: "Czech Republic" },
      { sofascoreTeamId: "4871", teamName: "1. FC Slovácko", countryName: "Czech Republic" },
      { sofascoreTeamId: "2230", teamName: "FK Pardubice", countryName: "Czech Republic" },
      { sofascoreTeamId: "2220", teamName: "FC Zlín", countryName: "Czech Republic" },
    ],
  ],
]);

export function getCompetitionTeamSeeds(competitionId: string | null): CompetitionTeamSeed[] {
  if (!competitionId) {
    return [];
  }

  return DEFAULT_COMPETITION_TEAM_SEEDS.get(competitionId) ?? [];
}
