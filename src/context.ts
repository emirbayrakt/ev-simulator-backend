import { PrismaClient } from "./generated/prisma";

export interface Context {
    prisma: PrismaClient;
}
