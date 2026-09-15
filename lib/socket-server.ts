import type { Server, Socket } from "socket.io";

declare global {
  var __io: Server | undefined;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  const io = global.__io;
  if (!io) {
    console.warn("[socket] io not initialized — is the app running via server.js?");
    return;
  }
  io.to(`user:${userId}`).emit(event, payload);
}

/**
 * Initialize socket listeners for client-to-server events
 */
export function initSocketServer(io: Server) {
  global.__io = io;

  io.on("connection", (socket: Socket) => {
    // Handle typing events sent from the client chat panel
    socket.on("chat:typing", (payload: { recipientId: string; conversationId: string; connectionId: string; isTyping: boolean }) => {
      if (!payload.recipientId) return;

      // Relay the typing event to the recipient's room
      emitToUser(payload.recipientId, "chat:typing", {
        conversationId: payload.conversationId,
        connectionId: payload.connectionId,
        isTyping: payload.isTyping,
      });
    });

    socket.on("disconnect", () => {
      // Cleanup handled by socket.io
    });
  });
}