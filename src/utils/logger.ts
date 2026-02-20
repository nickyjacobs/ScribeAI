// src/utils/logger.ts
import winston from 'winston';
import * as path from 'path';
import * as os from 'os';

const LOG_DIR  = path.join(os.homedir(), '.scribeai');
const LOG_FILE = path.join(LOG_DIR, 'scribeai.log');

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: LOG_FILE,
      maxsize: 1024 * 1024, // 1 MB
      maxFiles: 3,
    }),
  ],
  // Stille modus — geen console output tenzij debug
  silent: false,
});
