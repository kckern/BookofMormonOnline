// Client-side index of study-group messages keyed by link type → link id.
// One skeleton for index/add/update/delete — the previous four hand-copied
// versions in Page.js had diverged into three bugs (audit 2026-07-14 §2.1-2.3).
import { testJSON } from "src/models/Utils";

// Returns [ [type, id], ... ] or null when the message carries no links.
function linkEntries(item) {
  const meta = testJSON(item?.data);
  if (!meta || meta.links === undefined) return null;
  return Object.entries(meta.links);
}

function setItem(comments, item) {
  const entries = linkEntries(item);
  if (!entries) return comments;
  const next = { ...(comments || {}) };
  for (const [type, id] of entries) {
    if (!type) continue;
    next[type] = { ...(next[type] || {}), [id]: item };
  }
  return next;
}

export function indexPageComments(messages) {
  let comments = {};
  for (const item of messages || []) comments = setItem(comments, item);
  return comments;
}

export function addToPageCommentIndex(comments, item) {
  return setItem(comments || {}, item);
}

export function updateToPageComment(comments, item) {
  return setItem(comments || {}, item);
}

export function deleteToPageComments(comments, item) {
  const entries = linkEntries(item);
  if (!entries || !comments) return comments;
  let next = comments;
  for (const [type, id] of entries) {
    if (next[type] && id in next[type]) {
      if (next === comments) next = { ...comments };
      const bucket = { ...next[type] };
      delete bucket[id];
      next[type] = bucket;
    }
  }
  return next;
}
