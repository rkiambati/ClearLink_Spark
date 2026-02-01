import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { computePriorityBreakdown, scoreToSlaHours } from "@/lib/priority";

const schema = z.object({ taskId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.user || session.user.role !== "STAFF") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const formData = await req.formData();
  const parsed = schema.safeParse({ taskId: formData.get("taskId")?.toString() });
  if (!parsed.success) return NextResponse.redirect(new URL("/staff/dashboard", req.url));

  const task = await db.transportTask.findUnique({
    where: { id: parsed.data.taskId },
    include: {
      appointment: { include: { patient: true } },
    },
  });
  if (!task) return NextResponse.redirect(new URL("/staff/dashboard", req.url));

  const appt = task.appointment;
  const newScheduledAt = new Date(new Date(appt.scheduledAt).getTime() + 24 * 60 * 60 * 1000);

  const hoursUntilAppt = Math.max(0, (newScheduledAt.getTime() - Date.now()) / (1000 * 60 * 60));

  const breakdown = computePriorityBreakdown({
    urgencyTier: appt.urgencyTier,
    hoursUntilAppt,
    distanceBand: appt.distanceBand,
    winterMode: appt.winterMode,
    mobilityNeeds: appt.patient.mobilityNeeds,
    missedHistory: appt.missedHistory,
  });

  const priorityScore = breakdown.total;
  const slaHours = scoreToSlaHours(priorityScore);

  await db.appointment.update({
    where: { id: appt.id },
    data: {
      scheduledAt: newScheduledAt,
      status: "RESCHEDULED",
      priorityScore,
      priorityBreakdownJson: JSON.stringify(breakdown),
    },
  });

  await db.transportTask.update({
    where: { id: task.id },
    data: {
      status: "REQUESTED",
      assignedResourceId: null,
      slaHours,
    },
  });

  await db.auditLog.create({
    data: {
      actorUserId: session.user.userId,
      actorRole: "STAFF",
      action: "TASK_RESCHEDULED_PLUS_24H",
      entityType: "TransportTask",
      entityId: task.id,
      metaJson: JSON.stringify({
        appointmentId: appt.id,
        newScheduledAt: newScheduledAt.toISOString(),
        priorityScore,
        slaHours,
      }),
    },
  });

  return NextResponse.redirect(new URL("/staff/dashboard", req.url));
}
