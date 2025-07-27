"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimulationMutationResolvers = void 0;
const luxon_1 = require("luxon");
const generated_1 = require("../../../prisma/generated");
const sim_engine_1 = __importDefault(require("../../engine/sim-engine"));
const prisma = new generated_1.PrismaClient();
// For Simplicity! Canonical UTC year (non-leap)
const CANONICAL_START_UTC = luxon_1.DateTime.utc(2001, 1, 1, 0, 0, 0, 0);
const CANONICAL_END_UTC = CANONICAL_START_UTC.plus({ days: 365 });
exports.SimulationMutationResolvers = {
    Mutation: {
        createSimulation: async (_p, args, ctx) => {
            try {
                const db = ctx?.prisma ?? prisma;
                const { name, seed = null, arrivalMultiplier = 1.0, chargepointCount, consumptionKwhPer100km = 18.0, chargerPowerKw = 11.0, status = generated_1.SimulationStatus.queued, } = args.input;
                if (chargepointCount <= 0) {
                    throw new Error("chargepointCount must be > 0.");
                }
                const created = await db.simulation.create({
                    data: {
                        name: name ?? null,
                        status: status ?? generated_1.SimulationStatus.queued,
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
            }
            catch (err) {
                console.error("Error creating simulation:", err);
                throw new Error("Failed to create simulation");
            }
        },
        updateSimulation: async (_p, args, ctx) => {
            try {
                const db = ctx?.prisma ?? prisma;
                const sim = await db.simulation.findUnique({
                    where: { id: args.id },
                });
                if (!sim)
                    throw new Error("Simulation not found.");
                if (sim.status !== generated_1.SimulationStatus.queued) {
                    throw new Error("Simulation can only be updated while status is QUEUED.");
                }
                const patch = {};
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
            }
            catch (err) {
                console.error("Error updating simulation:", err);
                throw new Error("Failed to update simulation");
            }
        },
        deleteSimulation: async (_p, args, ctx) => {
            try {
                const db = ctx?.prisma ?? prisma;
                const sim = await db.simulation.findUnique({
                    where: { id: args.id },
                });
                if (!sim)
                    return true;
                if (sim.status === generated_1.SimulationStatus.running) {
                    throw new Error("Cannot delete a running simulation.");
                }
                await db.simulation.delete({ where: { id: args.id } });
                return true;
            }
            catch (err) {
                console.error("Error deleting simulation:", err);
                throw new Error("Failed to delete simulation");
            }
        },
        runSimulation: async (_p, args, ctx) => {
            const db = ctx?.prisma ?? prisma;
            const sim = await db.simulation.findUnique({
                where: { id: args.id },
            });
            if (!sim)
                throw new Error("Simulation not found.");
            if (sim.status !== generated_1.SimulationStatus.queued) {
                throw new Error("Simulation can only be run when status is QUEUED.");
            }
            await db.simulation.update({
                where: { id: sim.id },
                data: { status: generated_1.SimulationStatus.running },
            });
            try {
                await (0, sim_engine_1.default)(db, sim.id);
                const completed = await db.simulation.update({
                    where: { id: sim.id },
                    data: { status: generated_1.SimulationStatus.completed },
                });
                return completed;
            }
            catch (err) {
                await db.simulation.update({
                    where: { id: sim.id },
                    data: { status: generated_1.SimulationStatus.failed },
                });
                throw new Error(`Simulation failed: ${err?.message ?? String(err)}`);
            }
        },
    },
};
exports.default = exports.SimulationMutationResolvers;
