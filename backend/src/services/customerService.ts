import { CustomerRepository } from '../repositories/index.js';
import { generateBKCode } from '../utils/helpers.js';
import type { CustomerInput } from '../validators/schemas.js';
import type { Customer } from '@prisma/client';
import prisma from '../lib/prisma.js';

const customerRepo = new CustomerRepository();

export class CustomerService {
  async getAll(search?: string) {
    return customerRepo.findAll({ search });
  }

  async getById(id: string) {
    const customer = await customerRepo.findById(id);
    if (!customer) {
      throw new Error('العميل غير موجود');
    }
    return customer;
  }

  async create(data: CustomerInput) {
    const existing = await customerRepo.findByBkCodeAndType(data.bkCode, data.customerType);
    if (existing) {
      const error = new Error('رقم العميل موجود بالفعل لهذا النوع') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }
    const createData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> = {
      bkCode: data.bkCode,
      customerType: data.customerType,
      name: data.name,
      phone: data.phone || null,
      address: data.address || null,
      notes: data.notes || null,
      department: data.department || null,
    };
    return customerRepo.create(createData);
  }

  async update(id: string, data: Partial<CustomerInput>) {
    const existing = await customerRepo.findById(id);
    if (!existing) {
      const error = new Error('العميل غير موجود') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    if ((data.bkCode && data.bkCode !== existing.bkCode) || (data.customerType && data.customerType !== existing.customerType)) {
      const targetBkCode = data.bkCode || existing.bkCode;
      const targetType = data.customerType || existing.customerType;
      const bkExists = await customerRepo.findByBkCodeAndType(targetBkCode, targetType);
      if (bkExists && bkExists.id !== id) {
        const error = new Error('رقم العميل موجود بالفعل لهذا النوع') as Error & { statusCode: number };
        error.statusCode = 400;
        throw error;
      }
    }
    return customerRepo.update(id, data);
  }

  async delete(id: string) {
    const existing = await customerRepo.findById(id);
    if (!existing) {
      const error = new Error('العميل غير موجود') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Check for ACTIVE or COMPLETED sales
    const activeSalesCount = await prisma.machineSale.count({
      where: { 
        customerId: id,
        status: { in: ['ACTIVE', 'COMPLETED'] }
      }
    });

    if (activeSalesCount > 0) {
      const error = new Error('لا يمكن حذف عميل له مبيعات نشطة') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Perform cleanup in a transaction
    return await prisma.$transaction(async (tx) => {
      // Find all sales for this customer (which are all VOIDED or none based on check above)
      const sales = await tx.machineSale.findMany({ where: { customerId: id } });
      const saleIds = sales.map(s => s.id);

      if (saleIds.length > 0) {
        // 1. Delete payments associated with these sales
        await tx.payment.deleteMany({ where: { saleId: { in: saleIds } } });
        
        // 2. Delete installments (cascade might handle it, but safe to do explicitly)
        await tx.installment.deleteMany({ where: { saleId: { in: saleIds } } });
        
        // 3. Delete sales
        await tx.machineSale.deleteMany({ where: { id: { in: saleIds } } });
      }

      // 4. Delete follow-ups
      await tx.followUp.deleteMany({ where: { customerId: id } });

      // 5. Delete customer
      return tx.customer.delete({ where: { id } });
    });
  }

  async getCount() {
    return customerRepo.count();
  }

  generateBKCode() {
    return generateBKCode();
  }
}