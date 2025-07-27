import { mergeResolvers } from "@graphql-tools/merge";
import SimulationMutationResolvers from "./simulation.mutation";
import SimulationQueryResolvers from "./simulation.query";
import { GraphQLDate, GraphQLDateTime } from "graphql-scalars";
import GraphQLJSON from "graphql-type-json";

export const resolvers = mergeResolvers([
    { Date: GraphQLDate, DateTime: GraphQLDateTime, JSON: GraphQLJSON },
    {
        Query: SimulationQueryResolvers.Query,
        Mutation: SimulationMutationResolvers.Mutation,
    },
]);
