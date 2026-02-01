-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STAFF', 'DRIVER');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('VOLUNTEER', 'VAN');

-- CreateEnum
CREATE TYPE "AppointmentDestination" AS ENUM ('NURSING_STATION', 'HOSPITAL');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'RESCHEDULED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TransportStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'ACCEPTED', 'DECLINED', 'PICKED_UP', 'DROPPED_OFF', 'AT_RISK', 'ESCALATED', 'MANUAL_REQUIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "startZone" TEXT NOT NULL,
    "wheelchairOk" BOOLEAN NOT NULL DEFAULT false,
    "reliabilityScore" INTEGER NOT NULL DEFAULT 80,
    "totalAssigned" INTEGER NOT NULL DEFAULT 0,
    "totalDeclined" INTEGER NOT NULL DEFAULT 0,
    "totalNoShows" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "driverUserId" TEXT,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "externalRef" TEXT,
    "pickupZone" TEXT NOT NULL,
    "mobilityNeeds" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "destination" "AppointmentDestination" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "urgencyTier" INTEGER NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "winterMode" BOOLEAN NOT NULL DEFAULT false,
    "distanceBand" INTEGER NOT NULL,
    "missedHistory" INTEGER NOT NULL DEFAULT 0,
    "transportNeeded" BOOLEAN NOT NULL DEFAULT false,
    "priorityScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportTask" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "status" "TransportStatus" NOT NULL DEFAULT 'REQUESTED',
    "assignedResourceId" TEXT,
    "latestArrivalAt" TIMESTAMP(3),
    "pickupAt" TIMESTAMP(3),
    "slaHours" INTEGER NOT NULL DEFAULT 24,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneDistance" (
    "id" TEXT NOT NULL,
    "fromZone" TEXT NOT NULL,
    "toZone" TEXT NOT NULL,
    "km" INTEGER NOT NULL,

    CONSTRAINT "ZoneDistance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metaJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Resource_driverUserId_key" ON "Resource"("driverUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_externalRef_key" ON "Patient"("externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "TransportTask_appointmentId_key" ON "TransportTask"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ZoneDistance_fromZone_toZone_key" ON "ZoneDistance"("fromZone", "toZone");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_driverUserId_fkey" FOREIGN KEY ("driverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTask" ADD CONSTRAINT "TransportTask_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTask" ADD CONSTRAINT "TransportTask_assignedResourceId_fkey" FOREIGN KEY ("assignedResourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
