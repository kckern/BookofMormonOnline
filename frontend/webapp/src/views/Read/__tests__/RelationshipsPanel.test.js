/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import RelationshipsPanel from "../CategoryPanels/RelationshipsPanel";

const mockSetPopUp = jest.fn();
jest.mock("src/contexts/AppControllerContext", () => ({
  useAppController: () => ({ functions: { setPopUp: (...args) => mockSetPopUp(...args) } }),
}));

const rows = [
  {
    rel: "used-to-slay", note: "Slew Amalickiah on Christmas Eve (Alma 51:34)", verse_id: 35154,
    src_type: "matter", src_slug: "teancum-javelin", src_name: "Teancum Javelin",
    dst_type: "people", dst_slug: "amalickiah", dst_name: "Amalickiah",
  },
  {
    rel: "kept-by", note: null, verse_id: 35154,
    src_type: "matter", src_slug: "plates-of-brass", src_name: "Plates of Brass",
    dst_type: "group", dst_slug: "nephites", dst_name: "Nephites",
  },
];

describe("RelationshipsPanel", () => {
  beforeEach(() => {
    mockSetPopUp.mockClear();
  });

  test("renders both endpoint names for every row", () => {
    render(<RelationshipsPanel data={rows} />);
    expect(screen.getByText("Teancum Javelin")).toBeInTheDocument();
    expect(screen.getByText("Amalickiah")).toBeInTheDocument();
    expect(screen.getByText("Plates of Brass")).toBeInTheDocument();
    expect(screen.getByText("Nephites")).toBeInTheDocument();
  });

  test("rows read src-name then rel then dst-name in text order", () => {
    const { container } = render(<RelationshipsPanel data={[rows[0]]} />);
    const row = container.querySelector("li");
    const text = row.textContent;
    expect(text.indexOf("Teancum Javelin")).toBeLessThan(text.indexOf("used-to-slay"));
    expect(text.indexOf("used-to-slay")).toBeLessThan(text.indexOf("Amalickiah"));
  });

  test("note renders as a subtitle line when present", () => {
    render(<RelationshipsPanel data={rows} />);
    expect(screen.getByText(/Slew Amalickiah on Christmas Eve/)).toBeInTheDocument();
  });

  test("clicking src name opens the source entity popup", () => {
    render(<RelationshipsPanel data={[rows[0]]} />);
    fireEvent.click(screen.getByText("Teancum Javelin"));
    expect(mockSetPopUp).toHaveBeenCalledWith({ type: "matters", ids: ["teancum-javelin"], underSlug: "matters" });
  });

  test("clicking dst name opens the destination entity popup", () => {
    render(<RelationshipsPanel data={[rows[0]]} />);
    fireEvent.click(screen.getByText("Amalickiah"));
    expect(mockSetPopUp).toHaveBeenCalledWith({ type: "people", ids: ["amalickiah"], underSlug: "people" });
  });

  test("group endpoints are clickable too", () => {
    render(<RelationshipsPanel data={[rows[1]]} />);
    fireEvent.click(screen.getByText("Nephites"));
    expect(mockSetPopUp).toHaveBeenCalledWith({ type: "group", ids: ["nephites"], underSlug: "group" });
  });
});
