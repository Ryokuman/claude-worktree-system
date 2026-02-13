import net from "net";
import { env } from "./env";
import { store } from "./store";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

export async function findAvailablePort(): Promise<number> {
  const { PORT_RANGE_START, PORT_RANGE_END } = env;
  const usedPorts = new Set(store.getActive().map((w) => w.port));

  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    if (usedPorts.has(port)) continue;
    const available = await isPortAvailable(port);
    if (available) return port;
  }

  throw new Error(
    `No available ports in range ${PORT_RANGE_START}-${PORT_RANGE_END}`
  );
}
