import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const schema = z.object({ taskId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.user || session.user.role !== "DRIVER") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const formData = await req.formData();
  const parsed = schema.safeParse({ taskId: formData.get("taskId")?.toString() });
  if (!parsed.success) return NextResponse.redirect(new URL("/driver/dashboard", req.url));

  // Find this driver's Resource (same mapping logic as dashboard should produce)
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

  const task = await db.transportTask.findUnique({ where: { id: parsed.data.taskId } });
  if (!task) return NextResponse.redirect(new URL("/driver/dashboard", req.url));

  // Must be assigned to THIS driver and in ASSIGNED state
  if (task.assignedResourceId !== resource.id || task.status !== "ASSIGNED") {
    return NextResponse.redirect(new URL("/driver/dashboard", req.url));
  }

  await db.transportTask.update({
    where: { id: task.id },
    data: { status: "ACCEPTED" },
  });

  await db.auditLog.create({
    data: {
      actorUserId: session.user.userId,
      actorRole: "DRIVER",
      action: "TASK_ACCEPTED",
      entityType: "TransportTask",
      entityId: task.id,
      metaJson: JSON.stringify({ resourceId: resource.id }),
    },
  });

  return NextResponse.redirect(new URL("/driver/dashboard", req.url));
}
