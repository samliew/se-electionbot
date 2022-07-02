import express from "express";
import { onMountAddToRoutes } from "../utils.js";

export const ping = express();

onMountAddToRoutes(ping);

ping.get("/", (_, res) => {
    res.sendStatus(200);
});