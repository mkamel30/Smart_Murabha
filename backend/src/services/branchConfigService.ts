import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface BranchConfig {
  branchId: string;
  branchName: string;
  createdAt: string;
  updatedAt: string;
}

function getConfigPath(): string {
  // Look for config file next to the database
  const rootDir = path.resolve(process.cwd());
  const locations = [
    path.join(rootDir, 'prisma'),
    path.join(rootDir, 'backend', 'prisma'),
  ];

  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      return path.join(loc, 'branch-config.json');
    }
  }
  return path.join(locations[0], 'branch-config.json');
}

export class BranchConfigService {
  private configPath: string;

  constructor() {
    this.configPath = getConfigPath();
  }

  /**
   * Get the current branch config. Creates one with a UUID if not exists.
   */
  getConfig(): BranchConfig {
    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(raw) as BranchConfig;
      } catch {
        // Corrupted file, recreate
      }
    }

    // Create default config with a permanent UUID
    const config: BranchConfig = {
      branchId: uuidv4(),
      branchName: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.saveConfig(config);
    return config;
  }

  /**
   * Update the branch name. The branchId never changes.
   */
  setBranchName(name: string): BranchConfig {
    const config = this.getConfig();
    config.branchName = name.trim();
    config.updatedAt = new Date().toISOString();
    this.saveConfig(config);
    return config;
  }

  private saveConfig(config: BranchConfig): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
  }
}
