const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const staffPin = process.env.DEMO_STAFF_PIN || "1111";
const driver1Pin = process.env.DEMO_DRIVER_1_PIN || "2222";
const driver2Pin = process.env.DEMO_DRIVER_2_PIN || "3333";

const db = new PrismaClient();

function makePinHash(pin) {
  const pepper = process.env.APP_PEPPER || "dev-pepper";
  return bcrypt.hashSync(`${pin}${pepper}`, 10);
}

async function main() {
  // Clear tables in dependency order
  await db.auditLog.deleteMany();
  await db.transportTask.deleteMany();
  await db.appointment.deleteMany();
  await db.patient.deleteMany();
  await db.resource.deleteMany();
  await db.user.deleteMany();
  await db.zoneDistance.deleteMany();

  // Zones + distances (symmetric entries)
  const zones = ["A", "B", "C", "HOSPITAL", "NURSING"];
  const distances = [
    ["A", "B", 12],
    ["A", "C", 25],
    ["B", "C", 18],
    ["A", "HOSPITAL", 110],
    ["B", "HOSPITAL", 98],
    ["C", "HOSPITAL", 120],
    ["A", "NURSING", 6],
    ["B", "NURSING", 4],
    ["C", "NURSING", 8],
    ["NURSING", "HOSPITAL", 110],
  ];

  for (const [fromZone, toZone, km] of distances) {
    await db.zoneDistance.create({ data: { fromZone, toZone, km } });
    await db.zoneDistance.create({ data: { fromZone: toZone, toZone: fromZone, km } });
  }

  // Users
  const staff = await db.user.create({
    data: {
      role: "STAFF",
      name: "Nursing Station Staff",
      pinHash: makePinHash(staffPin),
    },
  });

  const driver1 = await db.user.create({
    data: {
      role: "DRIVER",
      name: "Volunteer Driver - Maya",
      pinHash: makePinHash(driver1Pin),
    },
  });

  const driver2 = await db.user.create({
    data: {
      role: "DRIVER",
      name: "Van Driver - Alex",
      pinHash: makePinHash(driver2Pin),
    },
  });

  // Resources linked to driver users
  const res1 = await db.resource.create({
    data: {
      type: "VOLUNTEER",
      displayName: "Maya (Volunteer)",
      startZone: "B",
      wheelchairOk: false,
      reliabilityScore: 85,
      driverUserId: driver1.id,
    },
  });

  const res2 = await db.resource.create({
    data: {
      type: "VAN",
      displayName: "Community Van (Alex)",
      startZone: "A",
      wheelchairOk: true,
      reliabilityScore: 92,
      driverUserId: driver2.id,
    },
  });

  // Patients
  const p1 = await db.patient.create({ data: { pickupZone: "C", mobilityNeeds: "NONE" } });
  const p2 = await db.patient.create({ data: { pickupZone: "A", mobilityNeeds: "WHEELCHAIR" } });
  const p3 = await db.patient.create({ data: { pickupZone: "B", mobilityNeeds: "ASSIST" } });

  const now = new Date();
  const inHours = (h) => new Date(now.getTime() + h * 60 * 60 * 1000);

  // Appointments (transport needed)
  const a1 = await db.appointment.create({
    data: {
      patientId: p1.id,
      destination: "HOSPITAL",
      scheduledAt: inHours(20),
      urgencyTier: 2, // high-risk
      reasonCode: "CARDIOLOGY_FU",
      winterMode: true,
      distanceBand: 2,
      missedHistory: 0,
      transportNeeded: true,
      priorityScore: 80,
    },
  });

  const a2 = await db.appointment.create({
    data: {
      patientId: p2.id,
      destination: "HOSPITAL",
      scheduledAt: inHours(30),
      urgencyTier: 1,
      reasonCode: "POST_DISCHARGE",
      winterMode: false,
      distanceBand: 2,
      missedHistory: 1,
      transportNeeded: true,
      priorityScore: 60,
    },
  });

  const a3 = await db.appointment.create({
    data: {
      patientId: p3.id,
      destination: "NURSING_STATION",
      scheduledAt: inHours(72),
      urgencyTier: 0,
      reasonCode: "ROUTINE_CHECK",
      winterMode: false,
      distanceBand: 0,
      missedHistory: 0,
      transportNeeded: true,
      priorityScore: 25,
    },
  });

  // Transport tasks
  await db.transportTask.create({
    data: { appointmentId: a1.id, status: "REQUESTED", slaHours: 12 },
  });
  await db.transportTask.create({
    data: { appointmentId: a2.id, status: "REQUESTED", slaHours: 24 },
  });
  await db.transportTask.create({
    data: { appointmentId: a3.id, status: "REQUESTED", slaHours: 48 },
  });

  await db.auditLog.create({
    data: {
      actorUserId: staff.id,
      actorRole: "STAFF",
      action: "SEED_DEMO",
      entityType: "SYSTEM",
      entityId: "seed",
      metaJson: JSON.stringify({ zones, users: 3, resources: 2, patients: 3, appts: 3 }),
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
