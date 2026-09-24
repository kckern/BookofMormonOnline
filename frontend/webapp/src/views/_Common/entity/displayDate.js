import moment from "moment";
import { label } from "src/models/Utils";

// Moved out of PopUp.js so HistoryBody can format dates without importing the
// popup (and with it Study/Commentary/Narration/Victory). PopUp.js re-exports
// this, so existing importers — Drawer.js — are unaffected.
export const displayDate = (date) => {
  if (!date) return "";
  let len = date.length;
  return moment(date, [len === 4 ? "YYYY" : "YYYY-MM-DD"]).format(
    len === 4
      ? label("history_date_format_year")
      : label("history_date_format_full"),
  );
};
