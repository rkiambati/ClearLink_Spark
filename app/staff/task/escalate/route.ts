import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const schema = z.object({ taskId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.user || session.user.role !== "STAFF") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const formData = await req.formData();
  const parsed = schema.safeParse({ taskId: formData.get("taskId")?.toString() });
  if (!parsed.success) return NextResponse.redirect(new URL("/staff/dashboard", req.url));

  const task = await db.transportTask.findUnique({ where: { id: parsed.data.taskId } });
  if (!task) return NextResponse.redirect(new URL("/staff/dashboard", req.url));

  await db.transportTask.update({
    where: { id: task.id },
    data: { status: "MANUAL_REQUIRED" },
  });

  await db.auditLog.create({
    data: {
      actorUserId: session.user.userId,
      actorRole: "STAFF",
      action: "TASK_ESCALATED_TO_MANUAL",
      entityType: "TransportTask",
      entityId: task.id,
      metaJson: JSON.stringify({ previousStatus: task.status }),
    },
  });

  return NextResponse.redirect(new URL("/staff/dashboard", req.url));
}
