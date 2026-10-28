import 'dotenv/config';
import assert from 'node:assert/strict';
import { Prisma, PrismaClient } from '@prisma/client';

const CAMPAIGN_ID = '11111111-1111-1111-1111-111111111111';
const BOUNDARIES = [
  {
    label: 'October',
    start: '2026-09-30T17:00:00.000Z',
    oldEnd: '2026-10-31T16:59:59.000Z',
    end: '2026-10-31T17:00:00.000Z',
  },
  {
    label: 'November',
    oldStart: '2026-10-31T16:59:59.000Z',
    start: '2026-10-31T17:00:00.000Z',
    end: '2026-11-30T17:00:00.000Z',
  },
  {
    label: 'December',
    start: '2026-11-30T17:00:00.000Z',
    oldEnd: '2026-12-31T16:59:59.000Z',
    end: '2026-12-31T17:00:00.000Z',
  },
] as const;

type Campaign = {
  campaign_id: string;
  total_quota_limit: Prisma.Decimal;
  start_date: Date;
  end_date: Date;
};

type Wallet = {
  wallet_id: string;
  user_id: string;
  created_at: Date;
  total_quota_remaining: Prisma.Decimal;
};

type Period = {
  period_id: string;
  period_name: string;
  period_quota_limit: Prisma.Decimal;
  start_date: Date;
  end_date: Date;
};

type Allocation = {
  wallet_period_quota_id: string;
  wallet_id: string;
  period_id: string;
  quota_limit: Prisma.Decimal;
  quota_used: Prisma.Decimal;
  quota_remaining: Prisma.Decimal;
};

type HistoricalTransaction = {
  transaction_id: string;
  status: string;
  government_copay_amount: string;
  citizen_paid_amount: string;
  total_amount: string;
  created_at: Date;
  completed_at: Date | null;
  fraud_decision: string | null;
  ledger_rows: number;
  ledger_amount: string;
  ledger_type_match: boolean;
  ledger_first_created_at: Date | null;
};

type AuditState = {
  campaign: Campaign;
  wallet: Wallet;
  walletsInCampaign: string[];
  periods: Period[];
  allocations: Allocation[];
  transactions: HistoricalTransaction[];
};

function parseArgs(args: string[]): { campaignId: string; walletId: string; apply: boolean } {
  let campaignId: string | undefined;
  let walletId: string | undefined;
  let apply = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--apply') {
      apply = true;
    } else if (argument === '--campaign-id') {
      campaignId = args[++index];
    } else if (argument === '--wallet-id') {
      walletId = args[++index];
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!campaignId || !uuidPattern.test(campaignId)) throw new Error('Pass a valid --campaign-id UUID.');
  if (!walletId || !uuidPattern.test(walletId)) throw new Error('Pass a valid --wallet-id UUID.');
  if (campaignId.toLowerCase() !== CAMPAIGN_ID) throw new Error(`This recovery is limited to campaign ${CAMPAIGN_ID}.`);
  return { campaignId, walletId, apply };
}

function cents(value: Prisma.Decimal | string): bigint {
  const input = value.toString();
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(input);
  if (!match) throw new Error(`Unsupported money precision in database value: ${input}`);
  const magnitude = BigInt(match[2]) * 100n + BigInt((match[3] ?? '').padEnd(2, '0'));
  return match[1] === '-' ? -magnitude : magnitude;
}

function money(centsValue: bigint): string {
  const sign = centsValue < 0n ? '-' : '';
  const absolute = centsValue < 0n ? -centsValue : centsValue;
  return `${sign}${absolute / 100n}.${(absolute % 100n).toString().padStart(2, '0')}`;
}

function iso(date: Date): string {
  return date.toISOString();
}

function acceptedTime(actual: Date, oldValue: string | undefined, finalValue: string): boolean {
  return actual.getTime() === Date.parse(finalValue) || (oldValue !== undefined && actual.getTime() === Date.parse(oldValue));
}

async function readState(db: Prisma.TransactionClient | PrismaClient, campaignId: string, walletId: string): Promise<AuditState> {
  const campaign = await db.campaigns.findUnique({
    where: { campaign_id: campaignId },
    select: { campaign_id: true, total_quota_limit: true, start_date: true, end_date: true },
  });
  if (!campaign) throw new Error('Target campaign was not found.');

  const wallet = await db.wallets.findUnique({
    where: { wallet_id: walletId },
    select: { wallet_id: true, user_id: true, campaign_id: true, created_at: true, total_quota_remaining: true },
  });
  if (!wallet || wallet.campaign_id !== campaignId) throw new Error('Target wallet does not belong to the target campaign.');

  const campaignWallets = await db.wallets.findMany({
    where: { campaign_id: campaignId },
    select: { wallet_id: true },
  });
  const periods = await db.campaign_periods.findMany({
    where: { campaign_id: campaignId },
    orderBy: { start_date: 'asc' },
    select: { period_id: true, period_name: true, period_quota_limit: true, start_date: true, end_date: true },
  });
  const allocations = await db.wallet_period_quotas.findMany({
    where: { wallet_id: walletId },
    select: {
      wallet_period_quota_id: true,
      wallet_id: true,
      period_id: true,
      quota_limit: true,
      quota_used: true,
      quota_remaining: true,
    },
  });
  const transactions = await db.$queryRaw<HistoricalTransaction[]>`
    SELECT t.transaction_id,
      t.status,
      t.government_copay_amount::text AS government_copay_amount,
      t.citizen_paid_amount::text AS citizen_paid_amount,
      t.total_amount::text AS total_amount,
      t.created_at,
      t.completed_at,
      fc.decision AS fraud_decision,
      count(wt.wallet_transaction_id)::int AS ledger_rows,
      coalesce(sum(wt.amount), 0)::text AS ledger_amount,
      coalesce(bool_and(wt.transaction_type = 'COPAY_PAYMENT'), false) AS ledger_type_match,
      min(wt.created_at) AS ledger_first_created_at
    FROM transactions t
    LEFT JOIN fraud_checks fc ON fc.transaction_id = t.transaction_id
    LEFT JOIN wallet_transactions wt
      ON wt.transaction_id = t.transaction_id
     AND wt.wallet_id = ${walletId}::uuid
     AND wt.transaction_type = 'COPAY_PAYMENT'
    WHERE t.user_id = ${wallet.user_id}::uuid
    GROUP BY t.transaction_id, fc.decision
    ORDER BY t.completed_at NULLS LAST, t.created_at, t.transaction_id
  `;

  return {
    campaign,
    wallet,
    walletsInCampaign: campaignWallets.map(({ wallet_id }) => wallet_id),
    periods,
    allocations,
    transactions,
  };
}

function buildPlan(state: AuditState, campaignId: string, walletId: string) {
  if (state.campaign.campaign_id !== campaignId || state.wallet.wallet_id !== walletId) {
    throw new Error('Read-back identity did not match the requested campaign and wallet.');
  }
  if (state.walletsInCampaign.length !== 1 || state.walletsInCampaign[0] !== walletId) {
    throw new Error('The target campaign must contain exactly the selected wallet for this reconciliation.');
  }
  if (cents(state.campaign.total_quota_limit) !== 300_000n) throw new Error('Campaign total is no longer 3,000 THB.');
  if (state.periods.length !== BOUNDARIES.length) throw new Error('Expected exactly three monthly periods.');

  const quotaTotal = state.periods.reduce((sum, period) => sum + cents(period.period_quota_limit), 0n);
  if (quotaTotal !== 300_000n) throw new Error('The configured period quotas no longer total 3,000 THB.');

  const expectedStart = Date.parse(BOUNDARIES[0].start);
  if (state.campaign.start_date.getTime() > expectedStart ||
      state.campaign.end_date.getTime() < Date.parse(BOUNDARIES[2].end)) {
    throw new Error('Campaign dates do not contain all required Bangkok calendar periods.');
  }

  const settledByPeriod = new Map<string, bigint>(state.periods.map((period) => [period.period_id, 0n]));
  const included: HistoricalTransaction[] = [];
  const excludedBeforeWallet: HistoricalTransaction[] = [];
  const unresolved: string[] = [];

  for (const transaction of state.transactions) {
    const governmentCents = cents(transaction.government_copay_amount);
    if (governmentCents === 0n) continue;
    if (governmentCents < 0n) {
      unresolved.push(`${transaction.transaction_id}: negative government contribution`);
      continue;
    }

    if (transaction.completed_at && transaction.completed_at < state.wallet.created_at && transaction.ledger_rows === 0) {
      excludedBeforeWallet.push(transaction);
      continue;
    }

    if (!transaction.completed_at || !['SUCCESS', 'FLAGGED'].includes(transaction.status)) {
      unresolved.push(`${transaction.transaction_id}: subsidy amount lacks a settled status and completion time`);
      continue;
    }

    if (transaction.ledger_rows !== 1 || !transaction.ledger_type_match ||
        cents(transaction.ledger_amount) !== cents(transaction.citizen_paid_amount) ||
        cents(transaction.total_amount) !== governmentCents + cents(transaction.citizen_paid_amount)) {
      unresolved.push(`${transaction.transaction_id}: settlement ledger does not corroborate payment amounts`);
      continue;
    }

    const matchingPeriods = state.periods.filter((period) =>
      period.start_date <= transaction.completed_at! && transaction.completed_at! < period.end_date
    );
    if (matchingPeriods.length !== 1) {
      unresolved.push(`${transaction.transaction_id}: completion time matches ${matchingPeriods.length} periods`);
      continue;
    }
    const period = matchingPeriods[0];
    settledByPeriod.set(period.period_id, settledByPeriod.get(period.period_id)! + governmentCents);
    included.push(transaction);
  }

  if (unresolved.length) throw new Error(`Ambiguous settled subsidy records; no changes made: ${unresolved.join('; ')}`);

  for (let index = 0; index < state.periods.length; index += 1) {
    const period = state.periods[index];
    const boundary = BOUNDARIES[index];
    if (cents(period.period_quota_limit) !== 100_000n ||
        !acceptedTime(period.start_date, 'oldStart' in boundary ? boundary.oldStart : undefined, boundary.start) ||
        !acceptedTime(period.end_date, 'oldEnd' in boundary ? boundary.oldEnd : undefined, boundary.end)) {
      throw new Error(`${boundary.label} period differs from both the audited original and required calendar boundaries.`);
    }
  }

  const allocationByPeriod = new Map(state.allocations.map((allocation) => [allocation.period_id, allocation]));
  if (state.allocations.length !== state.periods.length) throw new Error('The wallet does not have exactly one allocation per period.');

  const expectedAllocations = state.periods.map((period) => {
    const allocation = allocationByPeriod.get(period.period_id);
    if (!allocation) throw new Error(`No wallet allocation exists for ${period.period_name}.`);
    const usage = settledByPeriod.get(period.period_id)!;
    const limit = cents(period.period_quota_limit);
    const used = cents(allocation.quota_used);
    const remaining = cents(allocation.quota_remaining);
    if (cents(allocation.quota_limit) !== limit || remaining + used !== limit) {
      throw new Error(`Allocation values for ${period.period_name} do not match its configured quota.`);
    }
    if (used > usage) {
      throw new Error(`Existing ${period.period_name} usage exceeds the verified settled subsidy total.`);
    }
    return {
      periodId: period.period_id,
      periodName: period.period_name,
      allocationId: allocation.wallet_period_quota_id,
      currentUsed: money(used),
      currentRemaining: money(remaining),
      verifiedUsage: money(usage),
      unreconciledUsage: money(usage - used),
      finalUsed: money(usage),
      finalRemaining: money(limit - usage),
    };
  });

  const totalVerifiedUsage = [...settledByPeriod.values()].reduce((sum, amount) => sum + amount, 0n);
  if (cents(state.wallet.total_quota_remaining) !== cents(state.campaign.total_quota_limit) - totalVerifiedUsage) {
    throw new Error('Wallet campaign quota does not equal campaign quota less ledger-backed settled subsidy.');
  }

  const periodRows = state.periods.map((period, index) => ({
    id: period.period_id,
    name: BOUNDARIES[index].label,
    originalStart: iso(period.start_date),
    originalEnd: iso(period.end_date),
    correctedStart: BOUNDARIES[index].start,
    correctedEnd: BOUNDARIES[index].end,
    quota: money(cents(period.period_quota_limit)),
  }));

  const changedSeconds = [
    [Date.parse('2026-10-31T16:59:59.000Z'), Date.parse('2026-10-31T17:00:00.000Z')],
    [Date.parse('2026-12-31T16:59:59.000Z'), Date.parse('2026-12-31T17:00:00.000Z')],
  ];
  const affectedTransactions = state.transactions.filter((transaction) => transaction.completed_at &&
    changedSeconds.some(([start, end]) => transaction.completed_at!.getTime() >= start && transaction.completed_at!.getTime() < end)
  );
  if (affectedTransactions.length) {
    throw new Error(`A boundary change would reclassify settled transactions: ${affectedTransactions.map((row) => row.transaction_id).join(', ')}`);
  }

  return {
    campaign: {
      campaignId: state.campaign.campaign_id,
      totalQuota: money(cents(state.campaign.total_quota_limit)),
      walletTotalRemaining: money(cents(state.wallet.total_quota_remaining)),
    },
    wallet: { walletId: state.wallet.wallet_id, createdAt: iso(state.wallet.created_at) },
    periodRows,
    allocationRows: expectedAllocations,
    includedSettlements: included.map((row) => ({
      transactionId: row.transaction_id,
      status: row.status,
      fraudDecision: row.fraud_decision,
      completedAt: iso(row.completed_at!),
      governmentContribution: money(cents(row.government_copay_amount)),
      citizenLedgerAmount: money(cents(row.ledger_amount)),
      ledgerEntryAt: row.ledger_first_created_at ? iso(row.ledger_first_created_at) : null,
    })),
    excludedPreWalletTransactions: excludedBeforeWallet.map((row) => ({
      transactionId: row.transaction_id,
      status: row.status,
      completedAt: row.completed_at ? iso(row.completed_at) : null,
      governmentContribution: money(cents(row.government_copay_amount)),
      reason: 'Completed before this campaign wallet existed and has no wallet ledger entry.',
    })),
    verifiedGovernmentUsage: money(totalVerifiedUsage),
    boundaryReclassificationCount: affectedTransactions.length,
    idempotentNoOp: periodRows.every((row) => row.originalStart === row.correctedStart && row.originalEnd === row.correctedEnd) &&
      expectedAllocations.every((row) => row.currentUsed === row.finalUsed && row.currentRemaining === row.finalRemaining),
  };
}

async function lockState(tx: Prisma.TransactionClient, campaignId: string, walletId: string): Promise<void> {
  await tx.$queryRaw`SELECT campaign_id FROM campaigns WHERE campaign_id = ${campaignId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT wallet_id FROM wallets WHERE wallet_id = ${walletId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT period_id FROM campaign_periods WHERE campaign_id = ${campaignId}::uuid ORDER BY period_id FOR UPDATE`;
  await tx.$queryRaw`SELECT wallet_period_quota_id FROM wallet_period_quotas WHERE wallet_id = ${walletId}::uuid ORDER BY period_id FOR UPDATE`;
}

async function applyPlan(tx: Prisma.TransactionClient, state: AuditState, plan: ReturnType<typeof buildPlan>): Promise<void> {
  for (let index = 0; index < state.periods.length; index += 1) {
    const period = state.periods[index];
    const boundary = BOUNDARIES[index];
    if (period.start_date.toISOString() !== boundary.start || period.end_date.toISOString() !== boundary.end) {
      await tx.campaign_periods.update({
        where: { period_id: period.period_id },
        data: { start_date: new Date(boundary.start), end_date: new Date(boundary.end) },
      });
    }
  }

  for (const allocation of plan.allocationRows) {
    if (allocation.currentUsed !== allocation.finalUsed || allocation.currentRemaining !== allocation.finalRemaining) {
      await tx.wallet_period_quotas.update({
        where: { wallet_period_quota_id: allocation.allocationId },
        data: {
          quota_used: new Prisma.Decimal(allocation.finalUsed),
          quota_remaining: new Prisma.Decimal(allocation.finalRemaining),
          updated_at: new Date(),
        },
      });
    }
  }
}

async function main(): Promise<void> {
  const { campaignId, walletId, apply } = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient({ log: [] });
  try {
    const result = await prisma.$transaction(async (tx) => {
      if (apply) await lockState(tx, campaignId, walletId);
      const before = await readState(tx, campaignId, walletId);
      const plan = buildPlan(before, campaignId, walletId);
      if (!apply || plan.idempotentNoOp) return { mode: apply ? 'apply-no-op' : 'dry-run', before: plan, after: plan };

      await applyPlan(tx, before, plan);
      const after = await readState(tx, campaignId, walletId);
      const verifiedAfter = buildPlan(after, campaignId, walletId);
      if (!verifiedAfter.idempotentNoOp) throw new Error('Post-update verification did not reach the expected state.');
      return { mode: 'applied', before: plan, after: verifiedAfter };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
