import "server-only";
import net from "node:net";
import { promises as dns } from "node:dns";

export type ServerStatus = {
  online: boolean;
  players: number;
  max: number;
  version: string | null;
};

const OFFLINE: ServerStatus = { online: false, players: 0, max: 0, version: null };

function varInt(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (v !== 0);
  return Buffer.from(bytes);
}

function readVarInt(buffer: Buffer, offset: number): [number, number] | null {
  let value = 0;
  let size = 0;
  while (true) {
    if (offset + size >= buffer.length) return null;
    const byte = buffer[offset + size];
    value |= (byte & 0x7f) << (7 * size);
    size++;
    if ((byte & 0x80) === 0) return [value, size];
    if (size > 5) throw new Error("VarInt too big");
  }
}

function packet(id: number, payload: Buffer): Buffer {
  const body = Buffer.concat([varInt(id), payload]);
  return Buffer.concat([varInt(body.length), body]);
}

async function resolveAddress(address: string): Promise<{ host: string; port: number }> {
  const [host, rawPort] = address.trim().split(":");
  if (rawPort) return { host, port: Number(rawPort) || 25565 };
  try {
    const [record] = await dns.resolveSrv(`_minecraft._tcp.${host}`);
    if (record) return { host: record.name, port: record.port };
  } catch {}
  return { host, port: 25565 };
}

/**
 * Pings a Java server with the Server List Ping protocol and returns the player count.
 */
export async function pingServer(address: string, timeout = 3500): Promise<ServerStatus> {
  if (!address) return OFFLINE;
  const { host, port } = await resolveAddress(address);

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let data = Buffer.alloc(0);
    const done = (status: ServerStatus) => {
      socket.destroy();
      resolve(status);
    };
    socket.setTimeout(timeout, () => done(OFFLINE));
    socket.on("error", () => done(OFFLINE));
    socket.on("connect", () => {
      const hostBuffer = Buffer.from(host, "utf8");
      const portBuffer = Buffer.alloc(2);
      portBuffer.writeUInt16BE(port);
      const handshake = Buffer.concat([varInt(767), varInt(hostBuffer.length), hostBuffer, portBuffer, varInt(1)]);
      socket.write(packet(0x00, handshake));
      socket.write(packet(0x00, Buffer.alloc(0)));
    });
    socket.on("data", (chunk) => {
      data = Buffer.concat([data, chunk]);
      try {
        const length = readVarInt(data, 0);
        if (!length || data.length < length[0] + length[1]) return;
        let offset = length[1];
        const id = readVarInt(data, offset);
        if (!id) return;
        offset += id[1];
        const strLength = readVarInt(data, offset);
        if (!strLength) return;
        offset += strLength[1];
        const json = JSON.parse(data.subarray(offset, offset + strLength[0]).toString("utf8"));
        done({
          online: true,
          players: json.players?.online ?? 0,
          max: json.players?.max ?? 0,
          version: json.version?.name ?? null,
        });
      } catch {
        done(OFFLINE);
      }
    });
  });
}
