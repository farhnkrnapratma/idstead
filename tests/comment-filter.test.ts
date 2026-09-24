import {expect, test} from 'bun:test';
import {
  arrangeThreads,
  commentMatchesQuery,
  countThreadComments,
  type ArrangeOptions
} from '../src/lib/commentFilter';

interface C {
  id: string;
  content: string;
  created_at: string;
  name: string;
  is_admin?: boolean;
  reports?: number;
}
const c = (
  id: string,
  name: string,
  content: string,
  day: number,
  extra = {}
): C => ({
  id,
  name,
  content,
  created_at: `2026-09-${String(day).padStart(2, '0')}T00:00:00Z`,
  ...extra
});
const thread = (comment: C, ...children: C[]) => ({
  comment,
  children: children.map(child => ({comment: child}))
});
const threads = [
  thread(
    c('a', 'Adam', 'Very good!', 1),
    c('a1', 'Farhan', 'Thanks', 2, {is_admin: true})
  ),
  thread(c('b', 'Akbar', 'Lucu banget', 3, {reports: 2})),
  thread(
    c('c', 'Ferdi', 'Nice one', 2),
    c('c1', 'Yolo', 'Agree', 4),
    c('c2', 'Dango', 'Same', 5)
  )
];
const base: ArrangeOptions<C> = {
  query: '',
  filter: 'all',
  sort: 'date',
  direction: 'asc',
  nameOf: item => item.name
};
const ids = (query: Partial<ArrangeOptions<C>>) =>
  arrangeThreads(threads, {...base, ...query}).map(t => t.comment.id);

test('search matches content and commenter names, including replies', () => {
  expect(ids({query: 'good'})).toEqual(['a']);
  expect(ids({query: 'AKBAR'})).toEqual(['b']);
  expect(ids({query: 'yolo'})).toEqual(['c']);
  expect(ids({query: 'nothing'})).toEqual([]);
  expect(commentMatchesQuery(threads[0].comment, '', base.nameOf)).toBe(true);
});

test('filters keep whole threads', () => {
  expect(ids({filter: 'replied'})).toEqual(['a', 'c']);
  expect(ids({filter: 'unanswered'})).toEqual(['b']);
  expect(ids({filter: 'admin'})).toEqual(['a']);
  expect(ids({filter: 'reported'})).toEqual(['b']);
});

test('sorting supports date, replies and author in both directions', () => {
  expect(ids({})).toEqual(['a', 'c', 'b']);
  expect(ids({direction: 'desc'})).toEqual(['b', 'c', 'a']);
  expect(ids({sort: 'replies', direction: 'desc'})).toEqual(['c', 'a', 'b']);
  expect(ids({sort: 'author'})).toEqual(['a', 'b', 'c']);
  expect(ids({sort: 'author', direction: 'desc'})).toEqual(['c', 'b', 'a']);
});

test('the visible comment count includes replies', () => {
  expect(countThreadComments(threads)).toBe(6);
  expect(
    countThreadComments(arrangeThreads(threads, {...base, query: 'good'}))
  ).toBe(2);
});
