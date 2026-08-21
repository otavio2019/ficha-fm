import type { Server as HttpServer } from "http";
import type { Request } from "express";
import { Server } from "socket.io";
import { getFMCharacter } from "./db";
import { sdk } from "./_core/sdk";

type CharacterUpdatedEvent = { characterId: string; shareToken?: string; updatedAt: number; sourceClientId?: string };

let liveServer: Server | null = null;

export function registerLiveGateway(server: HttpServer) {
  liveServer = new Server(server, {
    path: "/api/live",
    cors: { origin: true, credentials: true },
  });

  liveServer.use(async (socket, next) => {
    try {
      const bearerToken = socket.handshake.auth?.token;
      if (!socket.request.headers.authorization && typeof bearerToken === "string" && bearerToken.length > 0) {
        socket.request.headers.authorization = `Bearer ${bearerToken}`;
      }
      const user = await sdk.authenticateRequest(socket.request as unknown as Request);
      socket.data.userId = user.id;
    } catch {
      socket.data.userId = null;
    }
    next();
  });

  liveServer.on("connection", socket => {
    socket.on("watch-character", async (characterId: unknown) => {
      if (typeof characterId !== "string" || characterId.length > 64 || !socket.data.userId) return;
      const character = await getFMCharacter(characterId);
      if (character?.ownerId === socket.data.userId) socket.join(`fm-character:${characterId}`);
    });
    socket.on("watch-share", (shareToken: unknown) => {
      if (typeof shareToken === "string" && shareToken.length <= 64) socket.join(`fm-share:${shareToken}`);
    });
  });
}

export function emitCharacterUpdated(event: CharacterUpdatedEvent) {
  if (!liveServer) return;
  const payload = { characterId: event.characterId, updatedAt: event.updatedAt, sourceClientId: event.sourceClientId };
  liveServer.to(`fm-character:${event.characterId}`).emit("character-updated", payload);
  if (event.shareToken) liveServer.to(`fm-share:${event.shareToken}`).emit("character-updated", payload);
}

export async function closeLiveGateway() {
  if (!liveServer) return;
  await liveServer.close();
  liveServer = null;
}
