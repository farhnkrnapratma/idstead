import {describe, expect, test} from 'bun:test';
import {
  FieldValidation,
  requiredText,
  emailError
} from '../src/lib/fieldValidation';

const pause = () => new Promise(resolve => setTimeout(resolve, 15));

describe('field validation', () => {
  test('editing Name leaves other validators and feedback neutral, reverting clears feedback', async () => {
    const form = new FieldValidation(5);
    const values = {name: 'Initial', email: 'legacy value'};
    const baseline = {...values};
    const counts = {name: 0, email: 0};
    const feedback: Record<string, {error: string; valid: boolean}> = {};
    for (const key of ['name', 'email'] as const)
      form.register(key, {
        value: () => values[key],
        baseline: () => baseline[key],
        validate: value => {
          counts[key]++;
          return requiredText(key)(value);
        },
        report: value => {
          feedback[key] = value;
        }
      });
    values.name = 'Changed';
    form.input('name');
    await pause();
    expect(counts).toEqual({name: 1, email: 0});
    expect(await form.submit()).toBe(true);
    expect(counts).toEqual({name: 1, email: 0});
    expect(feedback.email).toEqual({error: '', valid: false});
    values.name = 'Initial';
    form.input('name');
    expect(form.dirty('name')).toBe(false);
    expect(feedback.name).toEqual({error: '', valid: false});
    form.destroy();
  });
  test('independent timers, blur, autofill and required empty fields reuse current results', async () => {
    const form = new FieldValidation(5);
    let email = '',
      password = '';
    let calls = 0;
    form.register('email', {
      value: () => email,
      baseline: () => '',
      validate: value => {
        calls++;
        return emailError(value);
      },
      report: () => {}
    });
    form.register('password', {
      value: () => password,
      baseline: () => '',
      validate: requiredText('Password'),
      report: () => {}
    });
    email = 'test@example.com';
    form.input('email');
    password = 'secret';
    form.input('password');
    await pause();
    expect(calls).toBe(1);
    expect(await form.submit(undefined, true)).toBe(true);
    expect(calls).toBe(1);
    email = 'invalid';
    expect(await form.submit(undefined, true)).toBe(false);
    expect(calls).toBe(2);
    email = 'autofill@example.com';
    expect(form.check('email')).toBe(true);
    password = '';
    expect(await form.submit(undefined, true)).toBe(false);
    form.destroy();
  });
  test('outdated async results cannot overwrite a new value or removed field', async () => {
    const form = new FieldValidation(5);
    let value = 'first',
      error = '';
    const pending: ((message: string) => void)[] = [];
    form.register('name', {
      value: () => value,
      validate: () => new Promise<string>(resolve => pending.push(resolve)),
      report: result => {
        error = result.error;
      }
    });
    const first = form.check('name');
    value = 'second';
    const second = form.check('name');
    pending[1]('');
    await second;
    pending[0]('Old error');
    expect(await first).toBe(false);
    expect(error).toBe('');
    value = 'third';
    const third = form.check('name');
    form.remove('name');
    pending[2]('Removed error');
    expect(await third).toBe(false);
    expect(error).toBe('');
  });
  test('stable list keys keep errors with items across reorder and deletion', async () => {
    const form = new FieldValidation(5);
    let items = [
      {id: 'a', value: 'A'},
      {id: 'b', value: 'B'}
    ];
    const errors: Record<string, string> = {};
    for (const item of items)
      form.register(item.id, {
        value: () => item.value,
        validate: requiredText('Value'),
        report: result => {
          errors[item.id] = result.error;
        }
      });
    items[0].value = '';
    form.input('a');
    items = [items[1], items[0]];
    await pause();
    expect(errors.a).toBe('Value is required.');
    expect(errors.b).toBeUndefined();
    form.remove('a');
    items = items.filter(item => item.id !== 'a');
    expect(await form.submit(items.map(item => item.id))).toBe(true);
    form.destroy();
  });
  test('date dependencies invalidate cached results and saving sets a new baseline', async () => {
    const form = new FieldValidation();
    const end = 2;
    let baselineEnd = 2;
    let start = 1;
    let baselineStart = 1;
    let error = '';
    let calls = 0;
    form.register('start', {
      value: () => start,
      baseline: () => baselineStart,
      validate: () => '',
      dependencies: ['end'],
      report: () => {}
    });
    form.register('end', {
      value: () => end,
      baseline: () => baselineEnd,
      validate: () => {
        calls++;
        return end < start ? 'Invalid range' : '';
      },
      dependencies: ['start'],
      report: result => {
        error = result.error;
      }
    });
    start = 3;
    expect(await form.submit()).toBe(false);
    expect(error).toBe('Invalid range');
    start = 0;
    expect(await form.submit()).toBe(true);
    expect(calls).toBe(2);
    baselineStart = start;
    baselineEnd = end;
    form.reset();
    expect(form.dirty('start')).toBe(false);
    expect(error).toBe('');
    form.serverErrors({start: 'Server rejected value'});
    expect(await form.submit(undefined, true)).toBe(false);
    form.destroy();
  });
});
