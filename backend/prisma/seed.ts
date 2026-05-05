import { PrismaClient } from '@prisma/client';
import { addMonths } from '../src/utils/helpers.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const customers = [
    { bkCode: 'BK001', name: 'أحمد محمد على', phone: '0123456789', address: 'القاهرة - مصر', notes: 'عميل جيد' },
    { bkCode: 'BK002', name: 'خالد محمود حسن', phone: '0111222333', address: 'الجيزة - مصر', notes: '' },
    { bkCode: 'BK003', name: 'علي يوسف إبراهيم', phone: '0100444555', address: 'الإسكندرية - مصر', notes: 'مستحق متابعة' },
    { bkCode: 'BK004', name: 'محمد عبد الله', phone: '0122555666', address: 'المنصورة - مصر', notes: '' },
    { bkCode: 'BK005', name: 'حسن أحمد محمد', phone: '0118777888', address: 'طنطا - مصر', notes: 'دفع منتظم' },
    { bkCode: 'BK006', name: 'عادل سمير', phone: '0102999333', address: 'القاهرة - مصر', notes: '' },
    { bkCode: 'BK007', name: 'كريم محمد', phone: '0115555666', address: 'الجيزة - مصر', notes: '' },
    { bkCode: 'BK008', name: 'سعيد أحمد', phone: '0123666777', address: 'الإسكندرية - مصر', notes: '' },
    { bkCode: 'BK009', name: 'وليد محمود', phone: '0101444555', address: 'المنوفية - مصر', notes: '' },
    { bkCode: 'BK010', name: 'إسلام علي', phone: '0112333444', address: 'كفر الشيخ - مصر', notes: '' },
  ];

  const createdCustomers = [];
  for (const customer of customers) {
    const created = await prisma.customer.create({ data: customer });
    createdCustomers.push(created);
    console.log(`Created customer: ${created.name}`);
  }

  const cashSale = await prisma.machineSale.create({
    data: {
      receiptNumber: 'SALE-20240101-001',
      customerId: createdCustomers[0].id,
      machineSerial: 'M20240001',
      saleType: 'CASH',
      totalPrice: 15000,
      downPayment: 15000,
      paidAmount: 15000,
      remainingAmount: 0,
      paymentPlace: 'المقر',
      notes: 'بيع نقدي',
      saleDate: new Date('2024-01-15'),
      status: 'COMPLETED',
    },
  });
  console.log(`Created cash sale for ${createdCustomers[0].name}`);

  await prisma.payment.create({
    data: {
      receiptNumber: 'PAY-20240115-001',
      saleId: cashSale.id,
      paymentType: 'CASH_SALE',
      amount: 15000,
      paymentPlace: 'المقر',
      paidAt: new Date('2024-01-15'),
    },
  });
  console.log('Created payment for cash sale');

  const installmentSale1 = await prisma.machineSale.create({
    data: {
      receiptNumber: 'SALE-20240201-001',
      customerId: createdCustomers[1].id,
      machineSerial: 'M20240002',
      saleType: 'INSTALLMENT',
      totalPrice: 24000,
      downPayment: 4000,
      paidAmount: 4000,
      remainingAmount: 20000,
      paymentPlace: 'المقر',
      notes: 'بيع بالأقساط - 12 شهر',
      saleDate: new Date('2024-02-01'),
      firstDueDate: addMonths(new Date('2024-02-01'), 2),
      months: 12,
      status: 'ACTIVE',
    },
  });
  console.log(`Created installment sale for ${createdCustomers[1].name}`);

  const instAmount1 = 20000 / 12;
  const installments1 = [];
  for (let i = 1; i <= 12; i++) {
    const inst = await prisma.installment.create({
      data: {
        saleId: installmentSale1.id,
        installmentNo: i,
        dueDate: addMonths(new Date('2024-04-01'), i - 1),
        amount: instAmount1,
        paidAmount: 0,
        isPaid: false,
      },
    });
    installments1.push(inst);
  }
  console.log(`Created 12 installments for ${createdCustomers[1].name}`);

  await prisma.payment.create({
    data: {
      receiptNumber: 'PAY-20240201-001',
      saleId: installmentSale1.id,
      paymentType: 'DOWN_PAYMENT',
      amount: 4000,
      paymentPlace: 'المقر',
      paidAt: new Date('2024-02-01'),
    },
  });
  console.log('Created down payment');

  const paidInst = await prisma.installment.update({
    where: { id: installments1[0].id },
    data: {
      paidAmount: instAmount1,
      isPaid: true,
      paidDate: new Date('2024-04-15'),
      receiptNumber: 'PAY-20240415-001',
    },
  });

  await prisma.payment.create({
    data: {
      receiptNumber: 'PAY-20240415-001',
      saleId: installmentSale1.id,
      paymentType: 'INSTALLMENT',
      amount: instAmount1,
      paymentPlace: 'المقر',
      paidAt: new Date('2024-04-15'),
    },
  });

  await prisma.machineSale.update({
    where: { id: installmentSale1.id },
    data: { paidAmount: 4000 + instAmount1, remainingAmount: 20000 - instAmount1 },
  });
  console.log('First installment paid');

  const installmentSale2 = await prisma.machineSale.create({
    data: {
      receiptNumber: 'SALE-20240301-001',
      customerId: createdCustomers[2].id,
      machineSerial: 'M20240003',
      saleType: 'INSTALLMENT',
      totalPrice: 36000,
      downPayment: 6000,
      paidAmount: 6000,
      remainingAmount: 30000,
      paymentPlace: 'فرع الهرم',
      notes: 'بيع بالأقساط - 10 أشهر',
      saleDate: new Date('2024-03-01'),
      firstDueDate: addMonths(new Date('2024-03-01'), 2),
      months: 10,
      status: 'ACTIVE',
    },
  });
  console.log(`Created installment sale for ${createdCustomers[2].name}`);

  const instAmount2 = 30000 / 10;
  for (let i = 1; i <= 10; i++) {
    await prisma.installment.create({
      data: {
        saleId: installmentSale2.id,
        installmentNo: i,
        dueDate: addMonths(new Date('2024-05-01'), i - 1),
        amount: instAmount2,
        paidAmount: 0,
        isPaid: false,
      },
    });
  }
  console.log(`Created 10 installments for ${createdCustomers[2].name}`);

  const overdueInst = await prisma.installment.findMany({
    where: { saleId: installmentSale2.id, isPaid: false },
    orderBy: { dueDate: 'asc' },
  });
  const oldDate = new Date();
  oldDate.setMonth(oldDate.getMonth() - 2);
  await prisma.installment.update({
    where: { id: overdueInst[0].id },
    data: { dueDate: oldDate },
  });
  console.log('Made first installment overdue');

  const installmentSale3 = await prisma.machineSale.create({
    data: {
      receiptNumber: 'SALE-20240401-001',
      customerId: createdCustomers[3].id,
      machineSerial: 'M20240004',
      saleType: 'INSTALLMENT',
      totalPrice: 18000,
      downPayment: 3000,
      paidAmount: 3000,
      remainingAmount: 15000,
      paymentPlace: 'المقر',
      notes: 'بيع بالأقساط - 6 أشهر',
      saleDate: new Date('2024-04-01'),
      firstDueDate: addMonths(new Date('2024-04-01'), 2),
      months: 6,
      status: 'ACTIVE',
    },
  });
  console.log(`Created installment sale for ${createdCustomers[3].name}`);

  const instAmount3 = 15000 / 6;
  for (let i = 1; i <= 6; i++) {
    await prisma.installment.create({
      data: {
        saleId: installmentSale3.id,
        installmentNo: i,
        dueDate: addMonths(new Date('2024-06-01'), i - 1),
        amount: instAmount3,
        paidAmount: 0,
        isPaid: false,
      },
    });
  }
  console.log(`Created 6 installments for ${createdCustomers[3].name}`);

  await prisma.machineSale.create({
    data: {
      receiptNumber: 'SALE-20240415-001',
      customerId: createdCustomers[4].id,
      machineSerial: 'M20240005',
      saleType: 'CASH',
      totalPrice: 20000,
      downPayment: 20000,
      paidAmount: 20000,
      remainingAmount: 0,
      paymentPlace: 'المقر',
      notes: 'بيع نقدي',
      saleDate: new Date('2024-04-15'),
      status: 'COMPLETED',
    },
  });
  console.log(`Created cash sale for ${createdCustomers[4].name}`);

  await prisma.followUp.create({
    data: {
      customerId: createdCustomers[2].id,
      note: 'متابعة بشأن التأخر في السداد',
      nextFollowUp: new Date(),
      isCompleted: false,
    },
  });
  console.log('Created follow-up for overdue customer');

  await prisma.followUp.create({
    data: {
      customerId: createdCustomers[1].id,
      note: 'متابعة موعد القسط القادم',
      nextFollowUp: addMonths(new Date(), 1),
      isCompleted: false,
    },
  });
  console.log('Created upcoming follow-up');

  await prisma.followUp.create({
    data: {
      customerId: createdCustomers[3].id,
      note: 'أول زيارة للعملاء الجدد',
      nextFollowUp: null,
      isCompleted: true,
      completedAt: new Date(),
    },
  });
  console.log('Created completed follow-up');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });