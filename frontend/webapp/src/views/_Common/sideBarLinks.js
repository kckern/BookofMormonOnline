const links = [
    {
        mini: "TP",
        name: "Full Text",
        path: "/jaredites/1",
        linkedPaths: ["/:page/:sectionRow/:row/:timeLineMapId", "/:page/:sectionRow/:row", "/:page/:sectionRow", "/:page"]
    },
    {
        mini: "CN",
        name: "Contents",
        path: "/contents",
        linkedPaths: [],
    },
    {
        mini: "FX",
        name: "Fax",
        path: "/fax",
        linkedPaths: []
    },
    {
        collapse: true,
        name: "People",
        state: "peopleCollapse",
        views: [
            {
                mini: "PN",
                name: "People Network",
                path: "/relationships",
                linkedPaths: []
            },
            {
                mini: "PP",
                name: "People",
                path: "/people",
                linkedPaths: ["/people/:personName", "/people"]
            }
        ]
    },
    {
        collapse: true,
        name: "Places",
        state: "placeCollapse",
        views: [
            {
                mini: "PL",
                name: "Places",
                path: "/places",
                linkedPaths: ['/place/:placeName', '/places']
            },
            {
                mini: "MP",
                name: "Map",
                path: "/map",
                linkedPaths: ["/map/:mapName/place/:placeName", "/map/:mapName", "/map","/maps"]
            }
        ]
    },
    {
        mini: "TL",
        name: "Timeline",
        path: "/timeline",
        linkedPaths: ["/timeline/:markerSlug", "/timeline"]
    },
    {
        mini: "SG",
        name: "Study Groups",
        path: "/study-groups",
        linkedPaths: []
    },
    {
        collapse: true,
        name: "About",
        state: "aboutCollapse",
        views: [
            {
                mini: "AB",
                name: "About us",
                path: "/about",
                linkedPaths: []

            },
            {
                mini: "CT",
                name: "Contact",
                path: "/contact",
                linkedPaths: []
            },
        ]
    }
];


export default links;
