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
  for (const [type, id] of entries) {
    if (!type) continue;
    if (!comments[type]) comments[type] = {};
    comments[type][id] = item;
  }
  return comments;
}

export function indexPageComments(messages) {
  const comments = {};
  for (const item of messages || []) setItem(comments, item);
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
  for (const [type, id] of entries) {
    if (comments[type]) delete comments[type][id];
  }
  return comments;
}
