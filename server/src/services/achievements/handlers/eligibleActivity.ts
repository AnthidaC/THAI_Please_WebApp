/**
 * Shared eligibility rules for Badge progress handlers.
 *
 * The payment flow saves a transaction as SUCCESS, or FLAGGED when the fraud
 * engine wants an admin to review it. Both are completed sales that charged the
 * citizen (see transaction.service.ts merchant revenue rule), so both count.
 * PENDING and REJECTED never count; a REJECTED row with a zero citizen amount is
 * the silent log written for an out-of-range scan.
 */
export const ELIGIBLE_TRANSACTION_STATUSES = ['SUCCESS', 'FLAGGED'] as const;

/** Referrals are only credited after the referred purchase converts them. */
export const CONVERTED_REFERRAL_STATUS = 'redeemed';
