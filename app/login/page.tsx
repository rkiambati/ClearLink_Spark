export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getSession } from "@/lib/session";

export default async function LoginPage(props: {
  searchParams?: Promise<{ e?: string }>;
}) {
  const session = await getSession();
  const user = session.user ?? null;

  const sp = props.searchParams ? await props.searchParams : undefined;

  const error =
    sp?.e === "bad_pin"
      ? "Invalid name or PIN. Try again."
      : sp?.e === "inactive"
      ? "This account is inactive."
      : null;

  const dashboardHref =
    user?.role === "DRIVER"
      ? "/driver/dashboard"
      : user?.role === "STAFF"
      ? "/staff/dashboard"
      : "/login";

  return (
    <div className="spark-grid" style={{ gridTemplateColumns: "1.1fr 0.9fr" }}>
      <section className="spark-panel p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="spark-title">Sign in to ClearLink</div>
            <div className="spark-subtle mt-2">
              Staff coordinate transport. Drivers accept assignments. Returned cases
              enter closed-loop resolution.
            </div>
          </div>
          <span className="spark-badge">Demo build</span>
        </div>

        {user && (
          <div className="mt-6 spark-card shadow-glowSky relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-spark-navy/55" />
            <div className="font-extrabold text-spark-ink">You are already signed in</div>
            <div className="spark-subtle mt-1 text-sm">
              {user.name} · {user.role}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a className="spark-btn-primary" href={dashboardHref}>
                Go to dashboard
              </a>
              <a className="spark-btn" href="/logout">
                Logout and switch user
              </a>
            </div>
          </div>
        )}

        <div className="spark-divider my-6" />

        {error && (
          <div className="spark-card shadow-glowBad relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-red-500/70" />
            <div className="font-extrabold text-red-700">Sign-in failed</div>
            <div className="mt-1 text-sm text-red-700/80">{error}</div>
          </div>
        )}

        <form action="/login/submit" method="post" className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-extrabold text-spark-ink">Display name</label>
            <div className="spark-subtle text-xs mt-1">
              Must match a seeded demo user name.
            </div>
            <input
              name="name"
              className="spark-input mt-2"
              placeholder="Nursing Station Staff"
              autoComplete="off"
              required
            />
          </div>

          <div>
            <label className="text-sm font-extrabold text-spark-ink">PIN</label>
            <div className="spark-subtle text-xs mt-1">
              Demo PIN login. Production would use MFA/SSO.
            </div>
            <input
              name="pin"
              className="spark-input mt-2"
              placeholder="1234"
              inputMode="numeric"
              required
            />
          </div>

          <button className="spark-btn-primary w-full" type="submit">
            Enter ClearLink
          </button>
        </form>
      </section>

      <aside className="spark-panel p-8">
        <div className="spark-h2">Demo accounts</div>
        <div className="spark-subtle mt-2">
          Use the seeded names you created.
        </div>

        <div className="mt-5 space-y-3">
          <div className="spark-card-compact shadow-glowSky">
            <div className="font-extrabold text-spark-ink">Staff</div>
            <div className="mt-1 text-sm spark-subtle">Nursing Station Staff</div>
          </div>

          <div className="spark-card-compact shadow-glowLeaf">
            <div className="font-extrabold text-spark-ink">Driver</div>
            <div className="mt-1 text-sm spark-subtle">Volunteer Driver - Maya</div>
          </div>

          <div className="spark-card-compact shadow-glowLeaf">
            <div className="font-extrabold text-spark-ink">Driver</div>
            <div className="mt-1 text-sm spark-subtle">Van Driver - Alex</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
