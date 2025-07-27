import "dotenv/config";
import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express5";
import cors from "cors";
import fs from "fs";
import { resolvers } from "./graphql/resolvers";
import { Context } from "./context";
import { PrismaClient } from "../prisma/generated";

const prisma = new PrismaClient();

const typeDefs = fs.readFileSync(
    "src/graphql/typeDefs/simulation.graphql",
    "utf8"
);

async function start() {
    const app = express();

    const server = new ApolloServer<Context>({
        typeDefs,
        resolvers,
    });

    await server.start();

    app.use(
        "/graphql",
        cors(),
        express.json(),
        expressMiddleware(server, {
            context: async () => ({ prisma }),
        })
    );

    const port = Number(process.env.PORT) || 4000;
    app.listen(port, () => {
        console.log(`Server ready at http://localhost:${port}/graphql`);
    });
}

start().catch((err) => {
    console.error(err);
    process.exit(1);
});
