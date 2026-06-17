import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { renderHighlighted } from '../highlight';

test('wraps the offset range in a semantic-hl em', () => {
  const text = 'a space betwixt death and the resurrection';
  const range = { start: 8, end: 20 };
  const { container } = render(<div>{renderHighlighted(text, range)}</div>);
  const em = container.querySelector('em.semantic-hl');
  expect(em).not.toBeNull();
  expect(em.textContent).toBe(text.slice(8, 20));
});

test('falls back to keywordRender when range is null', () => {
  const kw = (t) => <em className="kw">{t}</em>;
  const { container } = render(<div>{renderHighlighted('what ye shall do', null, 'shall', kw)}</div>);
  expect(container.querySelector('em.kw')).not.toBeNull();
});

test('plain text when range null and no keywordRender', () => {
  const { container } = render(<div>{renderHighlighted('nothing matches', null)}</div>);
  expect(container.textContent).toBe('nothing matches');
});
