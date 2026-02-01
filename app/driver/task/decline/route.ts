import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const schema = z.object({ taskId: z.string().min(1) });

function hoursBetween(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60);
}

function computeSlaRisk(windowStart: Date, slaHours: number) {
  const now = new Date();
  const ageHours = hoursBetween(windowStart, now);
  const remaining = slaHours - ageHours;

  const isOverdue = remaining <= 0;
  const isAtRisk = !isOverdue && remaining <= 0.25 * slaHours;

  return { isOverdue, isAtRisk, remaining };
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.user || session.user.role !== "DRIVER") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const formData = await req.formData();
  const parsed = schema.safeParse({ taskId: formData.get("taskId")?.toString() });
  if (!parsed.success) return NextResponse.redirect(new URL("/driver/dashboard", req.url));

  const fullName = session.user.name;
  const alias = fullName.includes(" - ") ? fullName.split(" - ").pop()!.trim() : fullName;

  const resources = await db.resource.findMany({ where: { isActive: true } });
  const norm = (s: string) => s.trim().toLowerCase();
  const nFull = norm(fullName);
  const nAlias = norm(alias);

  const resource =
    resources.find((r) => norm(r.displayName) === nFull) ??
    resources.find((r) => norm(r.displayName) === nAlias) ??
    resources.find((r) => norm(r.displayName).includes(nAlias)) ??
    resources.find((r) => norm(r.displayName).includes(nFull)) ??
    null;

  if (!resource) return NextResponse.redirect(new URL("/driver/dashboard", req.url));

  const task = await db.transportTask.findUnique({
    where: { id: parsed.data.taskId },
    include: { appointment: true },
  });
  if (!task) return NextResponse.redirect(new URL("/driver/dashboard", req.url));

  if (task.assignedResourceId !== resource.id || task.status !== "ASSIGNED") {
    return NextResponse.redirect(new URL("/driver/dashboard", req.url));
  }

  // Count previous declines using AuditLog (no schema changes)
  const priorDeclines = await db.auditLog.count({
    where: {
      entityType: "TransportTask",
      entityId: task.id,
      action: "TASK_DECLINED_REQUEUED",
    },
  });

  const nextDeclineCount = priorDeclines + 1;

  // SLA risk based on createdAt (stable, seedable)
  const slaHours = (task as any).slaHours ?? 48;
  const risk = computeSlaRisk(new Date(task.createdAt), slaHours);

  const priorityScore = task.appointment.priorityScore ?? 0;

  // Closed-loop policy
  const shouldEscalate =
    risk.isOverdue ||
    priorityScore >= 90 ||
    (priorityScore >= 75 && nextDeclineCount >= 1) ||
    (risk.isAtRisk && nextDeclineCount >= 2);

  // Always requeue, but escalate only when needed
  const newStatus = shouldEscalate ? "MANUAL_REQUIRED" : "REQUESTED";

  await db.transportTask.update({
    where: { id: task.id },
    data: {
      status: newStatus,
      assignedResourceId: null,
    },
  });

  await db.resource.update({
    where: { id: resource.id },
    data: { totalDeclined: { increment: 1 } },
  });

  await db.auditLog.create({
    data: {
      actorUserId: session.user.userId,
      actorRole: "DRIVER",
      action: "TASK_DECLINED_REQUEUED",
      entityType: "TransportTask",
      entityId: task.id,
      metaJson: JSON.stringify({
        resourceId: resource.id,
        declineCount: nextDeclineCount,
        priorityScore,
        slaHours,
        slaIsOverdue: risk.isOverdue,
        slaIsAtRisk: risk.isAtRisk,
        escalated: shouldEscalate,
        newStatus,
      }),
    },
  });

  if (shouldEscalate) {
    await db.auditLog.create({
      data: {
        actorUserId: session.user.userId,
        actorRole: "DRIVER",
        action: "AUTO_ESCALATED_AFTER_DECLINE",
        entityType: "TransportTask",
        entityId: task.id,
        metaJson: JSON.stringify({
          declineCount: nextDeclineCount,
          priorityScore,
          slaHours,
          slaIsOverdue: risk.isOverdue,
          slaIsAtRisk: risk.isAtRisk,
        }),
      },
    });
  }

  return NextResponse.redirect(new URL("/driver/dashboard", req.url));
}
