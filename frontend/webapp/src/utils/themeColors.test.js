import { isDarkTheme, tooltipTheme, chartTheme } from "./themeColors";

describe("themeColors", () => {
  afterEach(() => document.documentElement.removeAttribute("data-theme"));

  it("detects the html data-theme attribute", () => {
    expect(isDarkTheme()).toBe(false);
    document.documentElement.setAttribute("data-theme", "dark");
    expect(isDarkTheme()).toBe(true);
  });

  it("returns dark tooltip colors in dark mode", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    expect(tooltipTheme().backgroundColor).toBe("#333333");
    expect(tooltipTheme().textColor).toBe("#ffffff");
  });

  it("returns light tooltip colors otherwise", () => {
    expect(tooltipTheme().backgroundColor).toBe("#666666");
    expect(tooltipTheme().textColor).toBe("#ffffff");
  });

  it("returns a dark chart background in dark mode", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    expect(chartTheme().chart.backgroundColor).toBe("#222222");
  });
});
