import { z } from 'zod';

export const customerSchema = z.object({
  bkCode: z.string().min(1, 'كود العميل مطلوب').max(20, 'كود العميل يجب أن لا يتجاوز 20 حرف').trim(),
  customerType: z.string().min(1, 'نوع العميل مطلوب').max(50).trim().default('عام'),
  name: z.string().min(1, 'اسم العميل مطلوب').max(200, 'اسم العميل يجب أن لا يتجاوز 200 حرف').trim(),
  phone: z.string().max(30, 'رقم الهاتف يجب أن لا يتجاوز 30 حرف').optional().or(z.literal(undefined)),
  address: z.string().max(500, 'العنوان يجب أن لا يتجاوز 500 حرف').optional().or(z.literal(undefined)),
  notes: z.string().max(1000, 'الملاحظات يجب أن لا تتجاوز 1000 حرف').optional().or(z.literal(undefined)),
});

export const updateCustomerSchema = z.object({
  bkCode: z.string().min(1, 'كود العميل مطلوب').max(20, 'كود العميل يجب أن لا يتجاوز 20 حرف').trim().optional(),
  customerType: z.string().min(1, 'نوع العميل مطلوب').max(50).trim().optional(),
  name: z.string().min(1, 'اسم العميل مطلوب').max(200, 'اسم العميل يجب أن لا يتجاوز 200 حرف').trim().optional(),
  phone: z.string().max(30, 'رقم الهاتف يجب أن لا يتجاوز 30 حرف').optional().or(z.literal(undefined)),
  address: z.string().max(500, 'العنوان يجب أن لا يتجاوز 500 حرف').optional().or(z.literal(undefined)),
  notes: z.string().max(1000, 'الملاحظات يجب أن لا تتجاوز 1000 حرف').optional().or(z.literal(undefined)),
});

export const saleSchema = z.object({
  customerId: z.string().uuid('معرف العميل مطلوب'),
  machineSerial: z.string().min(1, 'رقم الماكينة مطلوب').max(100, 'رقم الماكينة يجب أن لا يتجاوز 100 حرف').trim(),
  saleType: z.enum(['CASH', 'INSTALLMENT']),
  totalPrice: z.number().positive('سعر المبيعات يجب أن يكون موجباً').max(100000000, 'السعر كبير جداً'),
  downPayment: z.number().min(0, 'الدفعة المقدمة لا يمكن أن تكون سالبة').default(0),
  actualPaidAmount: z.number().min(0).optional(),
  installmentAmount: z.number().min(0).optional(),
  downPaymentReceipt: z.string().max(50, 'رقم إيصال المقدم يجب أن لا يتجاوز 50 حرف').optional().or(z.literal(undefined)),
  paymentPlace: z.string().max(50, 'مكان الدفع يجب أن لا يتجاوز 50 حرف').optional().or(z.literal(undefined)),
  notes: z.string().max(1000, 'الملاحظات يجب أن لا تتجاوز 1000 حرف').optional().or(z.literal(undefined)),
  saleDate: z.string().or(z.date()),
  lastDepositDate: z.string().or(z.date()).optional(),
  months: z.number().int().positive('عدد الأشهر يجب أن يكون موجباً').max(120, 'عدد الأشهر يجب أن لا يتجاوز 120').optional(),
  firstDueDate: z.string().or(z.date()).optional(),
}).refine(data => data.downPayment <= data.totalPrice, {
  message: 'الدفعة المقدمة لا يمكن أن تتجاوز السعر الإجمالي',
  path: ['downPayment'],
}).refine(data => data.saleType === 'CASH' || data.months !== undefined || data.installmentAmount !== undefined, {
  message: 'عدد الأشهر أو قيمة القسط مطلوبة للبيع بالأقساط',
  path: ['months'],
});

export const paymentSchema = z.object({
  saleId: z.string().uuid('معرف البيع مطلوب'),
  amount: z.number().positive('المبلغ يجب أن يكون موجباً').max(100000000, 'المبلغ كبير جداً'),
  paymentType: z.enum(['CASH_SALE', 'INSTALLMENT', 'DOWN_PAYMENT', 'REWARD']),
  paymentPlace: z.string().max(50, 'مكان الدفع يجب أن لا يتجاوز 50 حرف').optional().or(z.literal(undefined)),
  notes: z.string().max(1000, 'الملاحظات يجب أن لا تتجاوز 1000 حرف').optional().or(z.literal(undefined)),
  installmentIds: z.array(z.string().uuid()).max(60, 'عدد الأقساط كبير جداً').optional(),
  receiptNumber: z.string().max(50, 'رقم الإيصال يجب أن لا يتجاوز 50 حرف').optional().or(z.literal(undefined)),
  paidAt: z.string().or(z.date()).optional().or(z.literal(undefined)),
});

export const followUpSchema = z.object({
  customerId: z.string().uuid('معرف العميل مطلوب'),
  note: z.string().min(1, 'ملاحظة المتابعة مطلوبة').max(1000, 'الملاحظة يجب أن لا تتجاوز 1000 حرف').trim(),
  nextFollowUp: z.string().or(z.date()).optional(),
});

export const voidSaleSchema = z.object({
  reason: z.string().min(1, 'سبب الإلغاء مطلوب').max(500, 'سبب الإلغاء يجب أن لا يتجاوز 500 حرف').trim(),
});

export const recalculateInstallmentsSchema = z.object({
  newMonths: z.number().int().positive('عدد الأشهر يجب أن يكون موجباً').max(120, 'عدد الأشهر يجب أن لا يتجاوز 120'),
});

export const dateRangeSchema = z.object({
  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).optional(),
});

export const importLegacySchema = z.object({
  customerId: z.string().uuid(),
  installments: z.array(z.object({
    installmentNo: z.number().int().positive(),
    dueDate: z.string().or(z.date()),
    amount: z.number().positive(),
  })).min(1, 'يجب تحديد قسط واحد على الأقل'),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type FollowUpInput = z.infer<typeof followUpSchema>;
export type VoidSaleInput = z.infer<typeof voidSaleSchema>;
export type DateRangeInput = z.infer<typeof dateRangeSchema>;
export type ImportLegacyInput = z.infer<typeof importLegacySchema>;