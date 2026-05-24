import { Router, Request, Response, NextFunction } from 'express';
import { InstallmentRepository } from '../repositories/index.js';
import { SaleService } from '../services/saleService.js';
import prisma from '../lib/prisma.js';
import multer from 'multer';
import XLSX from 'xlsx';
import { isValid } from 'date-fns';

const router = Router();
const installmentRepo = new InstallmentRepository();
const saleService = new SaleService();
const upload = multer({ storage: multer.memoryStorage() });

function parseDate(dateStr: string | number | null | undefined): Date | null {
  if (dateStr === null || dateStr === undefined || dateStr === '') return null;
  try {
    // Handle Excel serial date number
    if (typeof dateStr === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000);
      if (isValid(date) && date.getFullYear() > 2000 && date.getFullYear() < 2050) return date;
      return null;
    }
    
    const str = String(dateStr).trim();
    if (!str) return null;
    const parts = str.split(/[-/\.]/);
    
    if (parts.length === 3) {
      let p1 = Number(parts[0]);
      let p2 = Number(parts[1]);
      let p3 = Number(parts[2]);
      
      // Heuristics
      let day, month, year;
      if (p3 > 1000) {
        year = p3;
        if (p1 > 12) { day = p1; month = p2; }
        else if (p2 > 12) { day = p2; month = p1; }
        else { day = p1; month = p2; } // Default DD-MM-YYYY
      } else if (p1 > 1000) {
        year = p1;
        if (p2 > 12) { day = p2; month = p3; }
        else if (p3 > 12) { day = p3; month = p2; }
        else { day = p3; month = p2; } // Default YYYY-MM-DD
      } else {
        year = p3 < 50 ? 2000 + p3 : 1900 + p3;
        if (p1 > 12) { day = p1; month = p2; }
        else if (p2 > 12) { day = p2; month = p1; }
        else { day = p1; month = p2; }
      }
      
      const date = new Date(year, month - 1, day);
      if (isValid(date) && date.getFullYear() > 2000 && date.getFullYear() < 2050 && date.getMonth() === month - 1) {
        return date;
      }
    }
    
    const d = new Date(str);
    if (isValid(d) && d.getFullYear() > 2000 && d.getFullYear() < 2050) return d;
    return null;
  } catch {
    return null;
  }
}

router.get('/export-update', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const installments = await prisma.installment.findMany({
      where: {
        sale: {
          status: 'ACTIVE'
        }
      },
      include: {
        sale: {
          include: {
            customer: true
          }
        }
      },
      orderBy: [
        { sale: { customer: { name: 'asc' } } },
        { installmentNo: 'asc' }
      ]
    });

    const data = [
      [
        'معرف القسط (Installment ID)',
        'كود العميل',
        'اسم العميل',
        'سيريال الماكينة',
        'رقم القسط',
        'قيمة القسط',
        'المبلغ المدفوع',
        'هل تم الدفع؟ (نعم/لا)',
        'رقم إيصال التحصيل الفعلي',
        'تاريخ التحصيل الفعلي (YYYY-MM-DD)'
      ]
    ];

    for (const inst of installments) {
      data.push([
        inst.id,
        inst.sale.customer.bkCode,
        inst.sale.customer.name,
        inst.sale.machineSerial,
        `قسط ${inst.installmentNo}`,
        inst.amount.toString(),
        (inst.paidAmount || 0).toString(),
        inst.isPaid ? 'نعم' : 'لا',
        inst.receiptNumber || '',
        inst.paidDate ? new Date(inst.paidDate).toISOString().split('T')[0] : ''
      ]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'تحديث الأقساط');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=installments-update.xlsx');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.post('/import-update', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم رفع أي ملف' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];

    if (data.length < 2) {
      return res.status(400).json({ error: 'الملف فارغ أو لا يحتوي على صفوف بيانات' });
    }

    const headers = (data[0] as string[]).map(h => String(h || '').trim());
    
    const idIdx = headers.findIndex(h => h.includes('معرف القسط') || h.toLowerCase().includes('installment id'));
    const isPaidIdx = headers.findIndex(h => h.includes('هل تم الدفع') || h.toLowerCase().includes('paid?'));
    const receiptIdx = headers.findIndex(h => h.includes('رقم إيصال') || h.includes('رقم الإيصال') || h.toLowerCase().includes('receipt'));
    const dateIdx = headers.findIndex(h => h.includes('تاريخ التحصيل') || h.toLowerCase().includes('paid date') || h.toLowerCase().includes('paidat'));

    if (idIdx === -1 || isPaidIdx === -1 || receiptIdx === -1 || dateIdx === -1) {
      const missing = [];
      if (idIdx === -1) missing.push('معرف القسط (Installment ID)');
      if (isPaidIdx === -1) missing.push('هل تم الدفع؟ (نعم/لا)');
      if (receiptIdx === -1) missing.push('رقم إيصال التحصيل الفعلي');
      if (dateIdx === -1) missing.push('تاريخ التحصيل الفعلي');
      return res.status(400).json({ error: `الملف غير مطابق للنموذج المطلوب. الأعمدة المفقودة: ${missing.join('، ')}` });
    }

    const results = {
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    };

    await prisma.$transaction(async (tx) => {
      const uniqueSaleIds = new Set<string>();

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        const instId = String(row[idIdx] || '').trim();
        if (!instId) {
          results.skipped++;
          continue;
        }

        const installment = await tx.installment.findUnique({
          where: { id: instId },
          include: { sale: true }
        });

        if (!installment) {
          throw new Error(`السطر ${i + 1}: لم يتم العثور على القسط بالمعرف ${instId}`);
        }

        const isPaidStr = String(row[isPaidIdx] || '').trim();
        const isPaid = isPaidStr === 'نعم' || isPaidStr.toLowerCase() === 'yes' || isPaidStr.toLowerCase() === 'true';
        
        const receiptNumber = String(row[receiptIdx] || '').trim() || null;
        const rawDate = row[dateIdx];
        const paidDate = rawDate ? parseDate(rawDate as string | number) : null;

        const dbIsPaid = installment.isPaid;
        const dbReceiptNumber = installment.receiptNumber;
        const dbPaidDate = installment.paidDate;

        const hasPaidDateChanged = (paidDate && !dbPaidDate) || (!paidDate && dbPaidDate) || (paidDate && dbPaidDate && new Date(paidDate).getTime() !== new Date(dbPaidDate).getTime());
        const hasReceiptChanged = receiptNumber !== dbReceiptNumber;
        const hasPaidStatusChanged = isPaid !== dbIsPaid;

        if (!hasPaidStatusChanged && !hasReceiptChanged && !hasPaidDateChanged) {
          results.skipped++;
          continue;
        }

        uniqueSaleIds.add(installment.saleId);

        if (dbIsPaid && !isPaid) {
          await tx.installment.update({
            where: { id: instId },
            data: {
              isPaid: false,
              paidAmount: 0,
              receiptNumber: null,
              paidDate: null,
              paymentId: null
            }
          });

          if (installment.paymentId) {
            const paymentId = installment.paymentId;
            const sharedCount = await tx.installment.count({
              where: { paymentId }
            });

            if (sharedCount > 1) {
              await tx.payment.update({
                where: { id: paymentId },
                data: {
                  amount: { decrement: installment.amount }
                }
              });
            } else {
              await tx.payment.delete({
                where: { id: paymentId }
              });
            }
          }
        }
        else if (isPaid) {
          const finalPaidDate = paidDate || installment.paidDate || new Date();
          const finalReceipt = receiptNumber || installment.receiptNumber || 'بدون إيصال';

          if (finalReceipt && finalReceipt !== 'بدون إيصال' && finalReceipt !== installment.receiptNumber) {
            const existingPayment = await tx.payment.findFirst({
              where: {
                receiptNumber: finalReceipt,
                saleId: { not: installment.saleId }
              },
              include: {
                sale: {
                  include: {
                    customer: true
                  }
                }
              }
            });

            if (existingPayment && existingPayment.sale) {
              const customerName = existingPayment.sale.customer.name;
              const customerCode = existingPayment.sale.customer.bkCode;
              const machine = existingPayment.sale.machineSerial;
              throw new Error(`السطر ${i + 1}: رقم الإيصال "${finalReceipt}" مستخدم بالفعل للعميل "${customerName}" (${customerCode}) ماكينة: ${machine}`);
            }
          }

          let paymentId = installment.paymentId;

          if (paymentId) {
            const sharedCount = await tx.installment.count({
              where: { paymentId }
            });

            if (sharedCount > 1) {
              const isPaymentUnchanged = finalReceipt === installment.receiptNumber && 
                (installment.paidDate ? new Date(installment.paidDate).getTime() : 0) === finalPaidDate.getTime();
              
              if (!isPaymentUnchanged) {
                await tx.payment.update({
                  where: { id: paymentId },
                  data: {
                    amount: { decrement: installment.amount }
                  }
                });

                const newPayment = await tx.payment.create({
                  data: {
                    saleId: installment.saleId,
                    amount: installment.amount,
                    paymentType: 'INSTALLMENT',
                    paymentPlace: 'dhamen',
                    receiptNumber: finalReceipt,
                    paidAt: finalPaidDate,
                    notes: 'تم إنشاؤه تلقائياً وتعديله عبر تحديث ملف الأقساط'
                  }
                });
                paymentId = newPayment.id;
              }
            } else {
              await tx.payment.update({
                where: { id: paymentId },
                data: {
                  receiptNumber: finalReceipt,
                  paidAt: finalPaidDate,
                  amount: installment.amount
                }
              });
            }
          } else {
            const newPayment = await tx.payment.create({
              data: {
                saleId: installment.saleId,
                amount: installment.amount,
                paymentType: 'INSTALLMENT',
                paymentPlace: 'dhamen',
                receiptNumber: finalReceipt,
                paidAt: finalPaidDate,
                notes: 'تم إنشاؤه تلقائياً عند تحديث الأقساط عبر ملف'
              }
            });
            paymentId = newPayment.id;
          }

          await tx.installment.update({
            where: { id: instId },
            data: {
              isPaid: true,
              paidAmount: installment.amount,
              receiptNumber: finalReceipt,
              paidDate: finalPaidDate,
              paymentId
            }
          });
        }

        results.updated++;
      }

      for (const saleId of uniqueSaleIds) {
        const allPayments = await tx.payment.findMany({
          where: { saleId }
        });

        const totalPaid = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);

        const sale = await tx.machineSale.findUnique({
          where: { id: saleId }
        });

        if (!sale) continue;

        const remaining = Math.max(0, Number(sale.totalPrice) - totalPaid);

        const dpPayment = allPayments.find(p => p.paymentType === 'DOWN_PAYMENT' || p.paymentType === 'CASH_SALE');
        const downPaymentReceipt = dpPayment ? dpPayment.receiptNumber : sale.downPaymentReceipt;

        await tx.machineSale.update({
          where: { id: saleId },
          data: {
            paidAmount: totalPaid,
            remainingAmount: remaining,
            status: remaining <= 0.01 ? 'COMPLETED' : 'ACTIVE',
            downPaymentReceipt
          }
        });
      }
    });

    res.json({
      success: true,
      message: `تم تحديث الأقساط بنجاح! تم تعديل ${results.updated} قسط، وتخطي ${results.skipped} قسط دون تغيير.`,
      results
    });

  } catch (error) {
    console.error('Import update error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'فشلت عملية تحديث البيانات من الملف' });
  }
});


router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { saleId, isPaid, startDate, endDate } = req.query;
    const installments = await installmentRepo.findAll({
      saleId: saleId as string | undefined,
      isPaid: isPaid === 'true' ? true : isPaid === 'false' ? false : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
    });
    res.json(installments);
  } catch (error) {
    next(error);
  }
});

router.get('/overdue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const overdue = await installmentRepo.findOverdue();
    res.json(overdue);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const installment = await installmentRepo.findById(req.params.id as string);
    if (!installment) {
      return res.status(404).json({ error: 'القسط غير موجود' });
    }
    res.json(installment);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { receiptNumber, paidDate, isPaid, paidAmount, paymentPlace } = req.body;
    
    // Fetch old installment first
    const oldInstallment = await prisma.installment.findUnique({
      where: { id: req.params.id as string }
    });
    if (!oldInstallment) {
      return res.status(404).json({ error: 'القسط غير موجود' });
    }

    // Check if new receiptNumber is already used in a different sale
    if (receiptNumber && receiptNumber !== oldInstallment.receiptNumber) {
      const existingPayment = await prisma.payment.findFirst({
        where: { 
          receiptNumber: receiptNumber,
          saleId: { not: oldInstallment.saleId }
        },
        include: {
          sale: {
            include: {
              customer: true
            }
          }
        }
      });

      if (existingPayment && existingPayment.sale) {
        const customer = existingPayment.sale.customer;
        const machineSerial = existingPayment.sale.machineSerial;
        return res.status(400).json({ 
          error: `رقم الإيصال هذا تم استخدامه مسبقاً مع العميل: ${customer.name} (كود: ${customer.bkCode}) للماكينة رقم: ${machineSerial}` 
        });
      }
    }

    const updatedInstallment = await prisma.$transaction(async (tx) => {
      // Find linked Payment (by paymentId first, then by receiptNumber fallback)
      let payment = null;
      if (oldInstallment.paymentId) {
        payment = await tx.payment.findUnique({ where: { id: oldInstallment.paymentId } });
      }
      if (!payment && oldInstallment.receiptNumber) {
        payment = await tx.payment.findFirst({
          where: {
            saleId: oldInstallment.saleId,
            receiptNumber: oldInstallment.receiptNumber
          }
        });
      }

      // Check if this payment is shared (bulk)
      let isBulkPayment = false;
      if (payment) {
        const linkedCount = await tx.installment.count({
          where: { paymentId: payment.id }
        });
        isBulkPayment = linkedCount > 1;
      }

      const hasReceiptOrDateChange = 
        (receiptNumber !== undefined && receiptNumber !== oldInstallment.receiptNumber) ||
        (paidDate !== undefined && (
          !oldInstallment.paidDate || 
          new Date(paidDate).getTime() !== new Date(oldInstallment.paidDate).getTime()
        ));

      // CASE A: It is a bulk payment and the user is changing the receipt or date of this single installment (Splitting!)
      if (payment && isBulkPayment && hasReceiptOrDateChange) {
        const amountToDeduct = Number(oldInstallment.paidAmount || oldInstallment.amount);
        
        // 1. Deduct from bulk payment
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            amount: { decrement: amountToDeduct }
          }
        });

        // 2. Create a brand new separate Payment record for this installment
        const finalReceiptNumber = receiptNumber !== undefined ? receiptNumber : (oldInstallment.receiptNumber || 'بدون إيصال');
        const finalPaidDate = paidDate ? new Date(paidDate) : (oldInstallment.paidDate || new Date());
        const finalPaymentPlace = paymentPlace !== undefined ? paymentPlace : (payment.paymentPlace || 'dhamen');

        const newPayment = await tx.payment.create({
          data: {
            saleId: oldInstallment.saleId,
            amount: amountToDeduct,
            paymentType: 'INSTALLMENT',
            paymentPlace: finalPaymentPlace,
            receiptNumber: finalReceiptNumber,
            paidAt: finalPaidDate,
            notes: 'تم فصله من دفعة مجمعة وتعديله تلقائياً'
          }
        });

        // 3. Update the target installment and link it to the new payment
        const inst = await tx.installment.update({
          where: { id: req.params.id as string },
          data: {
            receiptNumber: finalReceiptNumber,
            paidDate: finalPaidDate,
            isPaid: isPaid !== undefined ? isPaid : undefined,
            paidAmount: paidAmount !== undefined ? paidAmount : undefined,
            paymentId: newPayment.id
          }
        });

        return inst;
      }

      // CASE B: Standard update (Not bulk or no receipt/date changes)
      // 1. Update target installment
      const inst = await tx.installment.update({
        where: { id: req.params.id as string },
        data: {
          receiptNumber: receiptNumber !== undefined ? receiptNumber : undefined,
          paidDate: paidDate ? new Date(paidDate) : (paidDate === null ? null : undefined),
          isPaid: isPaid !== undefined ? isPaid : undefined,
          paidAmount: paidAmount !== undefined ? paidAmount : undefined,
        }
      });

      // If no linked payment exists but the installment is paid, automatically create a Payment record
      if (!payment && inst.isPaid) {
        const paymentDate = paidDate ? new Date(paidDate) : (oldInstallment.paidDate || new Date());
        const paymentAmount = paidAmount !== undefined ? Number(paidAmount) : Number(inst.paidAmount || inst.amount);
        const finalReceiptNumber = receiptNumber !== undefined ? receiptNumber : (inst.receiptNumber || 'بدون إيصال');
        const finalPaymentPlace = paymentPlace !== undefined ? paymentPlace : 'dhamen';

        payment = await tx.payment.create({
          data: {
            saleId: oldInstallment.saleId,
            amount: paymentAmount,
            paymentType: 'INSTALLMENT',
            paymentPlace: finalPaymentPlace,
            receiptNumber: finalReceiptNumber,
            paidAt: paymentDate,
            notes: 'تم إنشاؤه تلقائياً عند تحديث القسط'
          }
        });

        // Link the current installment to the new payment
        await tx.installment.update({
          where: { id: req.params.id as string },
          data: { paymentId: payment.id } as any
        });
      }

      if (payment) {
        const newReceiptNumber = receiptNumber !== undefined ? receiptNumber : oldInstallment.receiptNumber;
        const newPaidDate = paidDate ? new Date(paidDate) : oldInstallment.paidDate;
        const newPaymentPlace = paymentPlace !== undefined ? paymentPlace : payment.paymentPlace;

        await tx.payment.update({
          where: { id: payment.id },
          data: {
            receiptNumber: newReceiptNumber || payment.receiptNumber,
            paidAt: newPaidDate ? new Date(newPaidDate) : undefined,
            paymentPlace: newPaymentPlace
          }
        });

        // Save the link if not already saved
        if (!oldInstallment.paymentId) {
          await tx.installment.update({
            where: { id: req.params.id as string },
            data: { paymentId: payment.id } as any
          });
        }

        // Update any OTHER installments of this sale sharing this payment (since it's not being split)
        if (receiptNumber !== undefined || paidDate !== undefined) {
          await tx.installment.updateMany({
            where: {
              saleId: oldInstallment.saleId,
              paymentId: payment.id,
              id: { not: req.params.id as string }
            } as any,
            data: {
              receiptNumber: newReceiptNumber,
              paidDate: newPaidDate
            }
          });
        }
      }

      return inst;
    });

    res.json(updatedInstallment);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/pay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const installment = await installmentRepo.findById(req.params.id as string);
    if (!installment) {
      return res.status(404).json({ error: 'القسط غير موجود' });
    }
    const data = req.body;
    const result = await saleService.pay(
      installment.saleId,
      data.amount,
      'INSTALLMENT',
      data.paymentPlace,
      data.notes,
      [installment.id],
      data.receiptNumber
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;