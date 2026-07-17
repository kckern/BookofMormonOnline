# BottomNav active-index off-by-one when messenger is disabled

**Date:** 2026-07-17
**Status:** Known / dormant — intentionally NOT fixed as part of the unified-tabbed-home work
**Severity:** Low (dormant on all current hosts)
**Area:** `frontend/webapp/src/views/_Common/BottomNav.js`, `frontend/webapp/src/views/_Common/bottomNavSelection.js`

## Symptom

When the messenger feature flag is OFF, the mobile bottom-nav highlights the
WRONG item. Specifically, on the User route the "More" item highlights instead
of "User" (and the analogous shift applies to Study/More).

## Root cause

`BottomMenu` renders `allNavItems` after filtering out messenger-gated items:

```
allNavItems = [ Groups(req), Home(req), Study, User, More ]
```

- Messenger ON  → all 5 render → indices: Groups 0, Home 1, Study 2, User 3, More 4.
- Messenger OFF → Groups + Home filtered out → rendered array is
  `[ Study, User, More ]` → indices: Study 0, User 1, More 2.

`resolveBottomSelection(pathname, useMessenger)` (extracted verbatim from the
original `determineSelection`) returns, for messenger OFF:

| Route         | returned index | correct index in filtered array |
|---------------|----------------|---------------------------------|
| `/home/user`  | 2              | 1 (User)                        |
| legacy `/user`| 2              | 1 (User)                        |
| `/mobilemenu` | 3              | 2 (More)                        |
| default/study | 1              | 0 (Study)                       |

So every messenger-OFF index is one too high — the returns were written against
the UNFILTERED array. This was already wrong in the original
`determineSelection` before the unified-Home refactor; the refactor preserved it
byte-for-byte (see docs/specs/2026-07-17-unified-tabbed-home.md self-review note:
"existing BottomNav messenger-off indices are preserved verbatim").

## Why it is dormant

`isMessengerEnabled()` returns `true` on localhost, dev (`bom.kckern.net`), and
staging, so the messenger-OFF branch is never exercised on any live host today.
The bug only manifests if messenger is disabled for a host that still shows the
bottom nav.

## Why we did not fix it here

The unified-tabbed-home change intentionally kept `resolveBottomSelection`'s
numeric returns identical to the original to avoid changing untested runtime
behavior (the messenger-OFF path has no live coverage). Fixing the off-by-one is
a separate, standalone correctness change and is out of scope for that feature.

## The fix (when someone picks this up)

Make the messenger-OFF returns index into the FILTERED array:

```js
// messenger OFF (rendered: [Study, User, More])
// study/default → 0, user (/home/user or /user) → 1, mobilemenu → 2
```

Better still, stop hard-coding indices entirely: compute the active index from
the SAME filtered `bottomNavItemsData` array the component renders (e.g. match
the current pathname's first/second segment against each item's `path`), so the
selection can never drift out of sync with the rendered list again. Update
`bottomNavSelection.test.js` accordingly (the current OFF-branch assertions
`off("/home/user") === 2` etc. encode the buggy values and must change).
