import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import ResultGroup from '../ResultGroup';

test('renders a labeled group with count and items', () => {
  const cards = [{ slug: 'people/abinadi', title: 'Abinadi', snippet: '', ref: null, score: 0.9 }];
  render(<MemoryRouter><ResultGroup label="People" cards={cards} kind="person" /></MemoryRouter>);
  expect(screen.getByText(/People/)).toBeInTheDocument();
  expect(screen.getByText('Abinadi')).toBeInTheDocument();
});

test('renders nothing when cards is undefined (stripped empty group)', () => {
  const { container } = render(<MemoryRouter><ResultGroup label="Places" cards={undefined} kind="place" /></MemoryRouter>);
  expect(container).toBeEmptyDOMElement();
});

test('content card with null slug renders a non-link', () => {
  const cards = [{ slug: null, title: 'A note', snippet: 'text', ref: null, score: 0.5 }];
  render(<MemoryRouter><ResultGroup label="Commentary" cards={cards} kind="commentary" /></MemoryRouter>);
  expect(screen.getByText('A note').closest('a')).toBeNull(); // not wrapped in an <a>
});

test('renders a matter group using the content card', () => {
  const cards = [{ slug: 'matters/faith', title: 'Faith', snippet: 'first principle', ref: null, score: 0.9 }];
  const { getByText, container } = render(
    <MemoryRouter>
      <ResultGroup label="Matters" cards={cards} kind="matter" query="faith" semantic />
    </MemoryRouter>
  );
  expect(getByText('Faith')).toBeInTheDocument();
  expect(container.querySelector('.result-group.matter')).toBeInTheDocument();
});
