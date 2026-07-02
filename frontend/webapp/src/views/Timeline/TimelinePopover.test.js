import React from 'react'
import '@testing-library/jest-dom' // no setupTests.js in this app — import per-file like the Search tests do
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TimelinePopover from './TimelinePopover'

const place = { side: 'right', left: 120, top: 300, tailTop: 40 }

it('renders heading, date and close control', () => {
  render(
    <MemoryRouter>
      <TimelinePopover
        place={place}
        slug="great-tower"
        info={{ heading: 'The Great Tower', date: '3100 BC', slug: 'great-tower', html: '<p>hi</p>' }}
        onClose={() => {}}
      />
    </MemoryRouter>
  )
  expect(screen.getByRole('dialog')).toHaveStyle({ left: '120px', top: '300px' })
  expect(screen.getByText('The Great Tower')).toBeInTheDocument()
  expect(screen.getByLabelText('Close')).toBeInTheDocument()
})
