import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function AuditPage() {
  const session = await getSession();
  if (!session.user || session.user.role !== "STAFF") redirect("/login");

  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="spark-shell p-6 space-y-4">
      <div className="spark-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="spark-title">Audit Log</h1>
            <p className="spark-subtle mt-1">Last 30 actions</p>
          </div>
          <a href="/staff/dashboard" className="spark-btn">Back</a>
        </div>
      </div>

      <div className="spark-panel p-6">
        {logs.length === 0 ? (
          <p className="text-white/70">No logs yet.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((l) => (
              <div key={l.id} className="spark-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold">{l.action}</div>
                    <div className="mt-1 text-sm text-white/70">
                      {l.actorRole} · {new Date(l.createdAt).toLocaleString()}
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      {l.entityType} · {l.entityId}
                    </div>
                  </div>
                  <span className="spark-chip">{l.actorRole}</span>
                </div>

                {l.metaJson && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-white/70 hover:text-white/90">
                      Details
                    </summary>
                    <pre className="mt-2 overflow-auto rounded-lg border border-spark-stroke bg-black/20 p-3 text-xs text-white/70">
                      {JSON.stringify(JSON.parse(l.metaJson), null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
