import {expect, test} from 'bun:test';
import {
  findSubmitter,
  isSubmitChord,
  resolveSubmit,
  type SubmitKeyEvent
} from '../src/lib/utils/submitShortcut';

const control = (tagName: string, type: string, disabled = false) => ({
  tagName,
  type,
  disabled
});

const chord = (extra: Partial<SubmitKeyEvent> = {}): SubmitKeyEvent => ({
  key: 'Enter',
  ctrlKey: true,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  keyCode: 13,
  defaultPrevented: false,
  target: null,
  ...extra
});

function field(form: unknown, ignored = false) {
  return {form, closest: () => (ignored ? {} : null)};
}

test('only an unmodified Ctrl or Cmd plus Enter counts as send', () => {
  expect(isSubmitChord(chord())).toBe(true);
  expect(isSubmitChord(chord({ctrlKey: false, metaKey: true}))).toBe(true);
  expect(isSubmitChord(chord({ctrlKey: false}))).toBe(false);
  expect(isSubmitChord(chord({key: 'a'}))).toBe(false);
  expect(isSubmitChord(chord({shiftKey: true}))).toBe(false);
  expect(isSubmitChord(chord({altKey: true}))).toBe(false);
});

test('held keys and IME composition never send', () => {
  expect(isSubmitChord(chord({repeat: true}))).toBe(false);
  expect(isSubmitChord(chord({isComposing: true}))).toBe(false);
  expect(isSubmitChord(chord({keyCode: 229}))).toBe(false);
});

test('the first enabled submit button is the submitter', () => {
  const save = control('BUTTON', 'submit');
  const form = {
    elements: [
      control('TEXTAREA', 'textarea'),
      control('BUTTON', 'button'),
      control('BUTTON', 'submit', true),
      save
    ]
  };
  expect(findSubmitter(form)).toBe(save);
  expect(
    findSubmitter({elements: [control('BUTTON', 'button')]})
  ).toBeUndefined();
  expect(
    findSubmitter({elements: [control('INPUT', 'submit', true)]})
  ).toBeUndefined();
});

test('a form is only submitted through an enabled submit button', () => {
  const save = control('BUTTON', 'submit');
  const form = {elements: [control('TEXTAREA', 'textarea'), save]};
  expect(resolveSubmit(chord({target: field(form)}))).toEqual({
    form,
    submitter: save
  });

  const noSubmit = {elements: [control('BUTTON', 'button')]};
  expect(resolveSubmit(chord({target: field(noSubmit)}))).toBeNull();

  const busy = {elements: [control('BUTTON', 'submit', true)]};
  expect(resolveSubmit(chord({target: field(busy)}))).toBeNull();
});

test('buttons, links, opt-outs and handled events are left alone', () => {
  const form = {elements: [control('BUTTON', 'submit')]};
  expect(resolveSubmit(chord({target: field(form, true)}))).toBeNull();
  expect(
    resolveSubmit(chord({target: field(form), defaultPrevented: true}))
  ).toBeNull();
  expect(resolveSubmit(chord({target: null}))).toBeNull();
  expect(resolveSubmit(chord({target: {}}))).toBeNull();
});

test('a control outside the form still resolves through its form owner', () => {
  const save = control('BUTTON', 'submit');
  const form = {elements: [save]};
  const outside = {
    form: null,
    closest: (selector: string) => (selector === 'form' ? form : null)
  };
  expect(resolveSubmit(chord({target: outside}))?.submitter).toBe(save);
});
