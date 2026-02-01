export const dynamic = "force-dynamic";
export const revalidate = 0;

import { unstable_noStore as noStore } from "next/cache";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { rankResourcesForTask } from "@/lib/matching";

export default async function ManualAssignPage(props: {
  searchParams?: Promise<{ taskId?: string }>;
}) {
  noStore();

  const session = await getSession();
  if (!session.user || session.user.role !== "STAFF") redirect("/login");

  const sp = props.searchParams ? await props.searchParams : undefined;
  const taskId = sp?.taskId;
  if (!taskId) redirect("/staff/dashboard");

  const task = await db.transportTask.findUnique({
    where: { id: taskId },
    include: {
      appointment: { include: { patient: true } },
    },
  });

  if (!task) {
    return (
      <div className="spark-panel p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="spark-title">Manual assignment</div>
            <div className="spark-subtle mt-2">Task not found.</div>
          </div>
          <a className="spark-btn" href="/staff/dashboard">
            Back
          </a>
        </div>
      </div>
    );
  }

  const pickupZone = task.appointment.patient.pickupZone;
  const mobilityNeeds = task.appointment.patient.mobilityNeeds;
  const priority = task.appointment.priorityScore ?? 0;

  const wheelchairRequired = mobilityNeeds.toUpperCase().includes("WHEEL");

  // Detect whether this task was returned (declined) using AuditLog (no schema changes)
  const declineCount = await db.auditLog.count({
    where: {
      entityType: "TransportTask",
      entityId: task.id,
      action: "TASK_DECLINED_REQUEUED",
    },
  });

  const isReturned = declineCount > 0;
  const isManual = task.status === "MANUAL_REQUIRED";
  const inResolutionMode = isReturned || isManual;

  const ranked = await rankResourcesForTask({ pickupZone, mobilityNeeds });

  const statusBadge =
    task.status === "MANUAL_REQUIRED"
      ? "border-spark-navy/35 bg-spark-navy/10 text-spark-navy"
      : "border-spark-navy/20 bg-spark-navy/5 text-spark-navy";

  const priorityBadge =
    priority >= 90
      ? "border-red-500/40 bg-red-500/15 text-red-700"
      : priority >= 75
      ? "border-amber-500/40 bg-amber-500/15 text-amber-800"
      : "border-spark-mint/60 bg-spark-mint/25 text-spark-ink";

  return (
    <div className="space-y-4">
      {/* Header / Case file */}
      <section className="spark-panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="spark-title">Manual assignment</div>
            <div className="spark-subtle mt-2">
              Choose the best available driver resource for this patient trip.
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${statusBadge}`}>
                Status: {task.status}
              </span>

              <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${priorityBadge}`}>
                Priority: {priority}
              </span>

              <span className="spark-chip">Pickup zone: {pickupZone}</span>
              <span className="spark-chip">Mobility: {mobilityNeeds}</span>

              {wheelchairRequired && (
                <span className="rounded-full border px-3 py-1 text-xs font-extrabold border-spark-navy/35 bg-spark-navy/10 text-spark-navy">
                  Wheelchair required
                </span>
              )}

              {isReturned && (
                <span className="rounded-full border px-3 py-1 text-xs font-extrabold border-red-500/40 bg-red-500/15 text-red-700">
                  Returned (declines: {declineCount})
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <a href="/staff/dashboard" className="spark-btn">
              Back to dashboard
            </a>
          </div>
        </div>

        {inResolutionMode && (
          <div className="mt-6 spark-card shadow-glowBad relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-red-500/70" />
            <div className="font-extrabold text-red-700">Resolution mode</div>
            <div className="mt-1 text-sm text-red-700/80">
              This case needs staff resolution. Pick a compatible resource now, or reschedule from the dashboard if needed.
            </div>
          </div>
        )}
      </section>

      {/* Candidates */}
      <section className="spark-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="spark-h2">Candidate drivers</div>
            <div className="spark-subtle mt-1 text-sm">
              Ranked by zone distance, then reliability. Wheelchair constraints are enforced in matching.
            </div>
          </div>
          <span className="spark-badge">Ranked</span>
        </div>

        {ranked.length === 0 ? (
          <div className="mt-5 spark-card">
            <div className="font-extrabold text-spark-ink">No compatible resources available</div>
            <div className="spark-subtle mt-1 text-sm">
              For the demo: adjust driver wheelchair capability or add another driver resource in seed.
            </div>
            <div className="mt-4">
              <a className="spark-btn" href="/staff/dashboard">
                Return to dashboard
              </a>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {ranked.map(({ resource, distKm, reliability }) => {
              const isGoodWheelchair = !wheelchairRequired || resource.wheelchairOk;

              const topBar =
                priority >= 90
                  ? "bg-red-500/70"
                  : priority >= 75
                  ? "bg-amber-500/70"
                  : "bg-spark-navy/20";

              return (
                <div
                  key={resource.id}
                  className={`spark-card relative overflow-hidden ${isReturned ? "shadow-glowBad" : "shadow-soft"}`}
                >
                  <div className={`absolute inset-x-0 top-0 h-1 ${topBar}`} />

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-extrabold text-spark-ink">{resource.displayName}</div>
                        <span className="spark-chip">{resource.type}</span>
                        {resource.wheelchairOk ? (
                          <span className="rounded-full border px-2 py-0.5 text-xs font-extrabold border-spark-mint/60 bg-spark-mint/25 text-spark-ink">
                            Wheelchair OK
                          </span>
                        ) : (
                          <span className="rounded-full border px-2 py-0.5 text-xs font-extrabold border-red-500/40 bg-red-500/15 text-red-700">
                            Not wheelchair capable
                          </span>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="spark-card-compact">
                          <div className="text-xs spark-muted font-extrabold">Start zone</div>
                          <div className="mt-1 font-extrabold text-spark-ink">
                            {resource.startZone}
                          </div>
                        </div>

                        <div className="spark-card-compact">
                          <div className="text-xs spark-muted font-extrabold">Distance</div>
                          <div className="mt-1 font-extrabold text-spark-ink">
                            {distKm} km
                          </div>
                        </div>

                        <div className="spark-card-compact">
                          <div className="text-xs spark-muted font-extrabold">Reliability</div>
                          <div className="mt-1 font-extrabold text-spark-ink">
                            {reliability}
                          </div>
                        </div>

                        <div className="spark-card-compact">
                          <div className="text-xs spark-muted font-extrabold">Capability</div>
                          <div className="mt-1 font-extrabold text-spark-ink">
                            {resource.type === "VAN" ? "Vehicle" : "Volunteer"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 text-sm spark-subtle">
                        <span className="font-extrabold text-spark-ink">Match rationale:</span>{" "}
                        {distKm} km from pickup zone. Reliability score {reliability}.
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      <form action="/staff/assign/manual/submit" method="post">
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="resourceId" value={resource.id} />
                        <button
                          className={`spark-btn-primary w-full ${
                            !isGoodWheelchair ? "opacity-40 cursor-not-allowed" : ""
                          }`}
                          disabled={!isGoodWheelchair}
                          title={!isGoodWheelchair ? "Wheelchair required, resource not compatible" : ""}
                          type="submit"
                        >
                          Assign
                        </button>
                      </form>

                      <a className="spark-btn w-full text-center" href="/staff/dashboard">
                        Cancel
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
