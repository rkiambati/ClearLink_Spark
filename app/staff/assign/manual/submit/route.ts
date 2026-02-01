import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const schema = z.object({
  taskId: z.string().min(1),
  resourceId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.user || session.user.role !== "STAFF") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const formData = await req.formData();
  const parsed = schema.safeParse({
    taskId: formData.get("taskId")?.toString(),
    resourceId: formData.get("resourceId")?.toString(),
  });

  if (!parsed.success) return NextResponse.redirect(new URL("/staff/dashboard", req.url));

  const task = await db.transportTask.findUnique({
    where: { id: parsed.data.taskId },
    include: { appointment: { include: { patient: true } } },
  });
  if (!task) return NextResponse.redirect(new URL("/staff/dashboard", req.url));

  // Only allow assignment from these states
  if (!["REQUESTED", "MANUAL_REQUIRED"].includes(task.status)) {
    return NextResponse.redirect(new URL(`/staff/assign/manual?taskId=${task.id}`, req.url));
  }

  const resource = await db.resource.findUnique({ where: { id: parsed.data.resourceId } });
  if (!resource || !resource.isActive) {
    return NextResponse.redirect(new URL(`/staff/assign/manual?taskId=${task.id}`, req.url));
  }

  // Hard constraint: wheelchair
  const needsWheelchair = task.appointment.patient.mobilityNeeds.toUpperCase().includes("WHEEL");
  if (needsWheelchair && !resource.wheelchairOk) {
    return NextResponse.redirect(new URL(`/staff/assign/manual?taskId=${task.id}`, req.url));
  }

  await db.transportTask.update({
    where: { id: task.id },
    data: { status: "ASSIGNED", assignedResourceId: resource.id },
  });

  await db.resource.update({
    where: { id: resource.id },
    data: { totalAssigned: { increment: 1 } },
  });

  await db.auditLog.create({
    data: {
      actorUserId: session.user.userId,
      actorRole: "STAFF",
      action: "TASK_ASSIGNED_MANUAL",
      entityType: "TransportTask",
      entityId: task.id,
      metaJson: JSON.stringify({
        resourceId: resource.id,
        pickupZone: task.appointment.patient.pickupZone,
      }),
    },
  });

  return NextResponse.redirect(new URL("/staff/dashboard", req.url));
}
