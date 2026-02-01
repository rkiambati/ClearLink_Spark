import { db } from "@/lib/db";

export async function getDriverResource(userId: string) {
  return db.resource.findFirst({
    where: {
      driverUserId: userId,
      isActive: true,
    },
  });
}
