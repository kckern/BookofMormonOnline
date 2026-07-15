import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

jest.mock('src/models/BoMOnlineAPI', () => ({ __esModule: true, default: jest.fn(), ApiBaseUrl: 'http://t' }));
jest.mock('src/contexts/AppControllerContext', () => ({
  useAppController: () => ({ states: { user: { token: 'tkn', user: 'u1', social: null, progress: { completed: 0 } } } }),
}));
jest.mock('src/models/Utils', () => ({ label: (key) => key }));
import BoMOnlineAPI from 'src/models/BoMOnlineAPI';
import { ReadingPlan } from '../index';

const plan = (over = {}) => ({
  slug: 'rp-x', title: 'My Plan', status: 'active', progress: 40, current: 1, config: '{}',
  startdate: '2026-07-01', duedate: '2026-08-01',
  segments: [
    { guid: 'g0', period: 'Day 1', ref: '1 Nephi 1', duedate: '2026-07-02', progress: 100, start: 1, end: 20 },
    { guid: 'g1', period: 'Day 2', ref: '1 Nephi 2', duedate: '2026-07-03', progress: 0, start: 21, end: 40 },
  ],
  ...over,
});

beforeEach(() => BoMOnlineAPI.mockReset());

test('renders active plan using server current + progress (no local recompute)', async () => {
  BoMOnlineAPI.mockImplementation((q) =>
    q.readingplan ? Promise.resolve({ readingplan: [plan()] })
      : Promise.resolve({ readingplansegment: [{ sections: [] }] }));
  render(<MemoryRouter><ReadingPlan /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/My Plan/)).toBeInTheDocument());
  expect(document.querySelector('.segmentListItem.active')).toBeTruthy();
  expect(screen.getByText(/40%/)).toBeInTheDocument();
});

test('no plan → gallery state', async () => {
  BoMOnlineAPI.mockImplementation((q) =>
    q.readingplan ? Promise.resolve({ readingplan: [null] })
      : Promise.resolve({ readingplanprograms: { p1: { slug: 'p1', title: 'Program One', description: '', durationLabel: '30 days' } } }));
  render(<MemoryRouter><ReadingPlan /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/Program One/)).toBeInTheDocument());
});

test('fetch failure → error state with retry', async () => {
  BoMOnlineAPI.mockRejectedValue(new Error('boom'));
  render(<MemoryRouter><ReadingPlan /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/rp_error_loading|Could not load/)).toBeInTheDocument());
});

test('completed plan → celebration state', async () => {
  BoMOnlineAPI.mockImplementation((q) =>
    q.readingplan ? Promise.resolve({ readingplan: [plan({ status: 'completed', progress: 100 })] }) : Promise.resolve({}));
  render(<MemoryRouter><ReadingPlan /></MemoryRouter>);
  await waitFor(() => expect(screen.getByText(/rp_plan_complete|complete/i)).toBeInTheDocument());
});
