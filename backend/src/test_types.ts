import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  const customer = await prisma.customer.findFirst();
  if (customer) {
    console.log(customer.customerType);
  }
}
