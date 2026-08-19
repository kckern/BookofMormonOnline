// Pure UI-state for the fax verse inspector. Phase 1 handles hover + open.
// Phase 2 will add PIN / ENGAGE / UNLOCK / SPREAD_CHANGE for deep-link pins;
// `source` is kept now so those transitions slot in without a reshape.
export const initialFaxVerseState = { activeVerseId: null, source: null, openVerse: null };

export function faxVerseReducer(state, action) {
  switch (action.type) {
    case "HOVER":
      return { ...state, activeVerseId: action.verseId, source: "hover" };
    case "LEAVE":
      if (state.source !== "hover") return state; // only hover clears on leave
      // Verse-scoped: a leave that was grace-delayed must NOT clear the spread if
      // the pointer already switched to another verse (that switch re-set
      // activeVerseId). Prevents the dimming flashing off between adjacent verses.
      if (action.verseId != null && state.activeVerseId !== action.verseId) return state;
      return { ...state, activeVerseId: null, source: null };
    case "OPEN":
      return { ...state, openVerse: action.verse };
    case "CLOSE":
      return { ...state, openVerse: null };
    case "RESET":
      // Clear transient hover only. The open modal is NOT cleared on a spread
      // change, so verse-by-verse nav can flip the page in the background without
      // tearing the modal down; the modal closes only via CLOSE.
      return { ...state, activeVerseId: null, source: null };
    default:
      return state;
  }
}
