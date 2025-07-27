/*
  Warnings:

  - The primary key for the `Simulation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `SimulationResultDaily` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `SimulationResultDaily` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `SimulationResultHourly` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `SimulationResultHourly` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `SimulationSummary` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `Simulation` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `simulationId` on the `SimulationResultDaily` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `simulationId` on the `SimulationResultHourly` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `simulationId` on the `SimulationSummary` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "SimulationResultDaily" DROP CONSTRAINT "SimulationResultDaily_simulationId_fkey";

-- DropForeignKey
ALTER TABLE "SimulationResultHourly" DROP CONSTRAINT "SimulationResultHourly_simulationId_fkey";

-- DropForeignKey
ALTER TABLE "SimulationSummary" DROP CONSTRAINT "SimulationSummary_simulationId_fkey";

-- DropIndex
DROP INDEX "SimulationResultDaily_date_idx";

-- DropIndex
DROP INDEX "SimulationResultDaily_simulationId_date_key";

-- AlterTable
ALTER TABLE "Simulation" DROP CONSTRAINT "Simulation_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL,
ALTER COLUMN "startAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "endAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "Simulation_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "SimulationResultDaily" DROP CONSTRAINT "SimulationResultDaily_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" BIGSERIAL NOT NULL,
DROP COLUMN "simulationId",
ADD COLUMN     "simulationId" UUID NOT NULL,
ALTER COLUMN "date" SET DATA TYPE DATE,
ADD CONSTRAINT "SimulationResultDaily_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "SimulationResultHourly" DROP CONSTRAINT "SimulationResultHourly_pkey",
ADD COLUMN     "busyCpCountAvg" DOUBLE PRECISION,
DROP COLUMN "id",
ADD COLUMN     "id" BIGSERIAL NOT NULL,
DROP COLUMN "simulationId",
ADD COLUMN     "simulationId" UUID NOT NULL,
ALTER COLUMN "hourStart" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "cpState" DROP NOT NULL,
ADD CONSTRAINT "SimulationResultHourly_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "SimulationSummary" DROP CONSTRAINT "SimulationSummary_pkey",
DROP COLUMN "simulationId",
ADD COLUMN     "simulationId" UUID NOT NULL,
ALTER COLUMN "actualPeakAt" SET DATA TYPE TIMESTAMPTZ(6),
ADD CONSTRAINT "SimulationSummary_pkey" PRIMARY KEY ("simulationId");

-- CreateTable
CREATE TABLE "SimulationResultMonthly" (
    "id" BIGSERIAL NOT NULL,
    "simulationId" UUID NOT NULL,
    "monthStart" DATE NOT NULL,
    "energyKwh" DOUBLE PRECISION NOT NULL,
    "eventsCount" INTEGER NOT NULL,
    "max15mPowerKw" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SimulationResultMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SimulationResultMonthly_simulationId_monthStart_idx" ON "SimulationResultMonthly"("simulationId", "monthStart");

-- CreateIndex
CREATE INDEX "Simulation_status_idx" ON "Simulation"("status");

-- CreateIndex
CREATE INDEX "Simulation_createdAt_idx" ON "Simulation"("createdAt");

-- CreateIndex
CREATE INDEX "SimulationResultDaily_simulationId_date_idx" ON "SimulationResultDaily"("simulationId", "date");

-- CreateIndex
CREATE INDEX "SimulationResultHourly_simulationId_hourStart_idx" ON "SimulationResultHourly"("simulationId", "hourStart");

-- CreateIndex
CREATE INDEX "SimulationResultHourly_hourStart_idx" ON "SimulationResultHourly"("hourStart");

-- AddForeignKey
ALTER TABLE "SimulationSummary" ADD CONSTRAINT "SimulationSummary_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationResultHourly" ADD CONSTRAINT "SimulationResultHourly_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationResultDaily" ADD CONSTRAINT "SimulationResultDaily_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationResultMonthly" ADD CONSTRAINT "SimulationResultMonthly_simulationId_fkey" FOREIGN KEY ("simulationId") REFERENCES "Simulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
