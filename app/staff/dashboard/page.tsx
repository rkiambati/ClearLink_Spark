export const dynamic = "force-dynamic";
export const revalidate = 0;

import { unstable_noStore as noStore } from "next/cache";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

function hoursUntil(d: Date) {
  const ms = d.getTime() - Date.now();
  return ms / (1000 * 60 * 60);
}

function formatCountdown(hours: number) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  if (hours < 0) return `Overdue by ${Math.abs(h)}h ${Math.abs(m)}m`;
  return `${h}h ${m}m`;
}

// Pure UI flagging, deterministic and demo-friendly
function staffFlagForTask(t: {
  status: string;
  appointment: { priorityScore: number; scheduledAt: Date };
  wasDeclined: boolean;
}) {
  const score = t.appointment.priorityScore ?? 0;
  const hToAppt = hoursUntil(new Date(t.appointment.scheduledAt));

  // Returned cases should scream red
  if (t.wasDeclined) {
    return {
      glow: "shadow-glowBad",
      bar: "bg-red-500/70",
      badge: "border-red-500/40 bg-red-500/15 text-red-700",
      label: "Returned",
      reason: "Driver declined. Closed-loop resolution required.",
    };
  }

  if (t.status === "MANUAL_REQUIRED") {
    return {
      glow: "shadow-glowBad",
      bar: "bg-red-500/70",
      badge: "border-red-500/40 bg-red-500/15 text-red-700",
      label: "Manual",
      reason: "System could not safely auto-assign. Staff must select a resource.",
    };
  }

  // Time pressure flag
  if (hToAppt <= 2 && hToAppt >= 0) {
    return {
      glow: "shadow-glowWarn",
      bar: "bg-amber-500/70",
      badge: "border-amber-500/40 bg-amber-500/15 text-amber-800",
      label: "At risk",
      reason: "Appointment is near. Assign now to prevent missed care.",
    };
  }

  if (score >= 90) {
    return {
      glow: "shadow-glowBad",
      bar: "bg-red-500/70",
      badge: "border-red-500/40 bg-red-500/15 text-red-700",
      label: "High priority",
      reason: "High priority case. Keep transport plan tight.",
    };
  }

  if (score >= 75) {
    return {
      glow: "shadow-glowWarn",
      bar: "bg-amber-500/70",
      badge: "border-amber-500/40 bg-amber-500/15 text-amber-800",
      label: "Elevated",
      reason: "Elevated priority case.",
    };
  }

  return {
    glow: "shadow-soft",
    bar: "bg-spark-navy/20",
    badge: "border-spark-navy/25 bg-spark-navy/5 text-spark-navy",
    label: "Standard",
    reason: "Standard case.",
  };
}

export default async function StaffDashboard() {
  noStore();

  const session = await getSession();
  if (!session.user || session.user.role !== "STAFF") redirect("/login");

  const queue = await db.transportTask.findMany({
    where: { status: { in: ["REQUESTED", "MANUAL_REQUIRED"] } },
    orderBy: { appointment: { priorityScore: "desc" } },
    include: { appointment: { include: { patient: true } } },
  });

  // Detect declines via audit log, color returned cases deep red
  const declinedIds = new Set(
    (
      await db.auditLog.findMany({
        where: { action: "TASK_DECLINED_REQUEUED" },
        orderBy: { createdAt: "desc" },
        take: 200,
      })
    ).map((l) => l.entityId)
  );

  const now = Date.now();
  const atRisk = queue.filter((t) => {
    const h =
      (new Date(t.appointment.scheduledAt).getTime() - now) / (1000 * 60 * 60);
    return h <= 2 && h >= 0;
  }).length;

  const overdue = queue.filter(
    (t) => new Date(t.appointment.scheduledAt).getTime() < now
  ).length;

  const returned = queue.filter((t) => declinedIds.has(t.id)).length;
  const manual = queue.filter((t) => t.status === "MANUAL_REQUIRED").length;

  // Resolution lock: returned exists => restrict actions
  const mustResolveReturned = returned > 0;

  // Only allow working on returned cases, manual-required cases, or very high priority cases
  // when resolution lock is active.
  const HIGH_PRIORITY_THRESHOLD = 90;

  return (
    <div className="space-y-4">
      <section className="spark-panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="spark-title">Staff dashboard</div>
            <div className="spark-subtle mt-2">
              Signed in as{" "}
              <span className="font-extrabold text-spark-ink">
                {session.user.name}
              </span>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <a className="spark-btn" href="/staff/audit">
              Audit
            </a>
            <a className="spark-btn" href="/staff/appointments/new">
              New appointment
            </a>

            <form action="/staff/assign/auto" method="post">
              <button
                className={`spark-btn-primary ${
                  mustResolveReturned ? "opacity-40 cursor-not-allowed" : ""
                }`}
                disabled={mustResolveReturned}
                title={mustResolveReturned ? "Resolve returned cases first" : ""}
              >
                Auto-assign top task
              </button>
            </form>
          </div>
        </div>

        <div className="spark-divider my-6" />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="spark-kpi">
            <div className="text-xs spark-muted font-extrabold">Queue</div>
            <div className="mt-1 text-2xl font-black text-spark-ink">
              {queue.length}
            </div>
            <div className="mt-1 text-sm spark-subtle">Open transport tasks</div>
          </div>

          <div className="spark-kpi shadow-glowWarn">
            <div className="text-xs spark-muted font-extrabold">At risk</div>
            <div className="mt-1 text-2xl font-black text-spark-ink">
              {atRisk}
            </div>
            <div className="mt-1 text-sm spark-subtle">Within 2 hours</div>
          </div>

          <div className="spark-kpi shadow-glowBad">
            <div className="text-xs spark-muted font-extrabold">
              Overdue / Manual
            </div>
            <div className="mt-1 text-2xl font-black text-spark-ink">
              {overdue} / {manual}
            </div>
            <div className="mt-1 text-sm spark-subtle">Immediate attention</div>
          </div>

          <div className="spark-kpi shadow-glowBad">
            <div className="text-xs spark-muted font-extrabold">Returned</div>
            <div className="mt-1 text-2xl font-black text-spark-ink">
              {returned}
            </div>
            <div className="mt-1 text-sm spark-subtle">Declined and re-queued</div>
          </div>
        </div>

        {mustResolveReturned && (
          <div className="mt-6 spark-card shadow-glowBad relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-red-500/70" />
            <div className="font-extrabold text-red-700">Resolution lock</div>
            <div className="mt-1 text-sm text-red-700/80">
              Returned cases must be resolved first. Non-priority assignments are
              temporarily disabled until returned cases are handled.
            </div>
          </div>
        )}
      </section>

      <section className="spark-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="spark-h2">Transport queue</div>
            <div className="spark-subtle mt-1 text-sm">
              Cards are flagged by priority and time-to-appointment. Returned cases
              are always deep red.
            </div>
          </div>
          <span className="spark-chip">Live queue</span>
        </div>

        {queue.length === 0 ? (
          <div className="mt-5 spark-card">
            <div className="font-extrabold text-spark-ink">No requested tasks</div>
            <div className="spark-subtle mt-1 text-sm">
              You’re fully caught up.
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {queue.map((t) => {
              const hToAppt = hoursUntil(new Date(t.appointment.scheduledAt));
              const countdown = formatCountdown(hToAppt);
              const wasDeclined = declinedIds.has(t.id);
              const score = t.appointment.priorityScore ?? 0;

              const v = staffFlagForTask({
                status: t.status,
                appointment: {
                  priorityScore: score,
                  scheduledAt: t.appointment.scheduledAt,
                },
                wasDeclined,
              });

              // Resolution lock behavior:
              // If there are returned cases, only allow assignment for:
              // - returned cases, OR
              // - manual-required cases, OR
              // - priority >= threshold
              const allowAssign =
                !mustResolveReturned ||
                wasDeclined ||
                t.status === "MANUAL_REQUIRED" ||
                score >= HIGH_PRIORITY_THRESHOLD;

              const patientLabel =
                t.appointment.patient.externalRef ??
                `Patient ${t.appointment.patient.id.slice(-6)}`;

              return (
                <div
                  key={t.id}
                  className={`spark-card ${v.glow} relative overflow-hidden ${
                    allowAssign ? "" : "opacity-50"
                  }`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${v.bar}`} />

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-extrabold text-spark-ink">
                          {patientLabel}
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-extrabold ${v.badge}`}
                        >
                          {v.label}
                        </span>
                        <span className="spark-chip">{t.status}</span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="spark-card-compact">
                          <div className="text-xs spark-muted font-extrabold">
                            Pickup zone
                          </div>
                          <div className="mt-1 font-extrabold text-spark-ink">
                            {t.appointment.patient.pickupZone}
                          </div>
                        </div>
                        <div className="spark-card-compact">
                          <div className="text-xs spark-muted font-extrabold">
                            Destination
                          </div>
                          <div className="mt-1 font-extrabold text-spark-ink">
                            {t.appointment.destination}
                          </div>
                        </div>
                        <div className="spark-card-compact">
                          <div className="text-xs spark-muted font-extrabold">
                            Appointment
                          </div>
                          <div className="mt-1 font-extrabold text-spark-ink">
                            {new Date(t.appointment.scheduledAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="spark-card-compact">
                          <div className="text-xs spark-muted font-extrabold">
                            Time to
                          </div>
                          <div className="mt-1 font-extrabold text-spark-ink">
                            {countdown}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 text-sm spark-subtle">
                        <span className="font-extrabold text-spark-ink">
                          Why flagged:
                        </span>{" "}
                        {v.reason}
                      </div>

                      {!allowAssign && mustResolveReturned && (
                        <div className="mt-3 text-xs font-extrabold text-red-700">
                          Locked: resolve returned cases first.
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      <a
                        className={`spark-btn-primary text-center ${
                          allowAssign ? "" : "opacity-40 pointer-events-none"
                        }`}
                        href={`/staff/assign/manual?taskId=${t.id}`}
                        aria-disabled={!allowAssign}
                        title={
                          allowAssign
                            ? "Assign manually"
                            : "Resolve returned cases first"
                        }
                      >
                        Assign manually
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
