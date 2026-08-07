/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SampleStrip from "../SampleStrip";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

jest.mock("src/models/BoMOnlineAPI", () => ({
  __esModule: true,
  default: jest.fn(),
}));

// resetMocks: true — reinstall per test
const installApiMock = () =>
  BoMOnlineAPI.mockImplementation((input) => {
    const verses = {};
    for (const vid of input.verses || []) {
      verses[vid] = { verse_id: vid, text: `text of verse ${vid}`, heading: "" };
    }
    return Promise.resolve({ verses, versehighlights: {} });
  });

describe("SampleStrip", () => {
  beforeEach(installApiMock);

  test("renders sample verse text for the chosen partner and links to the reader", async () => {
    const onOpen = jest.fn();
    render(
      <SampleStrip bomBook="2 Nephi" bibleBook="Isaiah" onOpen={onOpen} />
    );
    // verse text appears once the API resolves
    await waitFor(() => expect(screen.getAllByText(/text of verse/).length).toBeGreaterThan(0));
    // the "open the full reader" affordance is present and wired
    const open = screen.getByRole("button", { name: /full reader|all \d+/i });
    fireEvent.click(open);
    expect(onOpen).toHaveBeenCalled();
  });

  test("renders nothing when the pair has no correspondences", () => {
    const { container } = render(
      <SampleStrip bomBook="Enos" bibleBook="Revelation" onOpen={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
