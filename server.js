const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());

const { createServer } = require("http");
const { Server } = require("socket.io");
const next = require("next");
const jose = require("jose");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(name + "="));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    path: "/socket.io",
  });

  io.use(async (socket, next) => {
    try {
      const token = parseCookie(socket.handshake.headers.cookie, "access_token");
      if (!token) return next(new Error("Unauthorized"));
      const { payload } = await jose.jwtVerify(token, JWT_SECRET);
      if (typeof payload.sub !== "string") return next(new Error("Unauthorized"));
      socket.data.userId = payload.sub;
      next();
    } catch (err) {
      console.error("[socket auth] verify failed:", err.message);
      next(new Error("Unauthorized"));
    }
  });

  const editPresence = new Map(); // key: `${planId}:${itemType}:${itemId}` -> Map<socketId, { userId, userName, updatedAt }>
  const PRESENCE_TTL_MS = 90_000;

  function presenceKey(planId, itemType, itemId) {
    return `${planId}:${itemType}:${itemId}`;
  }

  function broadcastPresence(planId, itemType, itemId) {
    const key = presenceKey(planId, itemType, itemId);
    const presenceMap = editPresence.get(key);
    const editors = presenceMap
      ? Array.from(presenceMap.values()).map((p) => ({ userId: p.userId, userName: p.userName }))
      : [];
    io.to(`plan:${planId}`).emit("editing:presence-update", { itemType, itemId, editors });
  }

  setInterval(() => {
    const now = Date.now();
    for (const [key, presenceMap] of editPresence.entries()) {
      let changed = false;
      for (const [socketId, p] of presenceMap.entries()) {
        if (now - p.updatedAt > PRESENCE_TTL_MS) {
          presenceMap.delete(socketId);
          changed = true;
        }
      }
      const [planId, itemType, itemId] = key.split(":");
      if (presenceMap.size === 0) {
        editPresence.delete(key);
        if (changed) io.to(`plan:${planId}`).emit("editing:presence-update", { itemType, itemId, editors: [] });
      } else if (changed) {
        broadcastPresence(planId, itemType, itemId);
      }
    }
  }, 30_000);

  io.on("connection", (socket) => {
    console.log("[socket] user connected:", socket.data.userId);
    socket.join(`user:${socket.data.userId}`);

    socket.on("join-plan", (planId) => {
      socket.join(`plan:${planId}`);
    });

    socket.on("leave-plan", (planId) => {
      socket.leave(`plan:${planId}`);
    });

    // Joining an item's edit presence. If allowMultipleEditing is false and
    // someone else is already present, the join is denied (exclusive lock).
    // If true, everyone is granted and simply added to the presence set —
    // used purely to drive the "N people editing" indicator.
    socket.on("editing:join", ({ planId, itemType, itemId, userName, allowMultipleEditing }, cb) => {
      const key = presenceKey(planId, itemType, itemId);
      let presenceMap = editPresence.get(key);
      if (!presenceMap) {
        presenceMap = new Map();
        editPresence.set(key, presenceMap);
      }

      const others = Array.from(presenceMap.entries()).filter(([sid]) => sid !== socket.id);

      if (!allowMultipleEditing && others.length > 0) {
        return cb({ granted: false, lockedByName: others[0][1].userName });
      }

      presenceMap.set(socket.id, { userId: socket.data.userId, userName, updatedAt: Date.now() });
      socket.data.editingKeys = socket.data.editingKeys || new Set();
      socket.data.editingKeys.add(key);

      broadcastPresence(planId, itemType, itemId);
      cb({ granted: true });
    });

    socket.on("editing:heartbeat", ({ planId, itemType, itemId }) => {
      const key = presenceKey(planId, itemType, itemId);
      const entry = editPresence.get(key)?.get(socket.id);
      if (entry) entry.updatedAt = Date.now();
    });

    socket.on("editing:leave", ({ planId, itemType, itemId }) => {
      const key = presenceKey(planId, itemType, itemId);
      const presenceMap = editPresence.get(key);
      if (presenceMap?.delete(socket.id)) {
        socket.data.editingKeys?.delete(key);
        if (presenceMap.size === 0) editPresence.delete(key);
        broadcastPresence(planId, itemType, itemId);
      }
    });

    socket.on("disconnect", () => {
      if (socket.data.editingKeys) {
        for (const key of socket.data.editingKeys) {
          const presenceMap = editPresence.get(key);
          if (presenceMap?.delete(socket.id)) {
            const [planId, itemType, itemId] = key.split(":");
            if (presenceMap.size === 0) editPresence.delete(key);
            broadcastPresence(planId, itemType, itemId);
          }
        }
      }
    });
  });

  global.__io = io;

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});