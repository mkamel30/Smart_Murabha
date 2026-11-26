import fs from 'fs';
import path from 'path';
import { authenticator } from 'otplib';

interface SecurityConfig {
  mfaSecret: string;
  createdAt: string;
  updatedAt: string;
}

function getConfigPath(): string {
  const rootDir = path.resolve(process.cwd());
  const locations = [
    path.join(rootDir, 'prisma'),
    path.join(rootDir, 'backend', 'prisma'),
  ];

  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      return path.join(loc, 'security-config.json');
    }
  }
  return path.join(locations[0], 'security-config.json');
}

export class SecurityConfigService {
  private configPath: string;
  private cached: SecurityConfig | null = null;

  constructor() {
    this.configPath = getConfigPath();
  }

  getConfig(): SecurityConfig {
    if (this.cached) return this.cached;

    if (fs.existsSync(this.configPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.configPath, 'utf-8')) as SecurityConfig;
        if (parsed?.mfaSecret) {
          this.cached = parsed;
          return parsed;
        }
      } catch {
        // Fall through and regenerate: an unreadable config must not lock the owner out of recovery.
      }
    }

    const config: SecurityConfig = {
      mfaSecret: authenticator.generateSecret(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    this.cached = config;
    return config;
  }
}

export default new SecurityConfigService();
