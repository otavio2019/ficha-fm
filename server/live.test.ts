import { createServer } from "http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { io, type Socket } from "socket.io-client";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { closeLiveGateway, emitCharacterUpdated, registerLiveGateway } from "./live";

const servers: ReturnType<typeof createServer>[] = [];
const sockets: Socket[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  sockets.splice(0).forEach(socket => socket.disconnect());
  await closeLiveGateway();
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

describe("gateway de atualização ao vivo", () => {
  it("entrega atualizações de uma ficha para a sala pública associada", async () => {
    const server = createServer();
    servers.push(server);
    registerLiveGateway(server);
    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Endereço de teste indisponível");

    const received = new Promise<{ characterId: string; shareToken?: string }>(resolve => {
      const client = io(`http://127.0.0.1:${address.port}`, { path: "/api/live", transports: ["websocket"] });
      sockets.push(client);
      client.on("connect", () => {
        client.emit("watch-share", "token-publico");
        client.on("character-updated", event => resolve(event));
        setTimeout(() => emitCharacterUpdated({ characterId: "ficha-123", shareToken: "token-publico", updatedAt: Date.now() }), 10);
      });
    });

    await expect(received).resolves.toMatchObject({ characterId: "ficha-123" });
    await expect(received).resolves.not.toHaveProperty("shareToken");
  });

  it("não permite que um cliente não autenticado observe uma ficha privada", async () => {
    const server = createServer();
    servers.push(server);
    registerLiveGateway(server);
    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Endereço de teste indisponível");

    let received = false;
    const client = io(`http://127.0.0.1:${address.port}`, { path: "/api/live", transports: ["websocket"] });
    sockets.push(client);
    await new Promise<void>(resolve => client.on("connect", () => {
      client.on("character-updated", () => { received = true; });
      client.emit("watch-character", "ficha-privada");
      setTimeout(() => { emitCharacterUpdated({ characterId: "ficha-privada", updatedAt: Date.now() }); }, 20);
      setTimeout(resolve, 70);
    }));

    expect(received).toBe(false);
  });

  it("aceita o fallback bearer para observar a própria ficha privada", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ id: 7, openId: "user-7" } as Awaited<ReturnType<typeof sdk.authenticateRequest>>);
    vi.spyOn(db, "getFMCharacter").mockResolvedValue({ id: "ficha-propria", ownerId: 7, name: "Yuta", portraitUrl: null, sheet: {}, createdAt: new Date(), updatedAt: new Date() });
    const server = createServer();
    servers.push(server);
    registerLiveGateway(server);
    await new Promise<void>(resolve => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Endereço de teste indisponível");

    const received = new Promise<{ characterId: string }>(resolve => {
      const client = io(`http://127.0.0.1:${address.port}`, { path: "/api/live", transports: ["websocket"], auth: { token: "token-preview" } });
      sockets.push(client);
      client.on("connect", () => {
        client.on("character-updated", event => resolve(event));
        client.emit("watch-character", "ficha-propria");
        setTimeout(() => emitCharacterUpdated({ characterId: "ficha-propria", updatedAt: Date.now() }), 20);
      });
    });

    await expect(received).resolves.toMatchObject({ characterId: "ficha-propria" });
    expect(vi.mocked(sdk.authenticateRequest).mock.calls[0]?.[0]?.headers.authorization).toBe("Bearer token-preview");
  });
});
