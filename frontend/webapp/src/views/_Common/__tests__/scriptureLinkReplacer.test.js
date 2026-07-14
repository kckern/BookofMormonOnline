import React from "react";
import Parser from "html-react-parser";
import { render, fireEvent, screen } from "@testing-library/react";
import { makeScriptureLinkReplacer } from "../scriptureLinkReplacer";

const HTML = 'see <a className="scripture_link">Alma 5:2</a> here';

test("turns scripture_link anchors into clickable elements passing the ref text", () => {
  const onClick = jest.fn();
  const replacer = makeScriptureLinkReplacer({ onClick });
  render(<div>{Parser(HTML, { replace: replacer })}</div>);
  const link = screen.getByText("Alma 5:2");
  expect(link.tagName).toBe("A");
  expect(link.className).toBe("scripture_link");
  fireEvent.click(link);
  expect(onClick).toHaveBeenCalledWith("Alma 5:2");
});

test("getClassName customizes the class per ref", () => {
  const replacer = makeScriptureLinkReplacer({
    onClick: () => {},
    getClassName: (ref) => "scripture_link" + (ref === "Alma 5:2" ? " active" : ""),
  });
  render(<div>{Parser(HTML, { replace: replacer })}</div>);
  expect(screen.getByText("Alma 5:2").className).toBe("scripture_link active");
});

test("returns undefined for non-matching nodes (parser falls through)", () => {
  const replacer = makeScriptureLinkReplacer({ onClick: () => {} });
  render(<div>{Parser('<a class="person">Nephi</a>', { replace: replacer })}</div>);
  // Untouched by the replacer: still an anchor with its original class.
  expect(screen.getByText("Nephi").className).toBe("person");
});

test("missing onClick does not throw on click", () => {
  const replacer = makeScriptureLinkReplacer({});
  render(<div>{Parser(HTML, { replace: replacer })}</div>);
  expect(() => fireEvent.click(screen.getByText("Alma 5:2"))).not.toThrow();
});
