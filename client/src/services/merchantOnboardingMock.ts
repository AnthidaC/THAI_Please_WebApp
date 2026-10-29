export interface MerchantOnboardingDraft {
  description: string;
  openingTime: string;
  closingTime: string;
  contact: string;
  photoName: string;
}

const keyFor = (merchantId: string) => `merchant-onboarding:${merchantId}`;

export const merchantOnboardingMock = {
  load(merchantId: string): MerchantOnboardingDraft {
    try {
      const raw = localStorage.getItem(keyFor(merchantId));
      return raw ? JSON.parse(raw) as MerchantOnboardingDraft : { description: '', openingTime: '', closingTime: '', contact: '', photoName: '' };
    } catch {
      return { description: '', openingTime: '', closingTime: '', contact: '', photoName: '' };
    }
  },
  save(merchantId: string, draft: MerchantOnboardingDraft): void {
    // Photo files are preview-only and are never persisted by the mock.
    localStorage.setItem(keyFor(merchantId), JSON.stringify({ ...draft, photoName: '' }));
  },
};
