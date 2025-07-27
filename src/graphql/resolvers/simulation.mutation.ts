import { DateTime } from "luxon";
import { PrismaClient, SimulationStatus } from "../../generated/prisma";
import runEngineAndPersist from "../../engine/sim-engine";
import { Context } from "../../context";

const prisma = new PrismaClient();
// For Simplicity! Canonical UTC year (non-leap)
const CANONICAL_START_UTC = DateTime.utc(2001, 1, 1, 0, 0, 0, 0);
const CANONICAL_END_UTC = CANONICAL_START_UTC.plus({ days: 365 });

type CreateSimulationInput = {
    name?: string | null;
    seed?: number | null;
    arrivalMultiplier?: number | null;
    chargepointCount: number;
    consumptionKwhPer100km?: number | null;
    chargerPowerKw?: number | null;
    status?: SimulationStatus | null; // default queued
};

type UpdateSimulationInput = Partial<{
    name: string | null;
    seed: number | null;
    arrivalMultiplier: number | null;
    chargepointCount: number | null;
    consumptionKwhPer100km: number | null;
    chargerPowerKw: number | null;
}>;

export const SimulationMutationResolvers = {
    Mutation: {
        createSimulation: async (
            _p: unknown,
            args: { input: CreateSimulationInput },
            ctx: Context
        ) => {
            try {
                const db = ctx?.prisma ?? prisma;
                const {
                    name,
                    seed = null,
                    arrivalMultiplier = 1.0,
                    chargepointCount,
                    consumptionKwhPer100km = 18.0,
                    chargerPowerKw = 11.0,
                    status = SimulationStatus.queued,
                } = args.input;

                if (chargepointCount <= 0) {
                    throw new Error("chargepointCount must be > 0.");
                }

                const created = await db.simulation.create({
                    data: {
                        name: name ?? null,
                        status: status ?? SimulationStatus.queued,
                        // auto-set canonical range (UTC)
                        startAt: CANONICAL_START_UTC.toJSDate(),
                        endAt: CANONICAL_END_UTC.toJSDate(),
                        seed: seed ?? null,
                        arrivalMultiplier: arrivalMultiplier ?? 1.0,
                        chargepointCount,
                        consumptionKwhPer100km: consumptionKwhPer100km ?? 18.0,
                        chargerPowerKw: chargerPowerKw ?? 11.0,
                    },
                });
                return created;
            } catch (err) {
                console.error("Error creating simulation:", err);
                throw new Error("Failed to create simulation");
            }
        },

        updateSimulation: async (
            _p: unknown,
            args: { id: string; input: UpdateSimulationInput },
            ctx: Context
        ) => {
            try {
                const db = ctx?.prisma ?? prisma;
                const sim = await db.simulation.findUnique({
                    where: { id: args.id },
                });
                if (!sim) throw new Error("Simulation not found.");
                if (sim.status !== SimulationStatus.queued) {
                    throw new Error(
                        "Simulation can only be updated while status is QUEUED."
                    );
                }

                const patch: any = {};
                if (typeof args.input.name !== "undefined")
                    patch.name = args.input.name;
                if (typeof args.input.arrivalMultiplier !== "undefined")
                    patch.arrivalMultiplier = args.input.arrivalMultiplier;
                if (typeof args.input.chargepointCount !== "undefined")
                    patch.chargepointCount = args.input.chargepointCount;
                if (typeof args.input.consumptionKwhPer100km !== "undefined")
                    patch.consumptionKwhPer100km =
                        args.input.consumptionKwhPer100km;
                if (typeof args.input.chargerPowerKw !== "undefined")
                    patch.chargerPowerKw = args.input.chargerPowerKw;
                if (typeof args.input.seed !== "undefined")
                    patch.seed = args.input.seed;

                // startAt/endAt are immutable and canonical now; no patch.
                return db.simulation.update({
                    where: { id: args.id },
                    data: patch,
                });
            } catch (err) {
                console.error("Error updating simulation:", err);
                throw new Error("Failed to update simulation");
            }
        },

        deleteSimulation: async (
            _p: unknown,
            args: { id: string },
            ctx: Context
        ) => {
            try {
                const db = ctx?.prisma ?? prisma;
                const sim = await db.simulation.findUnique({
                    where: { id: args.id },
                });
                if (!sim) return true;
                if (sim.status === SimulationStatus.running) {
                    throw new Error("Cannot delete a running simulation.");
                }
                await db.simulation.delete({ where: { id: args.id } });
                return true;
            } catch (err) {
                console.error("Error deleting simulation:", err);
                throw new Error("Failed to delete simulation");
            }
        },

        runSimulation: async (
            _p: unknown,
            args: { id: string; mock?: boolean },
            ctx: Context
        ) => {
            const db = ctx?.prisma ?? prisma;
            const sim = await db.simulation.findUnique({
                where: { id: args.id },
            });
            if (!sim) throw new Error("Simulation not found.");
            if (sim.status !== SimulationStatus.queued) {
                throw new Error(
                    "Simulation can only be run when status is QUEUED."
                );
            }

            await db.simulation.update({
                where: { id: sim.id },
                data: { status: SimulationStatus.running },
            });

            try {
                await runEngineAndPersist(db, sim.id);
                const completed = await db.simulation.update({
                    where: { id: sim.id },
                    data: { status: SimulationStatus.completed },
                });
                return completed;
            } catch (err: any) {
                await db.simulation.update({
                    where: { id: sim.id },
                    data: { status: SimulationStatus.failed },
                });
                throw new Error(
                    `Simulation failed: ${err?.message ?? String(err)}`
                );
            }
        },
    },
};

export default SimulationMutationResolvers;
