export function computePriorityBreakdown(input: {
  urgencyTier: number;
  hoursUntilAppt: number;
  distanceBand: number;
  winterMode: boolean;
  mobilityNeeds: string;
  missedHistory: number;
}) {
  const { urgencyTier, hoursUntilAppt: H, distanceBand, winterMode, mobilityNeeds, missedHistory } =
    input;

  // Urgency
  const urgencyPoints = urgencyTier === 2 ? 40 : urgencyTier === 1 ? 20 : 0;

  // TimeRisk (B schedule)
  const timeRiskPoints = H <= 24 ? 25 : H <= 48 ? 18 : H <= 72 ? 10 : 0;

  // AccessRisk
  const distancePoints = distanceBand === 2 ? 22 : distanceBand === 1 ? 12 : 0;
  const winterPoints = winterMode ? 5 : 0;

  const mob = mobilityNeeds.toUpperCase();
  const mobilityPoints = mob.includes("WHEEL") ? 10 : mob.includes("ASSIST") ? 6 : 0;

  const accessRaw = distancePoints + winterPoints + mobilityPoints;
  const accessRiskPoints = Math.min(30, accessRaw);

  // Missed history
  const missedPoints =
    missedHistory >= 3 ? 25 : missedHistory === 2 ? 16 : missedHistory === 1 ? 8 : 0;

  const total = Math.min(120, urgencyPoints + timeRiskPoints + accessRiskPoints + missedPoints);

  return {
    inputs: {
      urgencyTier,
      hoursUntilAppt: Math.round(H * 10) / 10,
      distanceBand,
      winterMode,
      mobilityNeeds,
      missedHistory,
    },
    points: {
      urgencyPoints,
      timeRiskPoints,
      accessRisk: {
        distancePoints,
        winterPoints,
        mobilityPoints,
        cappedAt30: accessRiskPoints,
      },
      missedPoints,
    },
    total,
  };
}

export function computePriorityScore(input: Parameters<typeof computePriorityBreakdown>[0]): number {
  return computePriorityBreakdown(input).total;
}

export function scoreToSlaHours(score: number): number {
  if (score >= 90) return 12;
  if (score >= 70) return 24;
  if (score >= 40) return 48;
  return 72;
}
