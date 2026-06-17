import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../highlightApi', () => {
  const actual = jest.requireActual('../highlightApi');
  return { ...actual, fetchHighlightRange: jest.fn() };
});
import { fetchHighlightRange, _api, useHighlightRange } from '../highlightApi';

const realIO = global.IntersectionObserver;
afterEach(() => { global.IntersectionObserver = realIO; });
beforeEach(() => {
  fetchHighlightRange.mockReset();
  // Keep _api in sync so the hook (which calls _api.fetchHighlightRange) uses the mock.
  _api.fetchHighlightRange = fetchHighlightRange;
});

function Probe({ enabled }) {
  const [range, ref] = useHighlightRange('afterlife', 'a, and the resurrection', enabled);
  return <div ref={ref} data-testid="r">{range ? `${range.start}-${range.end}` : 'none'}</div>;
}

test('disabled (keyword mode) → never fetches', () => {
  delete global.IntersectionObserver;
  render(<Probe enabled={false} />);
  expect(fetchHighlightRange).not.toHaveBeenCalled();
});

test('enabled + no IntersectionObserver → fetches immediately and exposes range', async () => {
  delete global.IntersectionObserver;
  fetchHighlightRange.mockResolvedValue({ start: 3, end: 9 });
  const { getByTestId } = render(<Probe enabled={true} />);
  await waitFor(() => expect(getByTestId('r').textContent).toBe('3-9'));
  expect(fetchHighlightRange).toHaveBeenCalledWith('afterlife', 'a, and the resurrection');
});
