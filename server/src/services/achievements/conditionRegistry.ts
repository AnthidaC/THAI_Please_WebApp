export interface BadgeConditionHandler {
  conditionType: string;
  getProgress(userId: string, window?: ProgressWindow): Promise<number>;
}

export interface ProgressWindow {
  startsAt: Date;
  endsAt: Date;
}

export class BadgeConditionRegistry {
  private readonly handlers = new Map<string, BadgeConditionHandler>();

  register(handler: BadgeConditionHandler): void {
    if (!/^[a-z][a-z0-9_]{1,49}$/.test(handler.conditionType)) {
      throw new Error('Condition type must be a lowercase identifier');
    }
    if (this.handlers.has(handler.conditionType)) {
      throw new Error(`A handler is already registered for ${handler.conditionType}`);
    }
    this.handlers.set(handler.conditionType, handler);
  }

  has(conditionType: string): boolean {
    return this.handlers.has(conditionType);
  }

  listConditionTypes(): string[] {
    return [...this.handlers.keys()].sort();
  }

  async getProgress(conditionType: string, userId: string, window?: ProgressWindow): Promise<number> {
    const handler = this.handlers.get(conditionType);
    if (!handler) throw new Error(`Condition type is not registered: ${conditionType}`);
    const progress = await handler.getProgress(userId, window);
    if (!Number.isFinite(progress) || progress < 0) {
      throw new Error(`Handler returned invalid progress for condition type: ${conditionType}`);
    }
    return progress;
  }
}

// No achievement conditions are implemented in this codebase yet.
export const badgeConditionRegistry = new BadgeConditionRegistry();

