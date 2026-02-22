"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const socket_io_client_1 = require("socket.io-client");
const token = process.env.TOKEN;
const duelId = process.env.DUEL_ID;
const socket = (0, socket_io_client_1.io)("http://localhost:3000", {
    auth: { token },
});
socket.on("connect", () => {
    console.log("connected", socket.id);
    socket.emit("duel:join", { duelId });
});
socket.on("duel:joined", (msg) => console.log("joined", msg));
socket.on("duel:started", (msg) => console.log("STARTED", msg));
socket.on("connect_error", (err) => console.log("connect_error", err.message));
