const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const START_PURSE = 120; // crore
const MAX_SQUAD = 25;
const MAX_OVERSEAS = 8;
const MIN_INCREMENT = 0.25;
const rooms = new Map();

// Fictional demo player pool. Replace/edit this list in server.js.
const PLAYER_POOL = [
  { id:"P001", name:"Aarav Sharma", role:"Batter", country:"India", base:2 },
  { id:"P002", name:"Kabir Singh", role:"Fast Bowler", country:"India", base:1.5 },
  { id:"P003", name:"Rohan Mehta", role:"All-rounder", country:"India", base:2 },
  { id:"P004", name:"Ishaan Verma", role:"Wicketkeeper", country:"India", base:1.5 },
  { id:"P005", name:"Dev Malhotra", role:"Batter", country:"India", base:1 },
  { id:"P006", name:"Arjun Nair", role:"Spinner", country:"India", base:1 },
  { id:"P007", name:"Zayan Khan", role:"Fast Bowler", country:"India", base:1.5 },
  { id:"P008", name:"Neel Joshi", role:"All-rounder", country:"India", base:1 },
  { id:"P009", name:"Liam Carter", role:"Batter", country:"Overseas", base:2 },
  { id:"P010", name:"Noah Williams", role:"Fast Bowler", country:"Overseas", base:1.5 },
  { id:"P011", name:"Oliver Smith", role:"All-rounder", country:"Overseas", base:2 },
  { id:"P012", name:"Ethan Brown", role:"Wicketkeeper", country:"Overseas", base:1.5 },
  { id:"P013", name:"Mateo Silva", role:"Spinner", country:"Overseas", base:1 },
  { id:"P014", name:"Lucas Martin", role:"Batter", country:"Overseas", base:1.5 },
  { id:"P015", name:"Ryan Cooper", role:"Fast Bowler", country:"Overseas", base:2 },
  { id:"P016", name:"Aditya Rao", role:"Batter", country:"India", base:0.75 },
  { id:"P017", name:"Vihaan Patel", role:"Spinner", country:"India", base:0.75 },
  { id:"P018", name:"Samir Das", role:"All-rounder", country:"India", base:1 },
  { id:"P019", name:"Jack Wilson", role:"Batter", country:"Overseas", base:1 },
  { id:"P020", name:"Yuvraj Gill", role:"Fast Bowler", country:"India", base:1 }
];

const FRANCHISES = ["CSK","MI","RCB","KKR","RR","SRH","DC","PBKS","GT","LSG"];

function cleanRoom(room) {
  return {
    code: room.code,
    status: room.status,
    purse: START_PURSE,
    players: room.players,
    currentIndex: room.currentIndex,
    currentBid: room.currentBid,
    highestBidder: room.highestBidder,
    auctionLog: room.auctionLog,
    franchises: Object.values(room.teams).map(t => ({
      id:t.id, name:t.name, purse:t.purse, squad:t.squad
    })),
    hostId: room.hostId
  };
}
function emitRoom(room) { io.to(room.code).emit("room:update", cleanRoom(room)); }
function fail(socket, message) { socket.emit("app:error", message); }
function getTeam(room, socketId) {
  return Object.values(room.teams).find(t => t.socketId === socketId);
}
function currentPlayer(room) { return room.players[room.currentIndex] || null; }
function nextPlayer(room) {
  room.currentIndex += 1;
  room.currentBid = 0;
  room.highestBidder = null;
  if (room.currentIndex >= room.players.length) room.status = "completed";
}
function canAfford(team, amount) {
  return team && team.purse + 1e-9 >= amount && team.squad.length < MAX_SQUAD;
}
function overseasCount(team) {
  return team.squad.filter(p => p.country === "Overseas").length;
}

io.on("connection", socket => {
  socket.on("room:create", ({ franchise }) => {
    if (!FRANCHISES.includes(franchise)) return fail(socket, "Choose a valid franchise.");
    const code = crypto.randomBytes(3).toString("hex").toUpperCase();
    const room = {
      code, status:"waiting", hostId:socket.id, players:[...PLAYER_POOL],
      currentIndex:0, currentBid:0, highestBidder:null, auctionLog:[],
      teams:{ [socket.id]: { id:socket.id, socketId:socket.id, name:franchise, purse:START_PURSE, squad:[] } }
    };
    rooms.set(code, room);
    socket.join(code);
    socket.emit("room:joined", { code, teamId:socket.id });
    emitRoom(room);
  });

  socket.on("room:join", ({ code, franchise }) => {
    code = String(code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return fail(socket, "Room not found. Check the code.");
    if (room.status !== "waiting") return fail(socket, "This auction has already started.");
    if (!FRANCHISES.includes(franchise)) return fail(socket, "Choose a valid franchise.");
    if (Object.keys(room.teams).length >= 2) return fail(socket, "This room is full (2 players maximum).");
    if (Object.values(room.teams).some(t => t.name === franchise)) return fail(socket, "That franchise is already taken.");
    room.teams[socket.id] = { id:socket.id, socketId:socket.id, name:franchise, purse:START_PURSE, squad:[] };
    socket.join(code);
    socket.emit("room:joined", { code, teamId:socket.id });
    emitRoom(room);
  });

  socket.on("auction:start", ({ code }) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room || room.hostId !== socket.id) return fail(socket, "Only the room creator can start the auction.");
    if (Object.keys(room.teams).length !== 2) return fail(socket, "Waiting for the second franchise owner.");
    if (room.status !== "waiting") return;
    room.status = "live";
    emitRoom(room);
  });

  socket.on("bid:place", ({ code, amount }) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room || room.status !== "live") return fail(socket, "Auction is not live.");
    const team = getTeam(room, socket.id);
    const player = currentPlayer(room);
    if (!team || !player) return fail(socket, "You are not part of this auction.");
    if (room.highestBidder === socket.id) return fail(socket, "You already hold the highest bid.");
    const next = Number(Number(amount).toFixed(2));
    const minimum = room.currentBid === 0 ? player.base : room.currentBid + MIN_INCREMENT;
    if (!Number.isFinite(next) || next + 1e-9 < minimum) return fail(socket, `Minimum valid bid is ₹${minimum.toFixed(2)} Cr.`);
    if (!canAfford(team, next)) return fail(socket, "Insufficient purse or your squad is full.");
    if (player.country === "Overseas" && overseasCount(team) >= MAX_OVERSEAS) return fail(socket, "Overseas player limit reached.");
    room.currentBid = next;
    room.highestBidder = socket.id;
    emitRoom(room);
  });

  socket.on("auction:close", ({ code }) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room || room.status !== "live") return fail(socket, "Auction is not live.");
    const player = currentPlayer(room);
    if (!player) return;
    if (room.highestBidder) {
      const winner = room.teams[room.highestBidder];
      if (!winner || !canAfford(winner, room.currentBid)) return fail(socket, "Winning team can no longer afford this player.");
      winner.purse = Number((winner.purse - room.currentBid).toFixed(2));
      winner.squad.push({ ...player, soldFor:room.currentBid });
      room.auctionLog.unshift({ player:player.name, team:winner.name, price:room.currentBid, result:"SOLD" });
    } else {
      room.auctionLog.unshift({ player:player.name, team:null, price:0, result:"UNSOLD" });
    }
    nextPlayer(room);
    emitRoom(room);
  });

  socket.on("disconnect", () => {
    for (const [code, room] of rooms) {
      const team = getTeam(room, socket.id);
      if (!team) continue;
      // Keep the team reserved so a temporary disconnect does not erase its squad.
      team.socketId = null;
      if (room.status === "waiting" && room.hostId === socket.id) room.hostDisconnected = true;
      io.to(code).emit("notice", `${team.name} disconnected. The room remains open.`);
    }
  });
});

server.listen(PORT, () => console.log(`IPL Auction running at http://localhost:${PORT}`));
