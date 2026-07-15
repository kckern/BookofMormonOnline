import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
jest.mock('src/models/BoMOnlineAPI', () => ({ __esModule: true, default: jest.fn(), ApiBaseUrl: 'http://t' }));
jest.mock('src/models/Utils', () => ({ label: (k) => k }));
jest.mock('react-toastify', () => ({ toast: { error: jest.fn() } }));
import BoMOnlineAPI from 'src/models/BoMOnlineAPI';
import Wizard from '../Wizard';

const contents = {
  d1: { title: 'Division One', slug: 'division-one',
    pages: [{ title: 'Page A', slug: 'page-a', sections: [{ title: 's1', slug: 'x' }, { title: 's2', slug: 'y' }] }] },
};
const preview = { parts: 3, enddate: '2026-08-14', warnings: [], segments: [
  { period: 'Day 1', ref: '1 Nephi 1-2', duedate: '2026-07-16', blocks: 4 }] };

beforeEach(() => {
  BoMOnlineAPI.mockReset();
  BoMOnlineAPI.mockImplementation((q) => {
    if (q.contents !== undefined) return Promise.resolve({ contents });
    if (q.readingplanpreview) return Promise.resolve({ readingplanpreview: [preview] });
    if (q.startReadingPlan) return Promise.resolve({ startReadingPlan: { isSuccess: true, msg: 'OK' } });
    return Promise.resolve({});
  });
});

test('walks scope → pace → confirm → start', async () => {
  const onStarted = jest.fn();
  const onClose = jest.fn();
  render(<Wizard token="tkn" onClose={onClose} onStarted={onStarted} />);
  await waitFor(() => screen.getByText('Page A'));
  fireEvent.click(screen.getByLabelText(/Page A/));
  fireEvent.click(screen.getByText(/rp_next/));
  fireEvent.click(screen.getByText(/rp_pace_daily/));
  fireEvent.click(screen.getByText(/rp_next/));
  await waitFor(() => expect(screen.getByText(/1 Nephi 1-2/)).toBeInTheDocument());
  fireEvent.click(screen.getByText(/rp_start_plan/));
  await waitFor(() => expect(onStarted).toHaveBeenCalled());
  const call = BoMOnlineAPI.mock.calls.find((c) => c[0].startReadingPlan)[0].startReadingPlan;
  const cfg = JSON.parse(call.config);
  expect(cfg.scope).toEqual({ type: 'pages', slugs: ['page-a'] });
  expect(cfg.pacing.type).toBe('cadence');
});

test('blocks Next on empty scope', async () => {
  render(<Wizard token="tkn" onClose={jest.fn()} onStarted={jest.fn()} />);
  await waitFor(() => screen.getByText('Page A'));
  fireEvent.click(screen.getByText(/rp_next/));
  expect(screen.getByText(/rp_empty_scope/)).toBeInTheDocument();
});

test('shows clamp warning from preview', async () => {
  BoMOnlineAPI.mockImplementation((q) => {
    if (q.contents !== undefined) return Promise.resolve({ contents });
    if (q.readingplanpreview) return Promise.resolve({ readingplanpreview: [{ ...preview, parts: 2, warnings: [{ code: 'PARTS_CLAMPED', detail: 2 }] }] });
    return Promise.resolve({});
  });
  render(<Wizard token="tkn" onClose={jest.fn()} onStarted={jest.fn()} />);
  await waitFor(() => screen.getByText('Page A'));
  fireEvent.click(screen.getByLabelText(/Page A/));
  fireEvent.click(screen.getByText(/rp_next/));
  fireEvent.click(screen.getByText(/rp_pace_daily/));
  fireEvent.click(screen.getByText(/rp_next/));
  await waitFor(() => expect(screen.getByText(/rp_clamped/)).toBeInTheDocument());
});

test('books tab compiles a canonical verse range (hardcoded, no lookup freeze)', async () => {
  const onStarted = jest.fn();
  render(<Wizard token="tkn" onClose={jest.fn()} onStarted={onStarted} />);
  await waitFor(() => screen.getByText(/rp_tab_books/));
  fireEvent.click(screen.getByText(/rp_tab_books/));
  fireEvent.click(screen.getByLabelText(/Mosiah/));
  fireEvent.click(screen.getByText(/rp_next/));
  fireEvent.click(screen.getByText(/rp_pace_daily/));
  fireEvent.click(screen.getByText(/rp_next/));
  await waitFor(() => screen.getByText(/rp_start_plan/));
  fireEvent.click(screen.getByText(/rp_start_plan/));
  await waitFor(() => expect(onStarted).toHaveBeenCalled());
  const cfg = JSON.parse(BoMOnlineAPI.mock.calls.find((c) => c[0].startReadingPlan)[0].startReadingPlan.config);
  expect(cfg.scope).toEqual({ type: 'range', start: 32793, end: 33577 }); // Mosiah
});
