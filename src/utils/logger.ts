import fs from 'node:fs';
import path from 'node:path';

const logDir = path.resolve(__dirname, '../../logs');
const logFile = path.join(logDir, 'errors.log');

function ensureLogDir() {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

export function logError(error: unknown) {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  const type = (error as any)?.name || 'Error';
  const stack = (error instanceof Error && error.stack) ? error.stack : String(error);
  const msg = `[${timestamp}] ${type}: ${stack}\n`;
  fs.appendFileSync(logFile, msg);
  console.error(msg);
}
