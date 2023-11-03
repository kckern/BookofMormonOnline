const Sequelize = require('sequelize');
const { models: Models, sequelize, SQLQueryTypes } = require('../config/database');
const { determineLanguage } = require("./utils");
const { includeTranslation, Op, translatedValue } = require('../resolvers/_common');




const mapMarker = async (req, res) => {
    
    const lang = determineLanguage(req);
    const path = req.path.split("/").filter(p=>p);
    const slug = path.pop();

    const config = { where:{slug}};
    if(lang) config.include = [includeTranslation({ [Op.or]: ['name', 'info'] },lang)];

    const placeData = await Models.BomPlaces.findOne(config);
    if(!placeData) return res.json({success:false, message: "No place found with that slug"});
    
    const translatedName = translatedValue(placeData,"name");
    const translatedInfo = translatedValue(placeData,"info");


    let name = translatedName || placeData.getDataValue("name");
    let info = translatedInfo || placeData.getDataValue("info");

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