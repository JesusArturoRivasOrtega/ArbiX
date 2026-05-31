import type WebSocket from "ws";

export function safeJsonParse<T>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function closeSocket(socket: WebSocket | undefined, timeoutMs = 1500): Promise<void> {
  if (!socket || socket.readyState === 3) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let timeout: NodeJS.Timeout;
    const finish = () => {
      clearTimeout(timeout);
      socket.off("close", finish);
      socket.off("error", finish);
      resolve();
    };
    timeout = setTimeout(finish, timeoutMs);

    socket.once("close", finish);
    socket.once("error", finish);
    socket.close();
  });
}
