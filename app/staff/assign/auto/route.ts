import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

function mobilityRequiresWheelchair(mobility: string) {
  return mobility.toUpperCase().includes("WHEEL");
}

async function getDistanceKm(fromZone: string, toZone: string) {
  if (fromZone === toZone) return 0;
  const row = await db.zoneDistance.findUnique({
    where: { fromZone_toZone: { fromZone, toZone } },
  });
  return row?.km ?? 9999;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.user || session.user.role !== "STAFF") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Pick the highest priority requested task
  const task = await db.transportTask.findFirst({
    where: { status: "REQUESTED" },
    orderBy: { appointment: { priorityScore: "desc" } },
    include: { appointment: { include: { patient: true } } },
  });

  if (!task) return NextResponse.redirect(new URL("/staff/dashboard", req.url));

  const pickupZone = task.appointment.patient.pickupZone;
  const needWheelchair = mobilityRequiresWheelchair(
    task.appointment.patient.mobilityNeeds
  );

  // Candidate resources
  const resources = await db.resource.findMany({
    where: {
      isActive: true,
      ...(needWheelchair ? { wheelchairOk: true } : {}),
    },
  });

  if (resources.length === 0) {
    await db.transportTask.update({
      where: { id: task.id },
      data: { status: "MANUAL_REQUIRED" },
    });

    await db.auditLog.create({
      data: {
        actorUserId: session.user.userId,
        actorRole: "STAFF",
        action: "AUTO_ASSIGN_FAILED_NO_RESOURCES",
        entityType: "TransportTask",
        entityId: task.id,
        metaJson: JSON.stringify({ pickupZone, needWheelchair }),
      },
    });

    return NextResponse.redirect(new URL("/staff/dashboard", req.url));
  }

  // Score: smallest distance wins, then highest reliability
  let best = null as null | { id: string; dist: number; rel: number };

  for (const r of resources) {
    const dist = await getDistanceKm(r.startZone, pickupZone);
    const rel = r.reliabilityScore;
    const candidate = { id: r.id, dist, rel };

    if (!best) best = candidate;
    else if (candidate.dist < best.dist) best = candidate;
    else if (candidate.dist === best.dist && candidate.rel > best.rel) best = candidate;
  }

  if (!best) {
    return NextResponse.redirect(new URL("/staff/dashboard", req.url));
  }

  await db.transportTask.update({
    where: { id: task.id },
    data: {
      status: "ASSIGNED",
      assignedResourceId: best.id,
    },
  });

  await db.resource.update({
    where: { id: best.id },
    data: {
      totalAssigned: { increment: 1 },
    },
  });

  await db.auditLog.create({
    data: {
      actorUserId: session.user.userId,
      actorRole: "STAFF",
      action: "TASK_ASSIGNED_AUTO",
      entityType: "TransportTask",
      entityId: task.id,
      metaJson: JSON.stringify({
        pickupZone,
        chosenResourceId: best.id,
        distanceKm: best.dist,
        reliabilityScore: best.rel,
      }),
    },
  });

  return NextResponse.redirect(new URL("/staff/dashboard", req.url));
}
