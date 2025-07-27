"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvers = void 0;
const merge_1 = require("@graphql-tools/merge");
const simulation_mutation_1 = __importDefault(require("./simulation.mutation"));
const simulation_query_1 = __importDefault(require("./simulation.query"));
const graphql_scalars_1 = require("graphql-scalars");
const graphql_type_json_1 = __importDefault(require("graphql-type-json"));
exports.resolvers = (0, merge_1.mergeResolvers)([
    { Date: graphql_scalars_1.GraphQLDate, DateTime: graphql_scalars_1.GraphQLDateTime, JSON: graphql_type_json_1.default },
    {
        Query: simulation_query_1.default.Query,
        Mutation: simulation_mutation_1.default.Mutation,
    },
]);
