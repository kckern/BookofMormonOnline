// Single source of truth for colors configured through JS props
// (Highcharts, react-tooltip, canvas) that CSS cannot reach.
// Reads the html[data-theme] attribute set before first paint (index.html)
// and kept in sync by Main.js.

export const isDarkTheme = () =>
  typeof document !== "undefined" &&
  document.documentElement.getAttribute("data-theme") === "dark";

export const tooltipTheme = () =>
  isDarkTheme()
    ? { backgroundColor: "#333333", textColor: "#ffffff", border: true, borderColor: "#555555" }
    : { backgroundColor: "#666666", textColor: "#ffffff", border: false, borderColor: "#666666" };

export const chartTheme = () =>
  isDarkTheme()
    ? {
        chart: { backgroundColor: "#222222" },
        title: { style: { color: "#ffffff" } },
        subtitle: { style: { color: "#dddddd" } },
        legend: { itemStyle: { color: "#dddddd" }, itemHoverStyle: { color: "#ffffff" } },
        xAxis: { labels: { style: { color: "#aaaaaa" } }, lineColor: "#555555", tickColor: "#555555", gridLineColor: "#333333" },
        yAxis: { labels: { style: { color: "#aaaaaa" } }, lineColor: "#555555", tickColor: "#555555", gridLineColor: "#333333" },
        tooltip: { backgroundColor: "#333333", style: { color: "#ffffff" } },
      }
    : {
        chart: { backgroundColor: "#FFFFFF" },
        title: { style: { color: "#333333" } },
        subtitle: { style: { color: "#666666" } },
        legend: { itemStyle: { color: "#333333" }, itemHoverStyle: { color: "#000000" } },
        xAxis: { labels: { style: { color: "#666666" } }, lineColor: "#ccd6eb", tickColor: "#ccd6eb", gridLineColor: "#e6e6e6" },
        yAxis: { labels: { style: { color: "#666666" } }, lineColor: "#ccd6eb", tickColor: "#ccd6eb", gridLineColor: "#e6e6e6" },
        tooltip: { backgroundColor: "rgba(247,247,247,0.85)", style: { color: "#333333" } },
      };
