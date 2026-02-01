export const dynamic = "force-dynamic";
export const revalidate = 0;

import { unstable_noStore as noStore } from "next/cache";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

function normalizeName(s: string) {
  return s.trim().toLowerCase();
}

function extractAlias(name: string) {
  const parts = name.split(" - ");
  return parts.length >= 2 ? parts[parts.length - 1].trim() : name.trim();
}

function flagForDriver(t: {
  status: string;
  appointment: { priorityScore: number; patient: { mobilityNeeds: string } };
}) {
  const wheelchair = t.appointment.patient.mobilityNeeds.toUpperCase().includes("WHEEL");
  const score = t.appointment.priorityScore;

  if (t.status === "ACCEPTED") {
    return {
      glow: "shadow-glowLeaf",
      bar: "bg-spark-mint/70",
      badge: "border-spark-mint/60 bg-spark-mint/25 text-spark-ink",
      headline: "Accepted",
      reason: "Proceed to pickup and keep ETA tight.",
    };
  }

  if (score >= 90) {
    return {
      glow: "shadow-glowBad",
      bar: "bg-red-500/70",
      badge: "border-red-500/40 bg-red-500/15 text-red-700",
      headline: "High priority",
      reason: "High priority rider. Please prioritize this trip.",
    };
  }

  if (score >= 75) {
    return {
      glow: "shadow-glowWarn",
      bar: "bg-amber-500/70",
      badge: "border-amber-500/40 bg-amber-500/15 text-amber-800",
      headline: "Elevated priority",
      reason: "Elevated priority rider. Keep schedule tight.",
    };
  }

  if (wheelchair) {
    return {
      glow: "shadow-glowSky",
      bar: "bg-spark-navy/55",
      badge: "border-spark-navy/35 bg-spark-navy/10 text-spark-navy",
      headline: "Accessibility",
      reason: "Wheelchair accessibility required.",
    };
  }

  return {
    glow: "shadow-soft",
    bar: "bg-spark-navy/15",
    badge: "border-spark-navy/20 bg-spark-navy/5 text-spark-navy",
    headline: "Standard",
    reason: "Standard assignment.",
  };
}

export default async function DriverDashboard() {
  noStore();

  const session = await getSession();
  if (!session.user || session.user.role !== "DRIVER") redirect("/login");

  const fullName = session.user.name;
  const alias = extractAlias(fullName);

  // 1) Exact match on full name
  let resource = await db.resource.findFirst({
    where: { displayName: fullName, isActive: true },
  });

  // 2) Exact match on alias
  if (!resource && alias && alias !== fullName) {
    resource = await db.resource.findFirst({
      where: { displayName: alias, isActive: true },
    });
  }

  // 3) Last resort: case-insensitive partial matching
  if (!resource) {
    const all = await db.resource.findMany({ where: { isActive: true } });
    const nFull = normalizeName(fullName);
    const nAlias = normalizeName(alias);

    const score = (rName: string) => {
      const rn = normalizeName(rName);
      let s = 0;
      if (rn === nFull) s += 100;
      if (rn === nAlias) s += 90;
      if (rn.includes(nAlias)) s += 60;
      if (rn.includes(nFull)) s += 50;
      if (nAlias.includes(rn)) s += 10;
      return s;
    };

    resource =
      all
        .map((r) => ({ r, s: score(r.displayName) }))
        .sort((a, b) => b.s - a.s)[0]?.r ?? null;

    if (resource && score(resource.displayName) < 40) resource = null;
  }

  if (!resource) {
    return (
      <div className="spark-panel p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="spark-title">Driver Dashboard</div>
            <div className="spark-subtle mt-2">
              We could not map your login to a driver resource.
            </div>
          </div>
          <span className="spark-badge">Mapping</span>
        </div>

        <div className="spark-divider my-6" />

        <div className="spark-card">
          <div className="font-extrabold text-spark-ink">Current login</div>
          <div className="spark-subtle mt-2 text-sm">
            Full name: <span className="font-bold text-spark-ink">{fullName}</span>
            <br />
            Alias: <span className="font-bold text-spark-ink">{alias}</span>
          </div>

          <div className="spark-divider my-5" />

          <div className="font-extrabold text-spark-ink">Fix options</div>
          <ul className="mt-2 list-disc pl-5 text-sm spark-subtle space-y-1">
            <li>Create a Resource with displayName exactly "{fullName}".</li>
            <li>Or create a Resource with displayName exactly "{alias}".</li>
            <li>Make sure the Resource isActive is true.</li>
          </ul>

          <div className="mt-5">
            <a className="spark-btn-primary" href="/login">
              Back to login
            </a>
          </div>
        </div>
      </div>
    );
  }

  const tasks = await db.transportTask.findMany({
    where: {
      assignedResourceId: resource.id,
      status: { in: ["ASSIGNED", "ACCEPTED"] },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      appointment: { include: { patient: true } },
    },
  });

  const assignedCount = tasks.filter((t) => t.status === "ASSIGNED").length;
  const acceptedCount = tasks.filter((t) => t.status === "ACCEPTED").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="spark-panel p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="spark-title">Driver Dashboard</div>
            <div className="spark-subtle mt-2">
              Signed in as <span className="font-extrabold text-spark-ink">{fullName}</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <a className="spark-btn" href="/login">
              Switch user
            </a>
          </div>
        </div>

        <div className="spark-divider my-6" />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="spark-kpi">
            <div className="text-xs spark-muted font-extrabold">Resource</div>
            <div className="mt-1 font-extrabold text-spark-ink">{resource.displayName}</div>
            <div className="mt-1 text-sm spark-subtle">
              Start zone <span className="font-extrabold text-spark-ink">{resource.startZone}</span>
            </div>
          </div>

          <div className="spark-kpi">
            <div className="text-xs spark-muted font-extrabold">Capability</div>
            <div className="mt-1 font-extrabold text-spark-ink">
              Wheelchair {resource.wheelchairOk ? "compatible" : "not compatible"}
            </div>
            <div className="mt-1 text-sm spark-subtle">
              Reliability score{" "}
              <span className="font-extrabold text-spark-ink">{resource.reliabilityScore}</span>
            </div>
          </div>

          <div className="spark-kpi">
            <div className="text-xs spark-muted font-extrabold">Today</div>
            <div className="mt-1 text-sm spark-subtle">
              Assigned: <span className="font-extrabold text-spark-ink">{assignedCount}</span>
              <span className="mx-2 text-spark-navy/30">|</span>
              Accepted: <span className="font-extrabold text-spark-ink">{acceptedCount}</span>
            </div>
            <div className="mt-1 text-sm spark-subtle">
              Total active: <span className="font-extrabold text-spark-ink">{tasks.length}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Assignments */}
      <section className="spark-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="spark-h2">Assigned trips</div>
            <div className="spark-subtle mt-1 text-sm">
              Review the details, then accept or decline. High priority cases are flagged clearly.
            </div>
          </div>
          <span className="spark-chip">Live assignments</span>
        </div>

        {tasks.length === 0 ? (
          <div className="mt-5 spark-card">
            <div className="font-extrabold text-spark-ink">No active assignments</div>
            <div className="spark-subtle mt-1 text-sm">
              If staff assigns a trip to you, it will appear here automatically.
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {tasks.map((t) => {
              const v = flagForDriver({ status: t.status, appointment: t.appointment });

              return (
                <div key={t.id} className={`spark-card ${v.glow} relative overflow-hidden`}>
                  <div className={`absolute inset-x-0 top-0 h-1 ${v.bar}`} />

                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-extrabold text-spark-ink">Trip Assignment</div>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-extrabold ${v.badge}`}>
                          {v.headline}
                        </span>
                        <span className="spark-chip">{t.status}</span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="spark-card-compact">
                          <div className="text-xs spark-muted font-extrabold">Pickup zone</div>
                          <div className="mt-1 font-extrabold text-spark-ink">
                            {t.appointment.patient.pickupZone}
                          </div>
                        </div>
                        <div className="spark-card-compact">
                          <div className="text-xs spark-muted font-extrabold">Destination</div>
                          <div className="mt-1 font-extrabold text-spark-ink">
                            {t.appointment.destination}
                          </div>
                        </div>
                        <div className="spark-card-compact">
                          <div className="text-xs spark-muted font-extrabold">Scheduled</div>
                          <div className="mt-1 font-extrabold text-spark-ink">
                            {new Date(t.appointment.scheduledAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="spark-card-compact">
                          <div className="text-xs spark-muted font-extrabold">Priority</div>
                          <div className="mt-1 font-extrabold text-spark-ink">
                            {t.appointment.priorityScore}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 text-sm spark-subtle">
                        <span className="font-extrabold text-spark-ink">Flag rationale:</span>{" "}
                        {v.reason}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-2">
                      {t.status === "ASSIGNED" ? (
                        <>
                          <form action="/driver/task/accept" method="post">
                            <input type="hidden" name="taskId" value={t.id} />
                            <button className="spark-btn-mint w-full" type="submit">
                              Accept
                            </button>
                          </form>
                          <form action="/driver/task/decline" method="post">
                            <input type="hidden" name="taskId" value={t.id} />
                            <button className="spark-btn-bad w-full" type="submit">
                              Decline
                            </button>
                          </form>
                        </>
                      ) : (
                        <span className="spark-badge">Accepted</span>
                      )}
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
