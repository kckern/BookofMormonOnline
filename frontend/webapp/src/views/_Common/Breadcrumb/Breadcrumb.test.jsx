/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Breadcrumb from "./Breadcrumb";
import { isMobile } from "src/models/Utils";

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

describe("Breadcrumb.Dropdown", () => {
  beforeEach(() => isMobile.mockReturnValue(false));

  const Grid = ({ onPick }) => (
    <button type="button" onClick={onPick}>Pick me</button>
  );

  test("toggles open on trigger click and shows slotted content", () => {
    wrap(
      <Breadcrumb>
        <Breadcrumb.Dropdown label="David Whitmer"><Grid /></Breadcrumb.Dropdown>
      </Breadcrumb>
    );
    const trigger = screen.getByRole("button", { name: /David Whitmer/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Pick me")).toBeInTheDocument();
  });

  test("closes on outside click and on Escape, firing onOpenChange", () => {
    const onOpenChange = jest.fn();
    wrap(
      <Breadcrumb>
        <Breadcrumb.Dropdown label="Menu" onOpenChange={onOpenChange}><Grid /></Breadcrumb.Dropdown>
      </Breadcrumb>
    );
    const trigger = screen.getByRole("button", { name: /Menu/ });
    fireEvent.click(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText("Pick me")).toBeNull();

    fireEvent.click(trigger); // reopen
    fireEvent.mouseDown(document.body); // outside click
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  test("render-prop children receive `close` that dismisses the dropdown", () => {
    wrap(
      <Breadcrumb>
        <Breadcrumb.Dropdown label="Menu">
          {({ close }) => <button type="button" onClick={close}>Choose</button>}
        </Breadcrumb.Dropdown>
      </Breadcrumb>
    );
    fireEvent.click(screen.getByRole("button", { name: /Menu/ }));
    fireEvent.click(screen.getByText("Choose"));
    expect(screen.queryByText("Choose")).toBeNull();
  });

  test("controlled mode reflects the `open` prop", () => {
    const { rerender } = wrap(
      <Breadcrumb>
        <Breadcrumb.Dropdown label="Menu" open={false} onOpenChange={() => {}}><Grid /></Breadcrumb.Dropdown>
      </Breadcrumb>
    );
    expect(screen.queryByText("Pick me")).toBeNull();
    rerender(
      <MemoryRouter>
        <Breadcrumb>
          <Breadcrumb.Dropdown label="Menu" open onOpenChange={() => {}}><Grid /></Breadcrumb.Dropdown>
        </Breadcrumb>
      </MemoryRouter>
    );
    expect(screen.getByText("Pick me")).toBeInTheDocument();
  });

  test("mobileDrawer renders the Drawer instead of the inline panel when mobile", () => {
    isMobile.mockReturnValue(true);
    const { container } = wrap(
      <Breadcrumb>
        <Breadcrumb.Dropdown label="Menu" mobileDrawer><Grid /></Breadcrumb.Dropdown>
      </Breadcrumb>
    );
    fireEvent.click(screen.getByRole("button", { name: /Menu/ }));
    expect(container.querySelector(".bc-dropdown")).toBeNull();
    expect(screen.getByText("Pick me")).toBeInTheDocument();
  });

  test("mousedown inside the open panel does not close it", () => {
    wrap(
      <Breadcrumb>
        <Breadcrumb.Dropdown label="Menu"><Grid /></Breadcrumb.Dropdown>
      </Breadcrumb>
    );
    fireEvent.click(screen.getByRole("button", { name: /Menu/ }));
    const panelBtn = screen.getByText("Pick me");
    fireEvent.mouseDown(panelBtn);
    expect(screen.getByText("Pick me")).toBeInTheDocument(); // still open
  });
});
