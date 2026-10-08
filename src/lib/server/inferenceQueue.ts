export class InferenceQueue {
  private readonly limit: number;
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(limit: number) {
    this.limit = limit;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>(resolve => this.waiting.push(resolve));
    } else {
      this.active++;
    }

    try {
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}
