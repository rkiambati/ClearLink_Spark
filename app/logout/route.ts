import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const jar = await cookies();
  for (const c of jar.getAll()) jar.delete(c.name);
  return NextResponse.redirect(new URL("/login", "http://localhost:3000"));
}
