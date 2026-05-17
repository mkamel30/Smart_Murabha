import { PrismaClient } from '@prisma/client';

interface Migration {
  version: string;
  description: string;
  sql: string[];
}

const MIGRATIONS: Migration[] = [
  {
    version: '1.0.0',
    description: 'إضافة نوع العميل (مخبز/حلواني)',
    sql: [
      `ALTER TABLE Customer ADD COLUMN customerType TEXT DEFAULT 'عام';`,
    ]
  },
  {
    version: '1.0.1',
    description: 'تحسين فهرسة العملاء',
    sql: [
      `CREATE INDEX IF NOT EXISTS idx_customer_bkcode ON Customer(bkCode);`,
      `CREATE INDEX IF NOT EXISTS idx_customer_type ON Customer(customerType);`,
    ]
  },
  {
    version: '1.0.2',
    description: 'إضافة حقل الإدارة (Department)',
    sql: [
      `ALTER TABLE Customer ADD COLUMN department TEXT;`
    ]
  }
];

export async function runMigrations(prisma: PrismaClient): Promise<void> {
  console.log('🔄 Checking for database migrations...');
  
  try {
    // Create migration tracking table if missing
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS _app_migrations (
        version TEXT PRIMARY KEY,
        applied_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // Get applied migrations
    const applied = await prisma.$queryRawUnsafe<{version: string}[]>(
      `SELECT version FROM _app_migrations`
    );
    const appliedSet = new Set(applied.map(m => m.version));

    // Apply new migrations
    for (const migration of MIGRATIONS) {
      if (appliedSet.has(migration.version)) continue;
      
      console.log(`🔄 Applying migration ${migration.version}: ${migration.description}`);
      
      for (const sql of migration.sql) {
        try {
          await prisma.$executeRawUnsafe(sql);
        } catch (err: any) {
          // Ignore "duplicate column" errors if they happen (e.g. if partial migration happened manually)
          if (err.message?.includes('duplicate column') || err.message?.includes('already exists')) {
            console.log(`ℹ️ Skipping part of migration ${migration.version}: column/index already exists.`);
            continue;
          }
          throw err;
        }
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO _app_migrations (version) VALUES ('${migration.version}')`
      );
      console.log(`✅ Migration ${migration.version} applied successfully`);
    }

    console.log('✅ All migrations check completed.');
  } catch (error) {
    console.error('❌ Migration system failed:', error);
  }
}
