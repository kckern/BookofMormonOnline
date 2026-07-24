import React from "react";
import { render } from "@testing-library/react";
import { FaxCrop } from "../FaxCrop";

jest.mock("src/models/BoMOnlineAPI", () => ({ renderBaseUrl: "http://render.test" }));

test("builds the crop URL from version + selector + width", () => {
  const { container } = render(<FaxCrop version="1837" selector="ids/31103" width={400} alt="1837 Kirtland" />);
  const img = container.querySelector("img");
  expect(img.getAttribute("src")).toBe("http://render.test/fax/render/1837/crop/w400/ids/31103.jpg");
  expect(img.getAttribute("alt")).toBe("1837 Kirtland");
  expect(img.getAttribute("loading")).toBe("lazy");
});

test("defaults width to 400", () => {
  const { container } = render(<FaxCrop version="1830" selector="ids/1" />);
  expect(container.querySelector("img").getAttribute("src")).toContain("/crop/w400/");
});

test("renders nothing when version or selector is missing", () => {
  expect(render(<FaxCrop version={null} selector="ids/1" />).container.firstChild).toBeNull();
  expect(render(<FaxCrop version="1837" selector={null} />).container.firstChild).toBeNull();
});

test("onError collapses the image (display:none), no broken-image glyph", () => {
  const { container } = render(<FaxCrop version="1837" selector="ids/31103" />);
  const img = container.querySelector("img");
  img.dispatchEvent(new Event("error"));
  expect(img.style.display).toBe("none");
});
