import { FollowUpRepository, CustomerRepository } from '../repositories/index.js';
import type { FollowUpInput } from '../validators/schemas.js';

const followUpRepo = new FollowUpRepository();
const customerRepo = new CustomerRepository();

export class FollowUpService {
  async getAll(query?: { customerId?: string; isCompleted?: boolean }) {
    return followUpRepo.findAll(query);
  }

  async getById(id: string) {
    const followUp = await followUpRepo.findById(id);
    if (!followUp) {
      throw new Error('المتابعة غير موجودة');
    }
    return followUp;
  }

  async create(data: FollowUpInput) {
    const customer = await customerRepo.findById(data.customerId);
    if (!customer) {
      throw new Error('العميل غير موجود');
    }

    return followUpRepo.create({
      customerId: data.customerId,
      note: data.note,
      logs: data.logs || '[]',
      nextFollowUp: data.nextFollowUp 
        ? (typeof data.nextFollowUp === 'string' ? new Date(data.nextFollowUp) : data.nextFollowUp)
        : null,
      isCompleted: false,
      completedAt: null,
    });
  }

  async update(id: string, data: Partial<FollowUpInput>) {
    const existing = await followUpRepo.findById(id);
    if (!existing) {
      throw new Error('المتابعة غير موجودة');
    }

    const updateData: Record<string, unknown> = {};
    if (data.note) updateData.note = data.note;
    if (data.logs !== undefined) updateData.logs = data.logs;
    if (data.nextFollowUp !== undefined) {
      updateData.nextFollowUp = data.nextFollowUp 
        ? (typeof data.nextFollowUp === 'string' ? new Date(data.nextFollowUp) : data.nextFollowUp)
        : null;
    }

    return followUpRepo.update(id, updateData);
  }

  async complete(id: string) {
    const existing = await followUpRepo.findById(id);
    if (!existing) {
      throw new Error('المتابعة غير موجودة');
    }

    return followUpRepo.update(id, {
      isCompleted: true,
      completedAt: new Date(),
    });
  }

  async delete(id: string) {
    const existing = await followUpRepo.findById(id);
    if (!existing) {
      throw new Error('المتابعة غير موجودة');
    }
    return followUpRepo.delete(id);
  }

  async getUpcoming() {
    return followUpRepo.findUpcoming();
  }
}