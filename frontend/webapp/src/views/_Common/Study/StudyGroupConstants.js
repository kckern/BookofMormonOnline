var keyMirror = require('key-mirror');

export const ACTIONS = keyMirror({
    ACTIVE_GROUP_INDEX: null,
    SHOW_CREATE_GROUP_MODAL: null,
    SET_GROUP_LIST: null,
    ADD_NEW_GROUP: null,
    UPDATE_GROUP_LIST: null,
})

export const intialGroupsState = {
    activeGroupIndex: 0,
    showCreateGroupModal: false,
    groupList: [],
}

export const groupsReducer = (state, action) => {
    switch (action.type) {
        case ACTIONS.ACTIVE_GROUP_INDEX:
            return { ...state, activeGroupIndex: action.payload || 0 };
        case ACTIONS.SHOW_CREATE_GROUP_MODAL:
            return { ...state, showCreateGroupModal: action.payload };
        case ACTIONS.SET_GROUP_LIST:
            return { ...state, groupList: action.payload };
        case ACTIONS.ADD_NEW_GROUP:
            return { ...state, groupList: [...state.groupList, { ...action.payload }], showCreateGroupModal: false };
        case ACTIONS.UPDATE_GROUP_LIST: {
            state.groupList[state.activeGroupIndex] = action.payload;
            return { ...state };
        }
        default:
            return state;
    }
}