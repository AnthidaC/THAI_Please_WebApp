import prisma from '../utils/prisma';

interface MockMission {
  name: string;
  description: string;
  conditionType: string;
  targetValue: number;
  rewardName: string;
}

const mockMissions: MockMission[] = [
  {
    name: 'ทำรายการที่สำเร็จครบ 5 ครั้ง [Demo]',
    description: 'ทำรายการซื้อที่สำเร็จจากร้านค้าที่เข้าร่วมให้ครบ 5 ครั้งในช่วงเวลาภารกิจ',
    conditionType: 'transaction_count',
    targetValue: 5,
    rewardName: 'ส่วนลดนักช้อปชุมชน 10%',
  },
  {
    name: 'ทำรายการที่สำเร็จครบ 10 ครั้ง [Demo]',
    description: 'ทำรายการซื้อที่สำเร็จจากร้านค้าที่เข้าร่วมให้ครบ 10 ครั้งในช่วงเวลาภารกิจ',
    conditionType: 'transaction_count',
    targetValue: 10,
    rewardName: 'ส่วนลดร้านชุมชน 20 บาท',
  },
  {
    name: 'ทำรายการที่สำเร็จครบ 20 ครั้ง [Demo]',
    description: 'ทำรายการซื้อที่สำเร็จจากร้านค้าที่เข้าร่วมให้ครบ 20 ครั้งในช่วงเวลาภารกิจ',
    conditionType: 'transaction_count',
    targetValue: 20,
    rewardName: 'ส่วนลดมื้อเช้า 25 บาท',
  },
  {
    name: 'ใช้จ่ายสะสมครบ 250 บาท [Demo]',
    description: 'สะสมยอดเงินที่จ่ายจริงจากการซื้อสินค้าให้ครบ 250 บาทในช่วงเวลาภารกิจ',
    conditionType: 'total_spending',
    targetValue: 250,
    rewardName: 'ส่วนลดผู้ใช้จ่ายสะสม 50 บาท',
  },
  {
    name: 'ใช้จ่ายสะสมครบ 1,000 บาท [Demo]',
    description: 'สะสมยอดเงินที่จ่ายจริงจากการซื้อสินค้าให้ครบ 1,000 บาทในช่วงเวลาภารกิจ',
    conditionType: 'total_spending',
    targetValue: 1000,
    rewardName: 'ส่วนลดพิเศษสมาชิก 75 บาท',
  },
  {
    name: 'ใช้จ่ายสะสมครบ 2,500 บาท [Demo]',
    description: 'สะสมยอดเงินที่จ่ายจริงจากการซื้อสินค้าให้ครบ 2,500 บาทในช่วงเวลาภารกิจ',
    conditionType: 'total_spending',
    targetValue: 2500,
    rewardName: 'ส่วนลดตลาดใกล้บ้าน 50 บาท',
  },
  {
    name: 'เขียนรีวิวจากการซื้อครบ 1 รีวิว [Demo]',
    description: 'เขียนรีวิวจากการซื้อที่ตรวจสอบแล้วให้ครบ 1 รีวิวในช่วงเวลาภารกิจ',
    conditionType: 'review_count',
    targetValue: 1,
    rewardName: 'ส่วนลดนักรีวิวชุมชน 15%',
  },
  {
    name: 'เขียนรีวิวจากการซื้อครบ 5 รีวิว [Demo]',
    description: 'เขียนรีวิวจากการซื้อที่ตรวจสอบแล้วให้ครบ 5 รีวิวในช่วงเวลาภารกิจ',
    conditionType: 'review_count',
    targetValue: 5,
    rewardName: 'คูปองขอบคุณนักรีวิว 15%',
  },
  {
    name: 'แนะนำเพื่อนที่ซื้อสำเร็จครบ 2 คน [Demo]',
    description: 'แนะนำเพื่อนที่ทำรายการซื้อสำเร็จให้ครบ 2 คนในช่วงเวลาภารกิจ',
    conditionType: 'referral_count',
    targetValue: 2,
    rewardName: 'ส่วนลดขอบคุณผู้แนะนำ 20 บาท',
  },
  {
    name: 'แนะนำเพื่อนที่ซื้อสำเร็จครบ 5 คน [Demo]',
    description: 'แนะนำเพื่อนที่ทำรายการซื้อสำเร็จให้ครบ 5 คนในช่วงเวลาภารกิจ',
    conditionType: 'referral_count',
    targetValue: 5,
    rewardName: 'คูปองไมล์สโตนชวนเพื่อน (Referrer Milestone ฿40)',
  },
];

const dayInMilliseconds = 24 * 60 * 60 * 1000;

const seedMockMissions = async () => prisma.$transaction(async (tx) => {
  const rewardNames = [...new Set(mockMissions.map((mission) => mission.rewardName))];
  const rewards = await tx.rewards.findMany({
    where: { reward_name: { in: rewardNames } },
    select: { reward_id: true, reward_name: true },
  });
  const rewardIdByName = new Map(rewards.map((reward) => [reward.reward_name, reward.reward_id]));
  const missingRewards = rewardNames.filter((name) => !rewardIdByName.has(name));
  if (missingRewards.length > 0) {
    throw new Error('Missing demo rewards: ' + missingRewards.join(', '));
  }

  const conditionTypes = [...new Set(mockMissions.map((mission) => mission.conditionType))];
  const registeredConditions = await tx.condition_types.findMany({
    where: { condition_key: { in: conditionTypes } },
    select: { condition_key: true },
  });
  const registeredConditionKeys = new Set(registeredConditions.map((condition) => condition.condition_key));
  const missingConditions = conditionTypes.filter((condition) => !registeredConditionKeys.has(condition));
  if (missingConditions.length > 0) {
    throw new Error('Missing demo mission conditions: ' + missingConditions.join(', '));
  }

  const names = mockMissions.map((mission) => mission.name);
  const existingMissions = await tx.quests.findMany({
    where: { quest_name: { in: names } },
    select: { quest_id: true, quest_name: true },
  });
  const missionIdByName = new Map(existingMissions.map((mission) => [mission.quest_name, mission.quest_id]));
  const now = new Date();
  let created = 0;
  let updated = 0;

  for (const mission of mockMissions) {
    const data = {
      quest_name: mission.name,
      description: mission.description,
      condition_type: mission.conditionType,
      target_value: mission.targetValue,
      reward_id: rewardIdByName.get(mission.rewardName)!,
      campaign_id: null,
      starts_at: new Date(now.getTime() - dayInMilliseconds),
      ends_at: new Date(now.getTime() + 30 * dayInMilliseconds),
      status: 'active',
    };
    const existingId = missionIdByName.get(mission.name);

    if (existingId) {
      await tx.quests.update({ where: { quest_id: existingId }, data });
      updated += 1;
    } else {
      await tx.quests.create({ data });
      created += 1;
    }
  }

  return { created, updated };
});

const main = async () => {
  try {
    const result = await seedMockMissions();
    console.log('Mock missions saved. Created: ' + result.created + ', updated: ' + result.updated);
  } catch (error) {
    console.error('Unable to seed mock missions', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
};

void main();
