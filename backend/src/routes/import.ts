import { Router, Request, Response } from 'express';
import multer from 'multer';
import prisma from '../lib/prisma.js';
import XLSX from 'xlsx';
import { addMonths } from '../utils/helpers.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function parseDate(dateStr: string | number): Date | null {
  if (!dateStr && dateStr !== 0) return null;
  try {
    // Handle Excel serial date number
    if (typeof dateStr === 'number') {
      // Excel serial: days since 1899-12-30
      const excelEpoch = new Date(1899, 11, 30);
      const days = dateStr;
      return new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
    }
    // Handle string like "DD-MM-YYYY" or "01-01-2024"
    const str = String(dateStr).trim();
    const parts = str.split(/[-/\.]/);
    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      if (year > 100 && year < 10000) {
        return new Date(year, month - 1, day);
      }
      // Maybe it's DD-MM-YY format
      const fullYear = year < 50 ? 2000 + year : 1900 + year;
      return new Date(fullYear, month - 1, day);
    }
    return new Date(str);
  } catch {
    return null;
  }
}

router.post('/excel', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

    if (data.length < 2) {
      res.status(400).json({ error: 'File is empty or has no data rows' });
      return;
    }

    const headers = (data[0] as string[]).map(h => String(h).trim());
    console.log('Raw Excel headers:', headers);

    const columnMap: Record<string, number> = {
      bkCode: headers.findIndex(h => h.includes('كود') || h.toLowerCase().includes('code')),
      customerType: headers.findIndex(h => h.includes('نوع') || h.toLowerCase().includes('type')),
      customerName: headers.findIndex(h => h.includes('اسم') || h.toLowerCase().includes('name')),
      machineSerial: headers.findIndex(h => h.includes('سيريال') || h.toLowerCase().includes('serial')),
      saleDate: headers.findIndex(h => h.includes('تاريخ البيع') || h.toLowerCase().includes('sale date')),
      totalPrice: headers.findIndex(h => h.includes('قيمة العقد') || h.includes('السعر') || (h.includes('إجمالي') && !h.includes('محصلة') && !h.includes('أقساط')) || h.toLowerCase().includes('total price')),
      paidAmount: headers.findIndex(h => h.includes('محصلة') || h.includes('ما تم دفعه') || h.includes('المدفوع') || h.toLowerCase().includes('paid')),
      monthlyInstallment: headers.findIndex(h => h.includes('القسط الشهري') || h.includes('قيمة القسط') || h.toLowerCase().includes('monthly')),
      downPayment: headers.findIndex(h => h.includes('مقدم') || h.toLowerCase().includes('down')),
      months: headers.findIndex(h => (h.includes('عدد') && (h.includes('قسط') || h.includes('أقساط'))) || h.toLowerCase().includes('months')),
      lastPaymentDate: headers.findIndex(h => h.includes('آخر دفعة') || h.includes('آخر سداد') || h.includes('تاريخ السداد') || h.includes('آخر تحصيل') || h.toLowerCase().includes('last payment')),
      notes: headers.findIndex(h => h.includes('ملاحظات') || h.toLowerCase().includes('notes')),
    };

    console.log('Import Headers detected:', columnMap);

    if (
      columnMap.bkCode === -1 || 
      columnMap.customerName === -1 ||
      columnMap.machineSerial === -1 ||
      columnMap.saleDate === -1 ||
      columnMap.totalPrice === -1 ||
      columnMap.paidAmount === -1 ||
      columnMap.downPayment === -1 ||
      columnMap.months === -1 ||
      columnMap.monthlyInstallment === -1
    ) {
      const missing = [];
      if (columnMap.bkCode === -1) missing.push('كود العميل');
      if (columnMap.customerName === -1) missing.push('اسم العميل');
      if (columnMap.machineSerial === -1) missing.push('السيريال');
      if (columnMap.saleDate === -1) missing.push('تاريخ البيع');
      if (columnMap.totalPrice === -1) missing.push('الإجمالي');
      if (columnMap.paidAmount === -1) missing.push('إجمالي الأقساط المحصلة');
      if (columnMap.downPayment === -1) missing.push('المقدم');
      if (columnMap.months === -1) missing.push('عدد الأقساط');
      if (columnMap.monthlyInstallment === -1) missing.push('قسط');

      console.error('Missing mandatory columns:', missing);
      res.status(400).json({ error: `الملف ينقصه أعمدة إجبارية: ${missing.join('، ')}` });
      return;
    }

    const results = {
      customersCreated: 0,
      customersFound: 0,
      salesCreated: 0,
      installmentsCreated: 0,
      errors: [] as string[]
    };

    for (let i = 1; i < data.length; i++) {
      const row = data[i] as (string | number)[];
      if (!row[columnMap.bkCode] && !row[columnMap.customerName]) continue;

      const bkCode = String(row[columnMap.bkCode] || '').trim();
      const customerType = columnMap.customerType >= 0 ? String(row[columnMap.customerType] || 'عام').trim() : 'عام';
      const customerName = String(row[columnMap.customerName] || '').trim();
      const machineSerial = columnMap.machineSerial >= 0 ? String(row[columnMap.machineSerial] || '').trim() : '';
      const totalPrice = columnMap.totalPrice >= 0 ? Number(row[columnMap.totalPrice]) || 0 : 0;
      const paidAmount = columnMap.paidAmount >= 0 ? Number(row[columnMap.paidAmount]) || 0 : 0;
      const downPayment = columnMap.downPayment >= 0 ? Number(row[columnMap.downPayment]) || 0 : 0;
      const monthlyInstallment = columnMap.monthlyInstallment >= 0 ? Number(row[columnMap.monthlyInstallment]) || 0 : 0;
      const rowMonths = columnMap.months >= 0 ? Number(row[columnMap.months]) || 0 : 0;
      const lastPaymentDateStr = columnMap.lastPaymentDate >= 0 ? row[columnMap.lastPaymentDate] : '';
      const notes = columnMap.notes >= 0 ? String(row[columnMap.notes] || '') : '';

      const lastPaymentDate = parseDate(lastPaymentDateStr);
      const saleDate = columnMap.saleDate >= 0 ? parseDate(row[columnMap.saleDate]) : new Date();

      if (
        !bkCode || 
        !customerName || 
        !machineSerial || 
        row[columnMap.saleDate] === undefined || 
        row[columnMap.saleDate] === '' ||
        row[columnMap.totalPrice] === undefined || 
        row[columnMap.totalPrice] === '' ||
        row[columnMap.paidAmount] === undefined || 
        row[columnMap.paidAmount] === '' ||
        row[columnMap.downPayment] === undefined || 
        row[columnMap.downPayment] === '' ||
        row[columnMap.months] === undefined || 
        row[columnMap.months] === '' ||
        row[columnMap.monthlyInstallment] === undefined || 
        row[columnMap.monthlyInstallment] === ''
      ) {
        results.errors.push(`السطر ${i + 1}: يوجد حقول إجبارية فارغة`);
        continue;
      }

      try {
        let customer = await prisma.customer.findFirst({
          where: { bkCode, customerType }
        });
        
        if (!customer) {
          customer = await prisma.customer.create({
            data: { bkCode, customerType, name: customerName }
          });
          results.customersCreated++;
        } else {
          results.customersFound++;
        }

        const isCash = paidAmount >= totalPrice;
        const expectedDownPayment = downPayment;
        // Total paid is the sum of Down Payment AND Collected Installments from Excel
        const totalActualPaid = expectedDownPayment + paidAmount;
        const remainingAfterAllPaid = isCash ? 0 : totalPrice - totalActualPaid;
        
        let months = rowMonths;
        if (!isCash && months <= 0 && monthlyInstallment > 0) {
          const toInstall = totalPrice - expectedDownPayment;
          months = Math.round(toInstall / monthlyInstallment);
          if (months === 0 && toInstall > 0) months = 1;
        }

        const receiptNumber = `OLD-${Date.now()}-${i}`;

        const sale = await prisma.machineSale.create({
          data: {
            receiptNumber,
            customerId: customer.id,
            machineSerial: machineSerial || `M-${Date.now()}`,
            saleType: isCash ? 'CASH' : 'INSTALLMENT',
            totalPrice,
            downPayment: expectedDownPayment,
            paidAmount: totalActualPaid, // Sum of downPayment + collected installments
            remainingAmount: Math.max(0, remainingAfterAllPaid),
            paymentPlace: 'dhamen',
            notes: notes || 'مستورد من ملف قديم',
            saleDate: saleDate ? new Date(saleDate) : new Date(),
            firstDueDate: months > 0 && saleDate ? addMonths(new Date(saleDate), 2) : undefined,
            months,
            status: remainingAfterAllPaid <= 0.01 ? 'COMPLETED' : 'ACTIVE',
          }
        });

        results.salesCreated++;
 
        if (!isCash && months > 0) {
          const installments = [];
          const startDate = sale.firstDueDate ? new Date(sale.firstDueDate) : new Date();
          let currentDate = new Date(startDate);
          
          const toInstall = totalPrice - expectedDownPayment;
          const instAmount = monthlyInstallment > 0 ? monthlyInstallment : Math.round((toInstall / months) * 100) / 100;
          
          // extraCash is what's left for installments (which is the 'paidAmount' column from Excel)
          let extraCash = paidAmount;
          let remainingToDistribute = toInstall;
 
          for (let m = 1; m <= months; m++) {
            const fullAmount = m === months ? Math.round(remainingToDistribute * 100) / 100 : instAmount;
            const appliedExtra = Math.min(extraCash, fullAmount);
            const isFullyPaidByExtra = appliedExtra >= fullAmount - 0.01;
 
            installments.push({
              saleId: sale.id,
              installmentNo: m,
              dueDate: new Date(currentDate),
              amount: Math.round(fullAmount * 100) / 100,
              paidAmount: isFullyPaidByExtra ? fullAmount : appliedExtra,
              isPaid: isFullyPaidByExtra,
              isWaived: false,
              waiveReason: null,
              paidDate: isFullyPaidByExtra ? (lastPaymentDate || saleDate || new Date()) : null,
              receiptNumber: isFullyPaidByExtra ? receiptNumber : null,
            });
 
            remainingToDistribute -= fullAmount;
            extraCash -= appliedExtra;
            currentDate = addMonths(currentDate, 1);
          }

          await prisma.installment.createMany({ data: installments });
          results.installmentsCreated += installments.length;
        }

        if (totalActualPaid > 0) {
          if (isCash) {
            // For Cash sales, record as one full payment
            await prisma.payment.create({
              data: {
                receiptNumber: `PAY-${Date.now()}-${i}-CASH`,
                saleId: sale.id,
                paymentType: 'CASH_SALE',
                amount: totalActualPaid,
                paymentPlace: 'dhamen',
                notes: 'مستورد من ملف قديم (كاش)',
                paidAt: lastPaymentDate || saleDate || new Date(),
              }
            });
          } else {
            // 1. Record the Down Payment part if exists
            if (expectedDownPayment > 0) {
              await prisma.payment.create({
                data: {
                  receiptNumber: `PAY-${Date.now()}-${i}-DP`,
                  saleId: sale.id,
                  paymentType: 'DOWN_PAYMENT',
                  amount: expectedDownPayment,
                  paymentPlace: 'dhamen',
                  notes: 'مستورد من ملف قديم (مقدم)',
                  paidAt: saleDate || new Date(),
                }
              });
            }

            // 2. Record the Installment part if any (this is the 'paidAmount' column)
            if (paidAmount > 0) {
              await prisma.payment.create({
                data: {
                  receiptNumber: `PAY-${Date.now()}-${i}-INST`,
                  saleId: sale.id,
                  paymentType: 'INSTALLMENT',
                  amount: paidAmount,
                  paymentPlace: 'dhamen',
                  notes: 'مستورد من ملف قديم (رصيد أقساط)',
                  paidAt: lastPaymentDate || saleDate || new Date(),
                }
              });
            }
          }
        }

      } catch (err) {
        results.errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    res.json({
      success: true,
      message: 'تم استيراد البيانات بنجاح',
      results
    });

  } catch (error) {
    console.error('Excel import error:', error);
    res.status(500).json({ error: 'Failed to import Excel file' });
  }
});

router.get('/template', async (req: Request, res: Response) => {
  // Note: Use Excel date column (serial number) or string format DD-MM-YYYY
  const template = [
    ['كود العميل', 'نوع العميل', 'اسم العميل', 'السيريال', 'تاريخ البيع القديم', 'إجمالي قيمة العقد', 'إجمالي الأقساط المحصلة', 'المقدم', 'عدد الأقساط', 'قيمة القسط الشهري', 'تاريخ آخر دفعة', 'ملاحظات'],
    ['C001', 'مخبز', 'أحمد محمد', 'SN123456', '01-01-2024', '10000', '5000', '3000', '7', '1000', '15-03-2024', 'ملاحظة اختيارية'],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(template);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=template.xlsx');
  res.send(buffer);
});

export default router;