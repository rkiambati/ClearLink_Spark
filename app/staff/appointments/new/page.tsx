import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function NewAppointmentPage() {
  const session = await getSession();
  if (!session.user || session.user.role !== "STAFF") redirect("/login");

  const nowIso = new Date(Date.now() + 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16); // +1h, yyyy-mm-ddThh:mm

  return (
    <div className="p-6 space-y-4">
      {/* Header card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Create Appointment</h1>
        <p className="mt-1 text-slate-600">
          This creates Patient, Appointment, and a Transport Task with SLA.
        </p>
      </div>

      {/* Form card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <form action="/staff/appointments/create" method="post" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm text-slate-700">Pickup Zone</label>
              <select
                name="pickupZone"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-900"
              >
                <option value="A">Zone A</option>
                <option value="B">Zone B</option>
                <option value="C">Zone C</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-700">Mobility Needs</label>
              <select
                name="mobilityNeeds"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-900"
              >
                <option value="NONE">None</option>
                <option value="ASSIST">Assist</option>
                <option value="WHEELCHAIR">Wheelchair</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-700">Destination</label>
              <select
                name="destination"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-900"
              >
                <option value="HOSPITAL">Hospital</option>
                <option value="NURSING_STATION">Nursing Station</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-700">Scheduled At</label>
              <input
                type="datetime-local"
                name="scheduledAt"
                defaultValue={nowIso}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-slate-700">Urgency Tier</label>
              <select
                name="urgencyTier"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-900"
              >
                <option value="0">0 (Routine)</option>
                <option value="1">1 (Time-sensitive)</option>
                <option value="2">2 (High-risk)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-700">Distance Band</label>
              <select
                name="distanceBand"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-900"
              >
                <option value="0">0 (Local)</option>
                <option value="1">1 (Medium)</option>
                <option value="2">2 (Far)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-700">
                Reason Code (appointment type)
              </label>
              <input
                name="reasonCode"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-900"
                placeholder="e.g., CARDIOLOGY_FU"
                required
              />
            </div>

            <div className="flex items-end gap-2">
              <input
                id="winterMode"
                type="checkbox"
                name="winterMode"
                className="h-4 w-4 accent-slate-900"
                defaultChecked
              />
              <label htmlFor="winterMode" className="text-sm text-slate-700">
                Winter mode
              </label>
            </div>

            <div>
              <label className="block text-sm text-slate-700">
                Missed History (per reason code)
              </label>
              <input
                name="missedHistory"
                type="number"
                min="0"
                max="10"
                defaultValue="0"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-slate-900"
              />
            </div>
          </div>

          <button className="w-full rounded-lg bg-slate-900 p-2 font-semibold text-white hover:opacity-90">
            Create and Queue Transport
          </button>
        </form>
      </div>
    </div>
  );
}
