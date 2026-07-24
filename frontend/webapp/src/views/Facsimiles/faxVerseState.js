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
      return { ...state, activeVerseId: null, source: null };
    case "OPEN":
      return { ...state, openVerse: action.verse };
    case "CLOSE":
      return { ...state, openVerse: null };
    case "RESET":
      return initialFaxVerseState;
    default:
      return state;
  }
}
