
const { determineLanguage } = require("./utils");
const { queryDB } = require("../library/db");



const mapMarker = async (req, res) => {
    
    const lang = determineLanguage(req);
    const path = req.path.split("/").filter(p=>p);
    const slug = path.pop();

    const placeDataResults = await queryDB(`SELECT * FROM bom_places WHERE slug = '${slug}'`);
    const [placeData] = placeDataResults;
    let name = placeData?.name;
    if(lang)
    {
        const translation = await queryDB(`SELECT * FROM bom_translation WHERE guid = '${placeData.guid}' AND lang = '${lang}' and refkey = 'name'`);
        const [item] = translation || [];
        name = item?.value || name;
    }
    name = name.replace(/\d+$/,"").trim();


    const markerColor = "#87cefa";

    const svg = `<svg xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="7" style="fill:${markerColor};"/>
    <text x="40" y="25" 
    font-family="'Roboto Condensed', 'Arial Narrow', 'sans-serif'" 
    fill="white" 
    stroke="black"
    stroke-width="0.5"
    >
     ${name}
    </text>
</svg>`;
  



    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');
    res.send(svg);

}

module.exports = { mapMarker };