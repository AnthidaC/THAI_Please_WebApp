import { z } from 'zod';

export const citizenAuthSchema = z.object({
  citizenId: z.string().length(13, 'เลขบัตรประชาชนต้องมีความยาว 13 หลัก'),
  fullName: z.string().min(2, 'ชื่อ-นามสกุลต้องมีความยาวอย่างน้อย 2 ตัวอักษร'),
  provinceCode: z.string().min(1, 'กรุณาระบุรหัสจังหวัด'),
});

export const citizenLoginSchema = z.object({
  citizenId: z.string().length(13, 'เลขบัตรประชาชนต้องมีความยาว 13 หลัก'),
});

export type CitizenAuthInput = z.infer<typeof citizenAuthSchema>;
export type CitizenLoginInput = z.infer<typeof citizenLoginSchema>;
