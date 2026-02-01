import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

const schema = z.object({
  // role is optional now so the login form can be simpler
  role: z.enum(["STAFF", "DRIVER"]).optional(),
  name: z.string().min(1).max(80),
  pin: z.string().min(3).max(12),
});

export async function POST(req: Request) {
  const formData = await req.formData();

  const parsed = schema.safeParse({
    role: formData.get("role")?.toString() || undefined,
    name: formData.get("name")?.toString() || "",
    pin: formData.get("pin")?.toString() || "",
  });

  if (!parsed.success) {
    return NextResponse.redirect(new URL("/login?e=bad_form", req.url));
  }

  // Make sure session secret exists before we try to use it
  if (!process.env.SESSION_PASSWORD || process.env.SESSION_PASSWORD.length < 32) {
    return NextResponse.redirect(new URL("/login?e=no_session_secret", req.url));
  }

  const { role, pin, name } = parsed.data;

  const pepper = process.env.APP_PEPPER || "";

  // Helper: verify a candidate user with the provided pin
  const verify = (u: { pinHash: string }) =>
    bcrypt.compareSync(`${pin}${pepper}`, u.pinHash);

  let user:
    | { id: string; role: "STAFF" | "DRIVER"; name: string; pinHash: string }
    | null = null;

  if (role) {
    // Old path: role explicitly provided
    user = await db.user.findFirst({
      where: {
        role,
        isActive: true,
        name: { contains: name, mode: "insensitive" },
      },
      select: { id: true, role: true, name: true, pinHash: true },
    });

    if (!user) {
      return NextResponse.redirect(new URL("/login?e=no_user", req.url));
    }

    if (!verify(user)) {
      return NextResponse.redirect(new URL("/login?e=bad_pin", req.url));
    }
  } else {
    // New path: infer role by matching user by name first, then check pin.
    // We keep it deterministic: try exact-ish matches first using contains, then verify pin.
    const candidates = await db.user.findMany({
      where: {
        isActive: true,
        name: { contains: name, mode: "insensitive" },
      },
      take: 10,
      select: { id: true, role: true, name: true, pinHash: true },
    });

    if (candidates.length === 0) {
      return NextResponse.redirect(new URL("/login?e=no_user", req.url));
    }

    const match = candidates.find(verify) ?? null;
    if (!match) {
      return NextResponse.redirect(new URL("/login?e=bad_pin", req.url));
    }

    user = match;
  }

  // Save session
  const session = await getSession();
  session.user = { userId: user.id, role: user.role, name: user.name };
  await session.save();

  const dest = user.role === "STAFF" ? "/staff/dashboard" : "/driver/dashboard";
  return NextResponse.redirect(new URL(dest, req.url));
}
