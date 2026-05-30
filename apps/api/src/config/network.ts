const DEFAULT_API_PORT = 4000;
const DEFAULT_WEB_PORT = 3001;

export function getApiPort(): number {
  return readPort(process.env.PORT ?? process.env.API_PORT, DEFAULT_API_PORT);
}

export function getAllowedFrontendOrigins(): string[] {
  const webPort = readPort(process.env.WEB_PORT ?? process.env.FRONTEND_PORT, DEFAULT_WEB_PORT);
  const localOrigins = [
    `http://localhost:${webPort}`,
    `http://127.0.0.1:${webPort}`
  ];

  return unique([
    ...parseOrigins(process.env.FRONTEND_URL),
    ...localOrigins
  ]);
}

export function isAllowedFrontendOrigin(
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void
): void {
  if (!origin) {
    callback(null, true);
    return;
  }
  callback(null, getAllowedFrontendOrigins().includes(origin));
}

function parseOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function readPort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535) {
    return parsed;
  }
  return fallback;
}

function unique(values: string[]): string[] {
  return values.filter((value, index, all) => all.indexOf(value) === index);
}
