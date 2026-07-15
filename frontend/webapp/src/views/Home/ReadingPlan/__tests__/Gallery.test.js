import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
jest.mock('src/models/BoMOnlineAPI', () => ({ __esModule: true, default: jest.fn(), ApiBaseUrl: 'http://t' }));
jest.mock('src/models/Utils', () => ({ label: (k) => k }));
jest.mock('react-toastify', () => ({ toast: { error: jest.fn() } }));
import BoMOnlineAPI from 'src/models/BoMOnlineAPI';
import Gallery from '../Gallery';

const programs = { p1: { slug: 'p1', title: 'Program One', description: 'desc', durationLabel: '30 days', config: '{}' } };

test('start flow: pick program → confirm → startReadingPlan called → onStarted', async () => {
  const onStarted = jest.fn();
  BoMOnlineAPI.mockImplementation((q) => {
    if (q.readingplanprograms !== undefined) return Promise.resolve({ readingplanprograms: programs });
    if (q.startReadingPlan) return Promise.resolve({ startReadingPlan: { isSuccess: true, msg: 'OK' } });
    return Promise.resolve({});
  });
  render(<Gallery token="tkn" onStarted={onStarted} />);
  await waitFor(() => screen.getByText('Program One'));
  fireEvent.click(screen.getByText('Program One'));
  fireEvent.click(screen.getByText(/rp_start_plan/));
  await waitFor(() => expect(onStarted).toHaveBeenCalled());
  const call = BoMOnlineAPI.mock.calls.find((c) => c[0].startReadingPlan);
  expect(call[0].startReadingPlan).toMatchObject({ token: 'tkn', programSlug: 'p1' });
});

test('ACTIVE_PLAN_EXISTS shows the friendly error (no onStarted)', async () => {
  const onStarted = jest.fn();
  BoMOnlineAPI.mockImplementation((q) => {
    if (q.readingplanprograms !== undefined) return Promise.resolve({ readingplanprograms: programs });
    if (q.startReadingPlan) return Promise.resolve({ startReadingPlan: { isSuccess: false, msg: 'ACTIVE_PLAN_EXISTS' } });
    return Promise.resolve({});
  });
  render(<Gallery token="tkn" onStarted={onStarted} />);
  await waitFor(() => screen.getByText('Program One'));
  fireEvent.click(screen.getByText('Program One'));
  fireEvent.click(screen.getByText(/rp_start_plan/));
  await waitFor(() => expect(BoMOnlineAPI.mock.calls.some((c) => c[0].startReadingPlan)).toBe(true));
  expect(onStarted).not.toHaveBeenCalled();
});
