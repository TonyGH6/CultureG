import { io } from "socket.io-client";

const token = process.env.TOKEN!;
const duelId = process.env.DUEL_ID!;

const socket = io("http://localhost:3000", {
    auth: { token },
});

socket.on("connect", () => {
    console.log("connected", socket.id);
    socket.emit("duel:join", { duelId });
});

socket.on("duel:joined", (msg) => console.log("joined", msg));
socket.on("duel:started", (msg) => console.log("STARTED", msg));
socket.on("connect_error", (err) => console.log("connect_error", err.message));
