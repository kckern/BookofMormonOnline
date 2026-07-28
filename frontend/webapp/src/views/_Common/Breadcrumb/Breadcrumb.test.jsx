/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";

jest.mock("src/models/Utils", () => ({
  label: (key) => key,
  isMobile: jest.fn(() => false),
}));

const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Breadcrumb — trail", () => {
  test("items shorthand renders segments with a separator between them", () => {
    const { container } = wrap(
      <Breadcrumb items={[{ label: "Alma", to: "/alma" }, { label: "War Chapters", current: true }]} />
    );
    expect(screen.getByText("Alma")).toBeInTheDocument();
    expect(screen.getByText("War Chapters")).toBeInTheDocument();
    expect(container.querySelectorAll(".bc-sep")).toHaveLength(1);
  });

  test("current item is non-interactive with aria-current, linked item is a link", () => {
    wrap(<Breadcrumb items={[{ label: "Alma", to: "/alma" }, { label: "War Chapters", current: true }]} />);
    expect(screen.getByText("Alma").closest("a")).toHaveAttribute("href", "/alma");
    expect(screen.getByText("War Chapters")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("War Chapters").closest("a")).toBeNull();
  });

  test("Breadcrumb.Link renders a Link for `to` and a button for `onClick`", () => {
    const onClick = jest.fn();
    wrap(
      <Breadcrumb>
        <Breadcrumb.Link to="/history">History</Breadcrumb.Link>
        <Breadcrumb.Link onClick={onClick}>Back</Breadcrumb.Link>
      </Breadcrumb>
    );
    expect(screen.getByText("History").closest("a")).toHaveAttribute("href", "/history");
    const btn = screen.getByText("Back");
    expect(btn.tagName).toBe("BUTTON");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("root prop renders an icon segment first, linkable, with a separator after it", () => {
    const { container } = wrap(
      <Breadcrumb
        root={{ icon: <svg data-testid="home-svg" />, to: "/", "aria-label": "Home" }}
        items={[{ label: "History", to: "/history" }]}
      />
    );
    const root = container.querySelector(".bc-root");
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute("href", "/");
    expect(root).toHaveAttribute("aria-label", "Home");
    expect(screen.getByTestId("home-svg")).toBeInTheDocument();
    expect(container.querySelectorAll(".bc-sep")).toHaveLength(1);
    expect(container.querySelector("nav").firstChild).toBe(root);
  });

  test("size prop applies the size class", () => {
    const { container } = wrap(<Breadcrumb size="sm" items={[{ label: "A", to: "/a" }]} />);
    expect(container.querySelector(".breadcrumb")).toHaveClass("bc-size-sm");
  });

  test("non-current, non-link item renders as plain text without aria-current", () => {
    const { container } = wrap(<Breadcrumb items={[{ label: "Just text" }]} />);
    const el = screen.getByText("Just text");
    expect(el).not.toHaveAttribute("aria-current");
    expect(el.closest("a")).toBeNull();
    expect(container.querySelector(".bc-current")).toBeNull();
  });

  test("custom separator node is used between segments", () => {
    wrap(<Breadcrumb separator="/" items={[{ label: "A", to: "/a" }, { label: "B", to: "/b" }]} />);
    expect(screen.getByText("/")).toBeInTheDocument();
  });

  test("root-only renders no separator", () => {
    const { container } = wrap(<Breadcrumb root={{ icon: <svg data-testid="r" />, to: "/" }} />);
    expect(container.querySelectorAll(".bc-sep")).toHaveLength(0);
  });
});
