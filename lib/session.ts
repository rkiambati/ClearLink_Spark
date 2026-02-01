import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";

export type SessionUser = {
  userId: string;
  role: "STAFF" | "DRIVER";
  name: string;
};

export type AppSession = IronSession<{
  user?: SessionUser;
}>;

export async function getSession(): Promise<AppSession> {
  const cookieStore = await cookies(); // Next 15: cookies() is async

  return getIronSession(cookieStore as any, {
    cookieName: "clearlink_session",
    password: process.env.SESSION_PASSWORD as string,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
    },
  });
}
