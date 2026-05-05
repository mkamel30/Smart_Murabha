import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  // @ts-ignore
  __internal: {
    engine: {
      connectionTimeout: 10000,
    },
  },
});

// Enable WAL mode for SQLite
if (prisma) {
  prisma.$connect()
    .then(async () => {
      // Use $queryRawUnsafe because PRAGMA journal_mode returns a result set
      await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
      await prisma.$queryRawUnsafe('PRAGMA synchronous=NORMAL;');
      console.log('SQLite WAL mode enabled.');
    })
    .catch((err) => console.error('Failed to enable WAL mode:', err));
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;