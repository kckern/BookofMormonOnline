export const highlightTextJSX = (text, arrayOfStrings, verse_id) => {
    arrayOfStrings = arrayOfStrings || [];
    const {jsx, debug} =  generateHighlightedText(text, arrayOfStrings);
    const cutpointCount = debug.cutpoints.length;
    debug["verse_id"] = verse_id;
    debug["cutpointCount"] = cutpointCount;
    return <>
        <span>{jsx}</span>
        {cutpointCount < 2 && <pre>
            {JSON.stringify(debug, null, 2)}
        </pre>}
    </>

  };

const prepareText = (text) => {
    return text.replace(/[-']/g, "");
}


export const generateHighlightedText = (text, arrayOfStrings) => {
    text = prepareText(text);
    // Convert strings in arrayOfStrings to regex patterns that ignore case and non-alphabetic characters
    const patterns = arrayOfStrings.map((str) => {
        str = str.replace(/ /g, "[^a-z]+");
        return str
    });
    const cutpoints = patterns.map((regexStr) => {
        const regex = new RegExp(regexStr, "gi");
        const match = regex.exec(text)
        const index = match ? match.index : -1;
        const length = match ? match[0].length : 0;
        if (index >= 0) return [[index, index + length]];
        return [];
    }).flat()
    //sort by start index
    .sort((a, b) => a[0] - b[0])    
    .reduce((acc, position, index, array) => {

            const min = Math.min(...acc);
            const [start, end] = position;
            if(start===0) acc.push(start);
            if(start > min) acc.push(start);
            if(end > min && end > start) acc.push(end);
            const isLast = index === array.length - 1;
            if(isLast) {
                const last = Math.max(...acc);
                if(last < text.length) acc.push(text.length);
            }
            return acc;
          }, [0]).flat();


    const cutText = cutpoints.map((position, index) => {
        position = position<0 ? 0 : position;
        const nextPosition = cutpoints[index + 1] || text.length;
        return text.slice(position, nextPosition);
    });
    const debug = {text,arrayOfStrings,patterns,cutpoints, cutText};
    //return <pre>  {JSON.stringify(, null, 2)}  </pre>

    const jsx = cutText.map((text, index) => {
        const isHighlighted = index % 2 === 1;
        return isHighlighted ? <span className="highlight">{text}</span> : <span>{" "}{text}{" "}</span>;
    });

    return {jsx, debug};

  };
  