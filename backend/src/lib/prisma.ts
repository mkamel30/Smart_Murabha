import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const dbUrl = process.env.DATABASE_URL || '';
console.log(`[Prisma] Initializing with DATABASE_URL: ${dbUrl}`);
console.log(`[Prisma] NODE_ENV: ${process.env.NODE_ENV}`);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn'],
});

// Enable WAL mode for SQLite + verify connection works
if (prisma) {
  prisma.$connect()
    .then(async () => {
      console.log('[Prisma] ✅ Database connected successfully');
      console.log(`[Prisma] DATABASE_URL = ${process.env.DATABASE_URL}`);
      
      try {
        await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
        await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL;');
        console.log('[Prisma] ✅ SQLite WAL mode enabled');
      } catch (walErr) {
        console.error('[Prisma] ⚠️ Failed to enable WAL mode:', walErr);
      }
      
      // Quick sanity check: count tables
      try {
        const tables = await prisma.$queryRawUnsafe<any[]>(
          `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_prisma%' AND name NOT LIKE 'sqlite%' ORDER BY name;`
        );
        console.log(`[Prisma] ✅ Found ${tables.length} tables:`, tables.map((t: any) => t.name).join(', '));
      } catch (tableErr) {
        console.error('[Prisma] ⚠️ Could not list tables:', tableErr);
      }
    })
    .catch((err) => {
      console.error('[Prisma] ❌ CRITICAL: Failed to connect to database!');
      console.error('[Prisma] DATABASE_URL was:', process.env.DATABASE_URL);
      console.error('[Prisma] Error:', err);
    });
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;