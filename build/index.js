"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const server_1 = require("@apollo/server");
const express5_1 = require("@as-integrations/express5");
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const resolvers_1 = require("./graphql/resolvers");
const generated_1 = require("../prisma/generated");
const prisma = new generated_1.PrismaClient();
const typeDefs = fs_1.default.readFileSync("src/graphql/typeDefs/simulation.graphql", "utf8");
async function start() {
    const app = (0, express_1.default)();
    const server = new server_1.ApolloServer({
        typeDefs,
        resolvers: resolvers_1.resolvers,
    });
    await server.start();
    app.use("/graphql", (0, cors_1.default)(), express_1.default.json(), (0, express5_1.expressMiddleware)(server, {
        context: async () => ({ prisma }),
    }));
    const port = Number(process.env.PORT) || 4000;
    app.listen(port, () => {
        console.log(`Server ready at http://localhost:${port}/graphql`);
    });
}
start().catch((err) => {
    console.error(err);
    process.exit(1);
});
