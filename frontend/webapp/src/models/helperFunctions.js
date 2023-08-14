

export function getPageRect() {

    var isquirks = document.compatMode !== 'BackCompat';
    var page = isquirks ? document.documentElement : document.body;

    var x = page.scrollLeft;
    var y = page.scrollTop;
 
    if (y === 0 || y === undefined) {

        y = document.documentElement.scrollTop;
    }

    if (y === 0 || y === undefined) {

        y = document.body.scrollTop;
    }

    var w = 'innerWidth' in window ? window.innerWidth : page.clientWidth;
    var h = 'innerHeight' in window ? window.innerHeight : page.clientHeight;

    return [x, y, x + w - 100, y + h - 100];
}

export function windowHeight() {

    if (typeof (window.innerHeight) === "number") {

        return window.innerHeight;
    } else if (document.documentElement && (document.documentElement.clientHeight)) {

        return document.documentElement.clientHeight;
    } else if (document.body && (document.body.clientHeight)) {

        return document.body.clientHeight;
    }
}

export function windowWidth() {

    if (typeof (window.innerWidth) === 'number') {

        return window.innerWidth;
    } else if (document.documentElement && (document.documentElement.clientWidth)) {

        return document.documentElement.clientWidth;
    } else if (document.body && (document.body.clientWidth)) {

        return document.body.clientWidth;
    }
}

export function mainPanelCenterTopLeft() {

    let coords = getPageRect();
    let y = windowHeight();

    let height = 330; // Check CSS

    let top = coords[1] + (y / 3) - 50 - (height / 2);


    return {
        top
    }
}
