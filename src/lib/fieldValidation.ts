type Result = {error: string; valid: boolean};
type Field = {
  value: () => unknown;
  baseline?: () => unknown;
  validate: (value: any) => string | Promise<string>;
  report: (result: Result) => void;
  dependencies?: string[];
};
const snapshot = (value: unknown) => JSON.stringify(value);

export class FieldValidation {
  private fields = new Map<string, Field>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private generations = new Map<string, number>();
  private results = new Map<
    string,
    {snapshot: string | undefined; error: string}
  >();

  constructor(private delay = 400) {}

  register(key: string, field: Field) {
    this.fields.set(key, field);
    return key;
  }

  dirty(key: string) {
    const field = this.fields.get(key);
    return (
      !!field
      && (!field.baseline
        || snapshot(field.value()) !== snapshot(field.baseline()))
    );
  }

  private signature(key: string): string | undefined {
    const field = this.fields.get(key)!;
    return snapshot([
      field.value(),
      ...(field.dependencies ?? []).map(key => this.fields.get(key)?.value())
    ]);
  }

  private cancel(key: string) {
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
    this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
  }

  input(key: string) {
    this.cancel(key);
    this.fields.get(key)?.report({error: '', valid: false});
    if (!this.dirty(key)) {
      this.results.delete(key);
      return;
    }
    this.timers.set(
      key,
      setTimeout(() => {
        void this.check(key);
      }, this.delay)
    );
  }

  check(key: string, force = false): boolean | Promise<boolean> {
    this.cancel(key);
    const field = this.fields.get(key);
    if (!field) return true;
    if (!force && !this.dirty(key)) {
      field.report({error: '', valid: false});
      this.results.delete(key);
      return true;
    }
    const signature = this.signature(key);
    const previous = this.results.get(key);
    if (previous && previous.snapshot === signature) {
      field.report({error: previous.error, valid: !previous.error});
      return !previous.error;
    }
    const generation = this.generations.get(key);
    const apply = (error: string) => {
      if (
        this.generations.get(key) !== generation
        || signature !== this.signature(key)
      )
        return false;
      this.results.set(key, {snapshot: signature, error});
      field.report({error, valid: !error});
      return !error;
    };
    try {
      const result = field.validate(field.value());
      return result instanceof Promise ?
          result.then(apply, () =>
            apply('Validation is unavailable. Please retry.')
          )
        : apply(result);
    } catch {
      return apply('Validation is unavailable. Please retry.');
    }
  }

  async submit(keys = [...this.fields.keys()], create = false) {
    const selected = new Set(keys.filter(key => create || this.dirty(key)));
    for (const key of selected)
      for (const dependency of this.fields.get(key)?.dependencies ?? [])
        selected.add(dependency);
    for (const key of keys) if (!selected.has(key)) this.clear(key);
    const results = await Promise.all(
      [...selected].map(key => this.check(key, true))
    );
    return results.every(Boolean);
  }

  serverErrors(errors: Record<string, string>) {
    for (const [key, error] of Object.entries(errors)) {
      if (!this.fields.has(key)) continue;
      this.cancel(key);
      this.results.set(key, {snapshot: this.signature(key), error});
      this.fields.get(key)?.report({error, valid: false});
    }
  }

  clear(key: string) {
    this.cancel(key);
    this.results.delete(key);
    this.fields.get(key)?.report({error: '', valid: false});
  }

  reset() {
    for (const key of this.fields.keys()) this.clear(key);
  }

  remove(key: string) {
    this.clear(key);
    this.fields.delete(key);
  }

  destroy() {
    this.reset();
    this.fields.clear();
  }
}

export const requiredText =
  (label: string, max = Infinity) =>
  (value: string) =>
    !value.trim() ? `${label} is required.`
    : value.trim().length > max ? `${label} must be ${max} characters or less.`
    : '';

export const emailError = (value: string) =>
  requiredText('Email')(value)
  || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? '' : (
    'Please enter a valid email address.'
  ));
