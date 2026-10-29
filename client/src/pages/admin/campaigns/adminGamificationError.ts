const knownMessages: Record<string, string> = {
  'A record with these details already exists': 'มีรายการที่ใช้ข้อมูลนี้อยู่แล้ว',
  'A linked record could not be found': 'ไม่พบข้อมูลที่เชื่อมโยง',
  'Campaign period data violates a database quota or date rule': 'ข้อมูลช่วงโครงการไม่ผ่านข้อกำหนดวงเงินหรือวันที่',
  'Record not found': 'ไม่พบรายการนี้',
  'Badge not found': 'ไม่พบเหรียญตรานี้',
  'End date must be after start date': 'วันสิ้นสุดต้องอยู่หลังวันเริ่มต้น',
  'Co-pay shares must total 100%': 'สัดส่วนเงินร่วมจ่ายต้องรวมกันเท่ากับ 100%',
  'Discounts require a type and value': 'กรุณาระบุประเภทและมูลค่าส่วนลด',
  'Percentage discount cannot exceed 100%': 'ส่วนลดแบบเปอร์เซ็นต์ต้องไม่เกิน 100%',
  'New periods must start in the future.': 'ช่วงเวลาใหม่ต้องเริ่มในอนาคต',
  'A period does not belong to this campaign': 'ช่วงเวลานี้ไม่ได้อยู่ในแคมเปญที่เลือก',
  'Started or used periods cannot be edited or removed.': 'แก้ไขหรือลบช่วงที่เริ่มแล้วหรือมีการใช้วงเงินไม่ได้',
  'A Badge with this condition type or tier already exists': 'มีเหรียญตราหรือระดับที่ใช้ข้อมูลนี้อยู่แล้ว',
  'An earned Badge tier cannot be removed or reassigned': 'ลบหรือเปลี่ยนระดับที่ผู้ใช้ได้รับแล้วไม่ได้',
  'Deactivate this Badge before changing its tiers': 'ปิดใช้งานเหรียญตราก่อนแก้ไขระดับ',
  'A tier does not belong to this Badge': 'ระดับนี้ไม่ได้อยู่ในเหรียญตราที่เลือก',
  'Implementation status changed; reload the Badge and retry activation': 'สถานะการพัฒนาเปลี่ยนแล้ว กรุณาโหลดข้อมูลใหม่ก่อนเปิดใช้งาน',
};

export const adminGamificationErrorMessage = (error: unknown, fallback: string): string => {
  const response = error as {
    response?: { data?: { message?: unknown }; status?: number };
    message?: unknown;
  };
  const message = typeof response.response?.data?.message === 'string'
    ? response.response.data.message
    : typeof response.message === 'string'
      ? response.message
      : '';

  if (!message) return fallback;
  if (/[ก-๙]/u.test(message)) return message;
  if (knownMessages[message]) return knownMessages[message];

  const status = response.response?.status;
  return status ? `${fallback} (รหัสข้อผิดพลาด ${status})` : fallback;
};
