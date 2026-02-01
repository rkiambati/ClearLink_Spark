import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { computePriorityBreakdown, scoreToSlaHours } from "@/lib/priority";


const schema = z.object({
  pickupZone: z.enum(["A", "B", "C"]),
  mobilityNeeds: z.enum(["NONE", "ASSIST", "WHEELCHAIR"]),
  destination: z.enum(["HOSPITAL", "NURSING_STATION"]),
  scheduledAt: z.string().min(10),
  urgencyTier: z.coerce.number().int().min(0).max(2),
  distanceBand: z.coerce.number().int().min(0).max(2),
  reasonCode: z.string().min(2).max(64),
  winterMode: z.boolean(),
  missedHistory: z.coerce.number().int().min(0).max(25),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.user || session.user.role !== "STAFF") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const formData = await req.formData();

  const parsed = schema.safeParse({
    pickupZone: formData.get("pickupZone"),
    mobilityNeeds: formData.get("mobilityNeeds"),
    destination: formData.get("destination"),
    scheduledAt: formData.get("scheduledAt"),
    urgencyTier: formData.get("urgencyTier"),
    distanceBand: formData.get("distanceBand"),
    reasonCode: formData.get("reasonCode"),
    winterMode: formData.get("winterMode") === "on",
    missedHistory: formData.get("missedHistory") ?? "0",
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/staff/appointments/new", req.url));
  }

  const data = parsed.data;
  const scheduledAt = new Date(data.scheduledAt);
  const hoursUntilAppt = Math.max(
    0,
    (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60)
  );

  const breakdown = computePriorityBreakdown({
  urgencyTier: data.urgencyTier,
  hoursUntilAppt,
  distanceBand: data.distanceBand,
  winterMode: data.winterMode,
  mobilityNeeds: data.mobilityNeeds,
  missedHistory: data.missedHistory,
  });

  const priorityScore = breakdown.total;
  const slaHours = scoreToSlaHours(priorityScore);


  const patient = await db.patient.create({
    data: {
      pickupZone: data.pickupZone,
      mobilityNeeds: data.mobilityNeeds,
    },
  });

  const appointment = await db.appointment.create({
  data: {
    patientId: patient.id,
    destination: data.destination,
    scheduledAt,
    urgencyTier: data.urgencyTier,
    reasonCode: data.reasonCode,
    winterMode: data.winterMode,
    distanceBand: data.distanceBand,
    missedHistory: data.missedHistory,
    transportNeeded: true,
    priorityScore,
    priorityBreakdownJson: JSON.stringify(breakdown),
    status: "SCHEDULED",
  },
});


  const task = await db.transportTask.create({
    data: {
      appointmentId: appointment.id,
      status: "REQUESTED",
      slaHours,
    },
  });

  await db.auditLog.create({
  data: {
    actorUserId: session.user.userId,
    actorRole: "STAFF",
    action: "APPOINTMENT_CREATED",
    entityType: "Appointment",
    entityId: appointment.id,
    metaJson: JSON.stringify({
      taskId: task.id,
      priorityScore,
      slaHours,
      reasonCode: data.reasonCode,
      breakdown,
    }),
  },
});

  return NextResponse.redirect(new URL("/staff/dashboard", req.url));
}
