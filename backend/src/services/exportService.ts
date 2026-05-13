import ExcelJS from 'exceljs';
import prisma from '../lib/prisma.js';
import { formatCurrency, formatDate } from '../utils/helpers.js';
import type { Response } from 'express';
import type { Prisma } from '@prisma/client';

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getReportStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Tahoma, sans-serif; font-size: 10pt; line-height: 1.4; background: #fff; }
    .sheet { margin: 0 auto; width: 210mm; height: 297mm; padding: 10mm; position: relative; overflow: hidden; }
    @media print { .sheet { width: 100%; margin: 0; padding: 10mm; height: 100vh; } @page { margin: 0; size: A4; } }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0d5d56; padding-bottom: 6px; margin-bottom: 12px; }
    .header-center { text-align: center; flex: 1; }
    .header-center h1 { font-size: 14pt; color: #0d5d56; margin-bottom: 2px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .info-box { border: 1px solid #ddd; padding: 8px; border-radius: 4px; }
    .info-title { font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 6px; color: #0d5d56; font-size: 10pt; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .info-row span:first-child { color: #666; }
    .table-container { margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th, td { border: 1px solid #ddd; padding: 4px 6px; text-align: center; }
    th { background: #f0fdf4; color: #0d5d56; }
    .totals-box { width: 45%; margin-right: auto; border: 1px solid #ddd; padding: 8px; background: #f9fafb; border-radius: 4px; }
    .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .total-row.final { font-weight: bold; font-size: 11pt; border-top: 2px solid #0d5d56; padding-top: 6px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 20px; }
    .sig-box { width: 45%; text-align: center; }
    .sig-line { border-top: 1px solid #000; margin-top: 30px; width: 80%; margin-left: auto; margin-right: auto; }
    .status-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 8pt; }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-unpaid { background: #fee2e2; color: #991b1b; }
    .declaration { font-size: 9pt; padding: 8px; background: #fafafa; border: 1px solid #ddd; line-height: 1.6; text-align: justify; margin-bottom: 12px; }
    .footer-note { font-size: 8pt; color: #666; text-align: center; margin-top: 10px; }
  `;
}

function getReportScripts(filename: string): string {
  return `
    <script>
      function printReport() {
        window.print();
      }
      function downloadPDF() {
        printReport();
      }
      window.onload = function() {
        setTimeout(printReport, 500);
      };
    </script>
  `;
}

function getSidebar(): string {
  return '';
}

function getContractHeader(): string {
  return `
    <div class="contract-header">
      <img src="/logo.png" alt="Logo" class="logo" />
    </div>
  `;
}

export class ExportService {
  async exportSales(startDate?: Date, endDate?: Date) {
    const where: Prisma.MachineSaleWhereInput = { status: { not: 'VOIDED' } };
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = startDate;
      if (endDate) where.saleDate.lte = endDate;
    }

    const sales = await prisma.machineSale.findMany({
      where,
      include: { customer: true },
      orderBy: { saleDate: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('المبيعات');

    worksheet.columns = [
      { header: 'رقم الإيصال', key: 'receiptNumber', width: 20 },
      { header: 'كود العميل', key: 'bkCode', width: 15 },
      { header: 'نوع العميل', key: 'customerType', width: 15 },
      { header: 'اسم العميل', key: 'customerName', width: 25 },
      { header: 'رقم الماكينة', key: 'machineSerial', width: 20 },
      { header: 'نظام التقسيط', key: 'months', width: 12 },
      { header: 'نوع البيع', key: 'saleType', width: 15 },
      { header: 'سعر المبيعات', key: 'totalPrice', width: 15 },
      { header: 'الدفعة المقدمة', key: 'downPayment', width: 15 },
      { header: 'المدفوع', key: 'paidAmount', width: 15 },
      { header: 'المتبقي', key: 'remainingAmount', width: 15 },
      { header: 'تاريخ البيع', key: 'saleDate', width: 15 },
      { header: 'الحالة', key: 'status', width: 12 },
    ];

    for (const sale of sales) {
      worksheet.addRow({
        receiptNumber: sale.receiptNumber,
        bkCode: sale.customer.bkCode,
        customerType: sale.customer.customerType,
        customerName: sale.customer.name,
        machineSerial: sale.machineSerial,
        months: sale.saleType === 'INSTALLMENT' ? `${sale.months} شهر` : 'كاش',
        saleType: sale.saleType === 'CASH' ? 'دفعة كاملة' : 'أقساط',
        totalPrice: sale.totalPrice,
        downPayment: sale.downPayment,
        paidAmount: sale.paidAmount,
        remainingAmount: sale.remainingAmount,
        saleDate: formatDate(sale.saleDate),
        status: sale.status === 'ACTIVE' ? 'نشط' : sale.status === 'COMPLETED' ? 'مكتمل' : 'ملغى',
      });
    }

    return workbook;
  }

  async exportCollections(startDate?: Date, endDate?: Date) {
    const where: Prisma.PaymentWhereInput = {};
    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) where.paidAt.gte = startDate;
      if (endDate) where.paidAt.lte = endDate;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: { sale: { include: { customer: true } } },
      orderBy: { paidAt: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('التحصيلات');

    worksheet.columns = [
      { header: 'رقم الإيصال', key: 'receiptNumber', width: 20 },
      { header: 'اسم العميل', key: 'customerName', width: 25 },
      { header: 'كود العميل', key: 'bkCode', width: 15 },
      { header: 'نوع العميل', key: 'customerType', width: 15 },
      { header: 'رقم الماكينة', key: 'machineSerial', width: 20 },
      { header: 'نظام التقسيط', key: 'months', width: 12 },
      { header: 'نوع الدفع', key: 'paymentType', width: 15 },
      { header: 'المبلغ', key: 'amount', width: 15 },
      { header: 'مكان الدفع', key: 'paymentPlace', width: 15 },
      { header: 'التاريخ', key: 'paidAt', width: 15 },
      { header: 'ملاحظات', key: 'notes', width: 20 },
    ];

    for (const payment of payments) {
      worksheet.addRow({
        receiptNumber: payment.receiptNumber,
        customerName: payment.sale.customer.name,
        bkCode: payment.sale.customer.bkCode,
        customerType: payment.sale.customer.customerType,
        machineSerial: payment.sale.machineSerial,
        months: payment.sale.saleType === 'INSTALLMENT' ? `${payment.sale.months} شهر` : 'كاش',
        paymentType: payment.paymentType === 'CASH_SALE' ? 'دفعة كاملة' : payment.paymentType === 'DOWN_PAYMENT' ? 'دفعة مقدمة' : 'قسط',
        amount: payment.amount,
        paymentPlace: getPaymentPlaceLabel(payment.paymentPlace),
        paidAt: formatDate(payment.paidAt),
        notes: payment.notes || '',
      });
    }

    return workbook;
  }

  async exportOverdue(startDate?: Date, endDate?: Date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: Prisma.InstallmentWhereInput = {
      isPaid: false,
      sale: { status: 'ACTIVE' },
    };

    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = startDate;
      if (endDate) where.dueDate.lte = endDate;
    } else {
      // Default behavior: show everything up to today
      where.dueDate = { lt: today };
    }

    const overdue = await prisma.installment.findMany({
      where,
      include: {
        sale: { include: { customer: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('المتأخرات');

    worksheet.columns = [
      { header: 'اسم العميل', key: 'customerName', width: 25 },
      { header: 'كود العميل', key: 'bkCode', width: 15 },
      { header: 'نوع العميل', key: 'customerType', width: 15 },
      { header: 'رقم الماكينة', key: 'machineSerial', width: 20 },
      { header: 'نظام التقسيط', key: 'months', width: 12 },
      { header: 'رقم القسط', key: 'installmentNo', width: 12 },
      { header: 'تاريخ الاستحقاق', key: 'dueDate', width: 15 },
      { header: 'المبلغ', key: 'amount', width: 15 },
      { header: 'المدفوع', key: 'paidAmount', width: 15 },
      { header: 'المتبقي', key: 'remaining', width: 15 },
      { header: 'رقم العقد', key: 'receiptNumber', width: 20 },
    ];

    for (const inst of overdue) {
      worksheet.addRow({
        customerName: inst.sale.customer.name,
        bkCode: inst.sale.customer.bkCode,
        customerType: inst.sale.customer.customerType,
        machineSerial: inst.sale.machineSerial,
        months: `${inst.sale.months} شهر`,
        installmentNo: inst.installmentNo,
        dueDate: formatDate(inst.dueDate),
        amount: inst.amount,
        paidAmount: inst.paidAmount,
        remaining: Number(inst.amount) - Number(inst.paidAmount),
        receiptNumber: inst.sale.receiptNumber,
      });
    }

    return workbook;
  }

  generateReceiptHtml(payment: any): string {
    const sale = payment.sale;
    const customer = sale.customer;
    const dateStr = formatDate(payment.paidAt);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>إيصال دفع - ${payment.receiptNumber}</title>
  <style>${getReportStyles()}</style>
</head>
<body>
  ${getSidebar()}
  <div class="sheet">
    <div class="header">
      <div class="date">التاريخ: ${dateStr}</div>
      <div class="header-center">
        <h1>إيصال دفع</h1>
      </div>
      <div></div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <div class="info-title">بيانات العميل</div>
        <div class="info-row"><span>الاسم:</span> <strong>${escapeHtml(customer.name)}</strong></div>
        <div class="info-row"><span>كود العميل:</span> <strong>${escapeHtml(customer.bkCode)}</strong></div>
        <div class="info-row"><span>نوع العميل:</span> <strong>${escapeHtml(customer.customerType)}</strong></div>
        ${customer.phone ? `<div class="info-row"><span>الهاتف:</span> <strong>${escapeHtml(customer.phone)}</strong></div>` : ''}
        ${customer.address ? `<div class="info-row"><span>العنوان:</span> <strong>${escapeHtml(customer.address)}</strong></div>` : ''}
      </div>
      <div class="info-box">
        <div class="info-title">بيانات البيع</div>
        <div class="info-row"><span>رقم العقد:</span> <strong>${sale.receiptNumber}</strong></div>
        <div class="info-row"><span>رقم الماكينة:</span> <strong style="font-family:monospace;">${escapeHtml(sale.machineSerial)}</strong></div>
        <div class="info-row"><span>نوع البيع:</span> <strong>${sale.saleType === 'CASH' ? 'دفعة كاملة' : 'أقساط'}</strong></div>
        <div class="info-row"><span>إجمالي السعر:</span> <strong>${formatCurrency(sale.totalPrice)}</strong></div>
      </div>
    </div>

    <div class="table-container">
      <div class="info-title">تفاصيل الدفع</div>
      <table>
        <thead>
          <tr>
            <th>رقم الإيصال</th>
            <th>المبلغ</th>
            <th>نوع الدفع</th>
            <th>مكان الدفع</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>${payment.receiptNumber}</strong></td>
            <td><strong style="color: #0d5d56; font-size: 12pt;">${formatCurrency(payment.amount)}</strong></td>
            <td>${payment.paymentType === 'CASH_SALE' ? 'دفعة كاملة' : payment.paymentType === 'DOWN_PAYMENT' ? 'دفعة مقدمة' : 'قسط'}</td>
            <td>${getPaymentPlaceLabel(payment.paymentPlace)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="totals-box">
      <div class="total-row">
        <span>إجمالي المبيعات:</span>
        <span>${formatCurrency(sale.totalPrice)}</span>
      </div>
      <div class="total-row">
        <span>المدفوع سابقاً:</span>
        <span>${formatCurrency(Number(sale.paidAmount) - Number(payment.amount))}</span>
      </div>
      <div class="total-row">
        <span>المدفوع الآن:</span>
        <span>${formatCurrency(payment.amount)}</span>
      </div>
      <div class="total-row final">
        <span>المتبقي:</span>
        <span>${formatCurrency(sale.remainingAmount)}</span>
      </div>
    </div>

    ${payment.notes ? `<div class="declaration"><strong>ملاحظات:</strong> ${escapeHtml(payment.notes)}</div>` : ''}

    <div class="signatures">
      <div class="sig-box">
        <div><strong>ممثل خدمة العملاء</strong></div>
        <div class="sig-line">التوقيع</div>
      </div>
      <div class="sig-box">
        <div><strong>توقيع العميل</strong></div>
        <div class="sig-line">التوقيع</div>
      </div>
    </div>

    <div class="footer-note">شكراً لتعاملكم معنا</div>
  </div>
  ${getReportScripts(`receipt-${payment.receiptNumber}`)}
</body>
</html>`;
  }

  generateContractHtml(sale: any): string {
    const customer = sale.customer;
    const installments = sale.installments || [];
    const dateStr = formatDate(sale.saleDate);

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>عقد بيع - ${sale.receiptNumber}</title>
  <style>
    @page { margin: 0; size: A4; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Tahoma, sans-serif; font-size: 9pt; line-height: 1.35; background: #fff; }
    .contract-page {
      width: 210mm;
      height: 297mm;
      margin: 0 auto;
      padding: 8mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    @media print { .contract-page { width: 100%; height: 100vh; padding: 8mm; } }
    .contract-header {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      margin-bottom: 4px;
      padding-bottom: 4px;
      border-bottom: 2px solid #0A2472;
    }
    .logo { width: 80px; height: auto; }
    .contract-title {
      text-align: center;
      font-size: 12pt;
      font-weight: bold;
      color: #0A2472;
      margin-bottom: 6px;
      padding: 4px;
      background: #f0f4f8;
      border-radius: 4px;
    }
    .section { margin-bottom: 4px; }
    .section-title {
      font-size: 9.5pt;
      font-weight: bold;
      color: #0A2472;
      margin-bottom: 2px;
      padding-bottom: 2px;
      border-bottom: 1px solid #ddd;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
      border-bottom: 1px dotted #eee;
      font-size: 9pt;
    }
    .info-row:last-child { border-bottom: none; }
    .amount { font-weight: bold; color: #0A2472; }
    .installments-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
      margin: 4px 0;
    }
.installments-table th, .installments-table td {
      border: 1px solid #ddd;
      padding: 3px 5px;
      text-align: center;
    }
    .installments-table th { background: #f0f4f8; color: #0A2472; }
    .installments-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
      margin: 4px 0;
    }
    .installment-card {
      padding: 4px 6px;
      border: 1px solid #ddd;
      border-radius: 4px;
      text-align: center;
      font-size: 8pt;
    }
    .installment-card .inst-num { font-weight: bold; color: #0A2472; }
    .installment-card .inst-amount { font-weight: bold; font-size: 9pt; }
    .installment-card .inst-date { color: #666; }
    .totals {
      margin-top: 4px;
      padding: 6px;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
      font-size: 9pt;
    }
    .total-row.final {
      border-top: 2px solid #0A2472;
      font-size: 11pt;
      font-weight: bold;
      color: #0A2472;
      padding-top: 3px;
      margin-top: 2px;
    }
    .declaration {
      margin-top: 4px;
      padding: 6px;
      background: #f0f4f8;
      border-radius: 4px;
      font-size: 8pt;
      line-height: 1.5;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 6px;
      padding-top: 4px;
    }
    .sig-box { width: 45%; text-align: center; }
    .sig-line {
      margin-top: 15px;
      border-top: 1px solid #333;
      padding-top: 2px;
      font-size: 8pt;
      color: #666;
    }
    .footer {
      text-align: center;
      margin-top: 4px;
      font-size: 8pt;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="contract-page">
    ${getContractHeader()}
    
    <div class="contract-title">${sale.saleType === 'INSTALLMENT' ? 'عقد بيع بالأقساط' : 'عقد بيع بدفعة كاملة'}</div>
    
    <div class="section">
      <div class="section-title">بيانات البيع</div>
      <div class="info-row"><span>رقم العقد:</span> <span class="amount">${sale.receiptNumber}</span></div>
      <div class="info-row"><span>تاريخ العقد:</span> <span>${dateStr}</span></div>
    </div>
    
    <div class="section">
      <div class="section-title">بيانات العميل</div>
      <div class="info-row"><span>الاسم:</span> <span class="amount">${escapeHtml(customer.name)}</span></div>
      <div class="info-row"><span>كود العميل:</span> <span>${escapeHtml(customer.bkCode)}</span></div>
      <div class="info-row"><span>نوع العميل:</span> <span>${escapeHtml(customer.customerType)}</span></div>
      ${customer.phone ? `<div class="info-row"><span>الهاتف:</span><span>${escapeHtml(customer.phone)}</span></div>` : ''}
      ${customer.address ? `<div class="info-row"><span>العنوان:</span><span>${escapeHtml(customer.address)}</span></div>` : ''}
    </div>
    
    <div class="section">
      <div class="section-title">بيانات الماكينة</div>
      <div class="info-row"><span>رقم الماكينة:</span> <span class="amount">${escapeHtml(sale.machineSerial)}</span></div>
      <div class="info-row"><span>السعر الإجمالي:</span> <span class="amount">${formatCurrency(sale.totalPrice)}</span></div>
      <div class="info-row"><span>الدفعة المقدمة:</span> <span class="amount">${formatCurrency(sale.downPayment)}</span></div>
      ${sale.downPaymentReceipt ? `<div class="info-row"><span>رقم إيصال المقدم:</span> <span class="amount" style="font-family:monospace;">${escapeHtml(sale.downPaymentReceipt)}</span></div>` : ''}
      ${sale.months ? `<div class="info-row" style="background: #e8f4fd; padding: 4px 8px; border-radius: 4px; margin-top: 4px;"><span>القسط الشهري (${sale.months} شهر):</span> <span class="amount" style="font-size: 11pt;">${formatCurrency((Number(sale.totalPrice) - Number(sale.downPayment)) / sale.months)}</span></div>` : ''}
    </div>
    
    ${installments.length > 0 ? `
    <div class="section">
      <div class="section-title">جدول الأقساط (${sale.months} قسط)</div>
      <div class="installments-grid">
        ${installments.map((inst: any) => `
          <div class="installment-card">
            <div class="inst-num">قسط ${inst.installmentNo}</div>
            <div class="inst-amount">${formatCurrency(inst.amount)}</div>
            <div class="inst-date">${formatDate(inst.dueDate)}</div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    <div class="totals">
      <div class="total-row"><span>إجمالي السعر:</span><span>${formatCurrency(sale.totalPrice)}</span></div>
      <div class="total-row"><span>المدفوع:</span><span>${formatCurrency(sale.paidAmount)}</span></div>
      <div class="total-row final"><span>المتبقي:</span><span>${formatCurrency(sale.remainingAmount)}</span></div>
    </div>
    
    <div class="declaration">
      <strong>إقرار المستلم:</strong> أنا الموقع أدناه أستلمت الماكينة بحالة جيدة وصالحة للعمل، وأتعهد بدفع الأقساط في مواعيدها المحددة.
    </div>
    
    <div class="signatures">
      <div class="sig-box"><div>ممثل خدمة العملاء</div><div class="sig-line">التوقيع</div></div>
      <div class="sig-box"><div>توقيع العميل</div><div class="sig-line">التوقيع</div></div>
    </div>
    
    <div class="footer">شكراً لتعاملكم معنا</div>
  </div>
</body>
</html>`;
  }

  async generateReceiptPdf(paymentId: string, res: Response) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { sale: { include: { customer: true } } },
    });

    if (!payment) {
      throw new Error('الدفع غير موجود');
    }

    const html = this.generateReceiptHtml(payment);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename=receipt-${payment.receiptNumber}.html`);
    res.send(html);
  }

  async generateContractPdf(saleId: string, res: Response) {
    const sale = await prisma.machineSale.findUnique({
      where: { id: saleId },
      include: { customer: true, installments: { orderBy: { installmentNo: 'asc' } }, payments: { orderBy: { paidAt: 'asc' } } },
    });

    if (!sale) {
      throw new Error('البيع غير موجود');
    }

    const html = this.generateContractHtml(sale);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename=contract-${sale.receiptNumber}.html`);
    res.send(html);
  }

  async generateCustomerStatementHtml(customerId: string, res: Response) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        sales: {
          include: {
            installments: { orderBy: { installmentNo: 'asc' } },
            payments: { orderBy: { paidAt: 'desc' } },
          },
        },
      },
    });

    if (!customer) {
      throw new Error('العميل غير موجود');
    }

    const sales = customer.sales;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    const totalSales = sales.reduce((sum, s) => sum + Number(s.totalPrice), 0);
    const totalPaid = sales.reduce((sum, s) => sum + Number(s.paidAmount), 0);
    const totalRemaining = sales.reduce((sum, s) => sum + Number(s.remainingAmount), 0);

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>كشف حساب - ${escapeHtml(customer.name)}</title>
  <style>${getReportStyles()}</style>
</head>
<body>
  ${getSidebar()}
  <div class="sheet">
    <div class="header">
      <div class="date">تاريخ الكشف: ${formatDate(new Date())}</div>
      <div class="header-center">
        <h1>كشف حساب عميل</h1>
      </div>
      <div></div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <div class="info-title">بيانات العميل</div>
        <div class="info-row"><span>الاسم:</span> <strong>${escapeHtml(customer.name)}</strong></div>
        <div class="info-row"><span>كود العميل:</span> <strong>${escapeHtml(customer.bkCode)}</strong></div>
        <div class="info-row"><span>نوع العميل:</span> <strong>${escapeHtml(customer.customerType)}</strong></div>
        ${customer.phone ? `<div class="info-row"><span>الهاتف:</span> <strong>${escapeHtml(customer.phone)}</strong></div>` : ''}
        ${customer.address ? `<div class="info-row"><span>العنوان:</span> <strong>${escapeHtml(customer.address)}</strong></div>` : ''}
      </div>
      <div class="info-box">
        <div class="info-title">ملخص الحساب</div>
        <div class="info-row"><span>إجمالي المبيعات:</span> <strong>${formatCurrency(totalSales)}</strong></div>
        <div class="info-row"><span>إجمالي المدفوع:</span> <strong style="color: #166534;">${formatCurrency(totalPaid)}</strong></div>
        <div class="info-row"><span>إجمالي المتبقي:</span> <strong style="color: #991b1b;">${formatCurrency(totalRemaining)}</strong></div>
        <div class="info-row"><span>عدد المعاملات:</span> <strong>${sales.length} عملية</strong></div>
      </div>
    </div>

    ${sales.length > 0 ? `
    <div class="table-container">
      <div class="info-title">المبيعات والأقساط</div>
      <table>
        <thead>
          <tr>
            <th>رقم العقد</th>
            <th>الماكينة</th>
            <th>النوع</th>
            <th>النظام</th>
            <th>الإجمالي</th>
            <th>المدفوع</th>
            <th>المتبقي</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${sales.map((sale: any) => `
            <tr>
              <td>${sale.receiptNumber}</td>
              <td style="font-family:monospace;">${escapeHtml(sale.machineSerial)}</td>
              <td>${sale.saleType === 'CASH' ? 'دفعة كاملة' : 'أقساط'}</td>
              <td>${sale.saleType === 'INSTALLMENT' ? `${sale.months} شهر` : '-'}</td>
              <td>${formatCurrency(sale.totalPrice)}</td>
              <td>${formatCurrency(sale.paidAmount)}</td>
              <td>${formatCurrency(sale.remainingAmount)}</td>
              <td><span class="status-badge ${sale.status === 'COMPLETED' ? 'status-paid' : sale.status === 'VOIDED' ? 'status-unpaid' : 'status-unpaid'}">${sale.status === 'ACTIVE' ? 'نشط' : sale.status === 'COMPLETED' ? 'مكتمل' : 'ملغى'}</span></td>
            </tr>
            ${sale.installments.length > 0 ? sale.installments.map((inst: any) => `
              <tr style="background: #f9fafb;">
                <td colspan="2" style="text-align: right; padding-right: 20px;">└ قسط ${inst.installmentNo}</td>
                <td>${formatDate(inst.dueDate)}</td>
                <td>${formatCurrency(inst.amount)}</td>
                <td>${formatCurrency(inst.paidAmount)}</td>
                <td>${formatCurrency(Number(inst.amount) - Number(inst.paidAmount))}</td>
                <td><span class="status-badge ${inst.isPaid ? 'status-paid' : 'status-unpaid'}">${inst.isPaid ? 'مدفوع' : 'مستحق'}</span></td>
              </tr>
            `).join('') : ''}
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${sales.some((s: any) => s.payments && s.payments.length > 0) ? `
    <div class="table-container">
      <div class="info-title">سجل المدفوعات</div>
      <table>
        <thead>
          <tr>
            <th>رقم الإيصال</th>
            <th>التاريخ</th>
            <th>المبلغ</th>
            <th>نوع الدفع</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${sales.flatMap((s: any) => s.payments || []).map((payment: any) => `
            <tr>
              <td>${payment.receiptNumber}</td>
              <td>${formatDate(payment.paidAt)}</td>
              <td><strong>${formatCurrency(payment.amount)}</strong></td>
              <td>${payment.paymentType === 'CASH_SALE' ? 'دفعة كاملة' : payment.paymentType === 'DOWN_PAYMENT' ? 'دفعة مقدمة' : 'قسط'}</td>
              <td>${getPaymentPlaceLabel(payment.paymentPlace)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="totals-box">
      <div class="total-row">
        <span>إجمالي المبيعات:</span>
        <span>${formatCurrency(totalSales)}</span>
      </div>
      <div class="total-row">
        <span>إجمالي المدفوع:</span>
        <span style="color: #166534;">${formatCurrency(totalPaid)}</span>
      </div>
      <div class="total-row final">
        <span>إجمالي المتبقي:</span>
        <span style="color: #991b1b;">${formatCurrency(totalRemaining)}</span>
      </div>
    </div>

    <div class="signatures">
      <div class="sig-box">
        <div><strong>ممثل خدمة العملاء</strong></div>
        <div class="sig-line">التوقيع</div>
      </div>
      <div class="sig-box">
        <div><strong>توقيع العميل</strong></div>
        <div class="sig-line">التوقيع</div>
      </div>
    </div>

    <div class="footer-note">كشف حساب صادر من برنامج المبيعات والتحصيل</div>
  </div>
  ${getReportScripts(`statement-${customer.bkCode}-${timestamp}`)}
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename=statement-${customer.bkCode}.html`);
    res.send(html);
  }

  // Export all data in the same format as the import template
  async exportFullTemplate() {
    const sales = await prisma.machineSale.findMany({
      where: { status: { not: 'VOIDED' } },
      include: {
        customer: true,
        installments: { orderBy: { installmentNo: 'asc' } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
      orderBy: { saleDate: 'desc' },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('بيانات كاملة');

    // === Same columns as import template + extras ===
    worksheet.columns = [
      // Template columns (re-importable)
      { header: 'كود العميل', key: 'bkCode', width: 15 },
      { header: 'نوع العميل', key: 'customerType', width: 15 },
      { header: 'اسم العميل', key: 'customerName', width: 25 },
      { header: 'السيريال', key: 'machineSerial', width: 20 },
      { header: 'تاريخ البيع القديم', key: 'saleDate', width: 18 },
      { header: 'إجمالي قيمة العقد', key: 'totalPrice', width: 18 },
      { header: 'إجمالي الأقساط المحصلة', key: 'paidInstallments', width: 22 },
      { header: 'المقدم', key: 'downPayment', width: 15 },
      { header: 'عدد الأقساط', key: 'months', width: 14 },
      { header: 'قيمة القسط الشهري', key: 'monthlyInstallment', width: 18 },
      { header: 'تاريخ آخر قسط مدفوع', key: 'lastPaymentDate', width: 20 },
      { header: 'ملاحظات', key: 'notes', width: 25 },
      // Extra columns
      { header: 'الحالة', key: 'status', width: 12 },
      { header: 'المتبقي', key: 'remainingAmount', width: 15 },
      { header: 'تاريخ أول قسط', key: 'firstDueDate', width: 18 },
      { header: 'عدد المتأخرات', key: 'overdueCount', width: 14 },
      { header: 'رقم العقد', key: 'receiptNumber', width: 20 },
      { header: 'نوع البيع', key: 'saleType', width: 12 },
    ];

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F4FD' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 25;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const sale of sales) {
      // Calculate paid installments (excluding down payment)
      const downPaymentTotal = sale.payments
        .filter(p => p.paymentType === 'DOWN_PAYMENT')
        .reduce((sum, p) => sum + Number(p.amount), 0);
      
      const installmentPayments = Number(sale.paidAmount) - downPaymentTotal;

      // Monthly installment amount
      const months = sale.months || 0;
      const monthlyAmt = sale.saleType === 'INSTALLMENT' && months > 0
        ? Math.round(((Number(sale.totalPrice) - Number(sale.downPayment)) / months) * 100) / 100
        : 0;

      // Last payment date
      const lastPayment = sale.payments.length > 0 ? sale.payments[0] : null;

      // Overdue count
      const overdueCount = sale.installments
        .filter(i => !i.isPaid && new Date(i.dueDate) < today)
        .length;

      worksheet.addRow({
        bkCode: sale.customer.bkCode,
        customerType: sale.customer.customerType || 'عام',
        customerName: sale.customer.name,
        machineSerial: sale.machineSerial,
        saleDate: formatDate(sale.saleDate),
        totalPrice: Number(sale.totalPrice),
        paidInstallments: Math.max(0, Math.round(installmentPayments)),
        downPayment: Number(sale.downPayment),
        months: sale.months || 0,
        monthlyInstallment: monthlyAmt,
        lastPaymentDate: lastPayment ? formatDate(lastPayment.paidAt) : '',
        notes: sale.notes || '',
        status: sale.status === 'ACTIVE' ? 'نشط' : sale.status === 'COMPLETED' ? 'مكتمل' : sale.status,
        remainingAmount: Number(sale.remainingAmount),
        firstDueDate: sale.firstDueDate ? formatDate(sale.firstDueDate) : '',
        overdueCount: overdueCount,
        receiptNumber: sale.receiptNumber,
        saleType: sale.saleType === 'CASH' ? 'كاش' : 'أقساط',
      });
    }

    // Auto-filter
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 18 },
    };

    // Number formatting for money columns
    ['totalPrice', 'paidInstallments', 'downPayment', 'monthlyInstallment', 'remainingAmount'].forEach(key => {
      const col = worksheet.getColumn(key);
      col.numFmt = '#,##0';
    });

    return workbook;
  }
}

function getPaymentPlaceLabel(place: string | null | undefined): string {
  if (!place) return '-';
  const labels: Record<string, string> = {
    dhamen: 'ضامن',
    post: 'البريد',
    bank: 'البنك',
  };
  const icon = labels[place] ? `👤 ${labels[place]}` : place;
  return icon;
}