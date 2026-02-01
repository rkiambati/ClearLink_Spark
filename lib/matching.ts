import { db } from "@/lib/db";

function requiresWheelchair(mobilityNeeds: string) {
  return mobilityNeeds.toUpperCase().includes("WHEEL");
}

async function getDistanceKm(fromZone: string, toZone: string) {
  if (fromZone === toZone) return 0;
  const row = await db.zoneDistance.findUnique({
    where: { fromZone_toZone: { fromZone, toZone } },
  });
  return row?.km ?? 9999;
}

export async function rankResourcesForTask(input: {
  pickupZone: string;
  mobilityNeeds: string;
}) {
  const needWheelchair = requiresWheelchair(input.mobilityNeeds);

  const resources = await db.resource.findMany({
    where: {
      isActive: true,
      ...(needWheelchair ? { wheelchairOk: true } : {}),
    },
  });

  const scored = await Promise.all(
    resources.map(async (r) => {
      const distKm = await getDistanceKm(r.startZone, input.pickupZone);
      return {
        resource: r,
        distKm,
        reliability: r.reliabilityScore,
      };
    })
  );

  scored.sort((a, b) => {
    if (a.distKm !== b.distKm) return a.distKm - b.distKm; // closer first
    return b.reliability - a.reliability; // higher reliability first
  });

  return scored;
}
