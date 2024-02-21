
const CanvasMarker = ({ name, label, icon, isActive }) => {


    return renderMarker({ name, label, icon,isActive });
};

const renderMarker = ({ name, label, icon, isActive }) => {

    //Preliminary setup

    name =  label || name;
    name = name.replace(/[0-9]/g, ''); // Remove numbers

    const lines = name?.split(/[\/]/g) || ["place"] // Split name into lines
    // Common settings
    let fontSize = 16 ;
    let iconPadding = 0;
    let iconWidth = 0;
    let radius = 0;
    let strokeColor = "#000000";
    let textColor = "#FFFFFF";
    let lineWidth = 3;
    let bold = "";
    let centerX = 0, centerY = 0; // Initialized to 0 for the 'region' case

    const rightAligned = icon === "city_right";

    switch (icon) {
        case "region":
            fontSize = 24;
            lineWidth = 4;
            break;
        case "land":
            fontSize = 18 ;
            bold = "bold";
            break;
        case "geo":
            textColor = "#bad9b5";
            strokeColor = "#313e2f";
            fontSize = 13;
            break;       
        case "aqua":
            textColor = "#bbdaf4";
            strokeColor = "#4f6a80";
            fontSize = 13;
            break;
        case "city_right":
            iconWidth = fontSize;
            radius = iconWidth / 3;
            iconPadding = 2;
            break;
        case "town":
            textColor = "#000000";
            strokeColor = "#FFFFFF";
            fontSize = 11;
            lineWidth = 2;
            iconWidth = fontSize;
            radius = iconWidth / 3;
            iconPadding = 2;
            break;   
        case "city":
            textColor = "#000000";
            strokeColor = "#FFFFFF";
            iconWidth = fontSize; 
            radius = iconWidth / 3;
            iconPadding = 2;
            break;
        default: // For city and other types
            iconWidth = fontSize; 
            radius = iconWidth / 3;
            iconPadding = 2;
            break;
    }


    const dpr = window.devicePixelRatio || 1;
    fontSize = fontSize * dpr;
    iconWidth = iconWidth * dpr;
    iconPadding = iconPadding * dpr;
    radius = radius * dpr;
    lineWidth = lineWidth * dpr;


    const fontString = `${bold} ${fontSize}px 'Roboto Condensed'`;


    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    


    context.font = fontString;
    const metrics = lines.map(line => context.measureText(line));
    const ex = context.measureText("x").width;
    const textWidth = Math.max(...metrics.map(m => m.width)) + ex;
    canvas.width = textWidth + iconWidth + iconPadding + (lineWidth * 2);
    const fontHeight = (metrics[0].actualBoundingBoxAscent + metrics[0].actualBoundingBoxDescent) + (lineWidth * 2);
    iconWidth = iconWidth ? fontHeight : 0;
    centerX =  (rightAligned ? (textWidth - (ex/2)) : 0) + (iconWidth / 2) 
    centerY = (iconWidth / 2) 
    canvas.height =  fontHeight * lines.length + (lineWidth * 1)
    context.fillStyle = isActive ? "#FFFFFF01" : "#FFFFFF01";
    context.fillRect(0, 0, canvas.width, canvas.height);




    if (centerX) { // Draw the icon if needed
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
        context.fillStyle = !isActive ? "#6b7d91" : "#000000";
        context.strokeStyle = "#FFFFFF88";
        context.lineWidth = 5 * dpr;
        context.stroke();
        context.fill();
    }

    context.font = fontString;
    context.lineWidth = lineWidth;
    context.strokeStyle = strokeColor;
    const longestLineByPixels = Math.max(...lines.map(line => context.measureText(line).width));
    const textStartX = iconWidth && !rightAligned ? iconWidth + iconPadding : lineWidth;
    lines.forEach((line, i) => {
        const gap = longestLineByPixels - context.measureText(line).width;
        const offset = gap / 2;
        const textStartY = (i + 1) * fontSize;

        context.lineJoin = 'round';
        context.miterLimit = 2;
        context.strokeText(line, textStartX + offset, textStartY);
        context.fillStyle = textColor;
        context.fillText(line, textStartX+ offset, textStartY);
    });
    
    // Adjust anchorX and anchorY based on whether or not there's an icon
    const iconXOffsetPerc = centerX / canvas.width;
    const anchorX = !iconWidth ? 0.5 : iconXOffsetPerc;
    const anchorY = 0.5; // centerY is always middle of the canvas height, simplifying the calculation



    return [
        canvas.height,
        canvas.width,
        [anchorX, anchorY],
        canvas.toDataURL()
    ];
};

module.exports = { CanvasMarker };