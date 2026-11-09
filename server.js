const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false }, pingInterval: 20000, pingTimeout: 30000 });
app.use(express.static("public"));
app.get("/health", (_req, res) => res.json({ ok: true, game: "Co-op Chaos" }));

const rooms = new Map();
const MAX_PLAYERS = 8;
const LEVELS = [
  { key:[980,280], door:[1770,390], buttons:[[680,480],[1190,480]] },
  { key:[900,250], door:[1780,390], buttons:[[650,480],[1250,480]] },
  { key:[1550,300], door:[1800,390], buttons:[[300,480],[1500,480]] },
  { key:[1450,250], door:[1800,390], buttons:[[180,480],[1550,480]] },
  { key:[1120,300], door:[1800,390], buttons:[[750,370],[1500,480]] },
  { key:[1600,360], door:[1800,390], buttons:[[950,420],[1300,480]] },
  { key:[1600,240], door:[1800,390], buttons:[[900,480],[1550,480]] },
  { key:[1700,180], door:[1800,390], buttons:[] },
  { key:[1650,300], door:[1800,390], buttons:[[650,430],[1100,430]] },
  { key:[1700,180], door:[1800,390], buttons:[[600,340],[1450,480]] },
  { key:[1580,230], door:[1800,390], buttons:[[520,480],[1320,480]] },
  { key:[1250,260], door:[1800,390], buttons:[[430,480],[1450,480]] },
  { key:[1650,190], door:[1800,390], buttons:[[700,480],[1200,480]] },
  { key:[1550,240], door:[1800,390], buttons:[[480,480],[1400,480]] },
  { key:[1700,200], door:[1800,390], buttons:[[620,480],[1260,480]] },
  { key:[1500,260], door:[1800,390], buttons:[[550,480],[1350,480]] },
  { key:[1650,220], door:[1800,390], buttons:[[420,480],[1500,480]] },
  { key:[1600,210], door:[1800,390], buttons:[[600,480],[1300,480]] },
  { key:[1700,180], door:[1800,390], buttons:[[500,480],[1000,480],[1500,480]] },
  { key:[1750,170], door:[1840,390], buttons:[[420,480],[950,480],[1450,480]] }
];
const COLORS = ["#ff6b6b","#ffd166","#06d6a0","#4cc9f0","#b388ff","#ff8fab","#f4a261","#90be6d"];
const cleanName = value => String(value || "Jogador").replace(/[<>]/g, "").trim().slice(0, 12) || "Jogador";
const makeCode = () => crypto.randomBytes(3).toString("hex").toUpperCase();
const distance = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function snapshot(room) {
  return {
    code: room.code, status: room.status, level: room.level,
    keyFound: room.keyFound, hostId: room.hostId, activatedButtons: [...room.activatedButtons],
    players: [...room.players.values()].map(p => ({
      id:p.id, name:p.name, color:p.color, x:p.x, y:p.y, alive:p.alive
    }))
  };
}
function sendState(room) { io.to(room.code).emit("state", snapshot(room)); }
function addPlayer(room, socket, name) {
  room.players.set(socket.id, {
    id:socket.id, name:cleanName(name), color:COLORS[room.players.size % COLORS.length],
    x:80, y:440, alive:true, input:{left:false,right:false,jump:false}, lastInput:0
  });
  if (!room.hostId) room.hostId = socket.id;
}
function removePlayer(socket) {
  const code = socket.data.room;
  if (!code) return;
  socket.leave(code);
  socket.data.room = null;
  const room = rooms.get(code);
  if (!room) return;
  room.players.delete(socket.id);
  if (!room.players.size) { rooms.delete(code); return; }
  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
  sendState(room);
}
function resetPositions(room) {
  let index = 0;
  for (const player of room.players.values()) {
    player.x = 70 + index * 38;
    player.y = 440;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.alive = true;
    player.input = {left:false,right:false,jump:false};
    index++;
  }
}
function beginLevel(room, nextLevel) {
  room.level = nextLevel;
  room.keyFound = false;
  room.buttonHold = 0;
  room.activatedButtons = new Set();
  resetPositions(room);
  io.to(room.code).emit("level", room.level);
  sendState(room);
}
function tryComplete(room, dt) {
  if (room.status !== "playing") return;
  const config = LEVELS[room.level];
  if (!config || !room.players.size) return;
  const players = [...room.players.values()];
  const key = config.key;
  if (!room.keyFound && players.some(p => distance(p.x + 15, p.y + 19, key[0], key[1]) < 52)) {
    room.keyFound = true;
    io.to(room.code).emit("notice", "🔑 Chave encontrada! Agora juntem a equipe na saída.");
  }
  let buttonsReady = true;
  const occupiedPlayers = new Set();
  const pressed = new Set();
  config.buttons.forEach(([x,y], index) => {
    const player = players.find(p => !occupiedPlayers.has(p.id) && distance(p.x + 15, p.y + 38, x, y) < 58);
    if (player) {
      occupiedPlayers.add(player.id);
      pressed.add(index);
    }
  });
  room.activatedButtons = pressed;
  buttonsReady = players.length >= 2 && pressed.size === config.buttons.length;
  const teamReady = players.length >= 1 && players.every(p =>
    distance(p.x + 15, p.y + 19, config.door[0], config.door[1]) < 155
  );
  if (room.keyFound && buttonsReady && teamReady) room.buttonHold += dt;
  else room.buttonHold = 0;

  if (room.buttonHold >= 1.1) {
    room.buttonHold = 0;
    if (room.level === LEVELS.length - 1) {
      room.status = "finished";
      io.to(room.code).emit("won");
    } else {
      io.to(room.code).emit("notice", "🎉 Fase concluída! Preparando a próxima...");
      beginLevel(room, room.level + 1);
    }
  }
}
io.on("connection", socket => {
  socket.data.room = null;
  socket.on("create", (data = {}, callback) => {
    removePlayer(socket);
    let code = makeCode();
    while (rooms.has(code)) code = makeCode();
    const room = { code, status:"waiting", level:0, keyFound:false, buttonHold:0, activatedButtons:new Set(), hostId:null, players:new Map() };
    rooms.set(code, room);
    socket.join(code);
    socket.data.room = code;
    addPlayer(room, socket, data.name);
    callback?.({ok:true, code});
    sendState(room);
  });
  socket.on("join", (data = {}, callback) => {
    removePlayer(socket);
    const code = String(data.code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return callback?.({ok:false,error:"Sala não encontrada. Confira o código."});
    if (room.status !== "waiting") return callback?.({ok:false,error:"A partida já começou."});
    if (room.players.size >= MAX_PLAYERS) return callback?.({ok:false,error:"A sala já está cheia (8 jogadores)."});
    socket.join(code);
    socket.data.room = code;
    addPlayer(room, socket, data.name);
    callback?.({ok:true, code});
    sendState(room);
  });
  socket.on("start", () => {
    const room = rooms.get(socket.data.room);
    if (!room || room.status !== "waiting" || socket.id !== room.hostId) return;
    if (room.players.size < 2) {
      socket.emit("notice", "São necessários pelo menos 2 jogadores para começar. Chame um amigo!");
      return;
    }
    room.status = "playing";
    beginLevel(room, 0);
  });
  socket.on("input", data => {
    const room = rooms.get(socket.data.room);
    const player = room?.players.get(socket.id);
    if (!room || room.status !== "playing" || !player || !data || typeof data !== "object") return;
    const now = Date.now();
    if (now - player.lastInput < 25) return;
    player.lastInput = now;
    if (Number.isFinite(data.x)) player.x = Math.max(0, Math.min(1870, data.x));
    if (Number.isFinite(data.y)) player.y = Math.max(0, Math.min(862, data.y));
    if (now - (room.lastState || 0) > 65) {
      room.lastState = now;
      sendState(room);
    }
  });
  socket.on("leave", () => removePlayer(socket));
  socket.on("disconnect", () => removePlayer(socket));
});

setInterval(() => {
  const dt = 0.1;
  for (const room of rooms.values()) tryComplete(room, dt);
}, 100);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Co-op Chaos rodando na porta " + PORT));