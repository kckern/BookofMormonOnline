const { queryDB } = require("../library/db");
const {sendbird} = require("../library/sendbird.js");
const crypto = require('crypto');

const md5 = (value)=>{
    if(!value) return "";
    if(/$[0-9a-f]{32}$/.test(value)) return value;
    return crypto.createHash('md5').update(value,'utf8').digest("hex");
  }
  


const updateCoords =async  (req, res) => {

    //get token from header
    const {token} = req.headers;
    //get lat, lng, map, and guid from body
    const {lat,lng,map,guid} = req.body;

    let result = await queryDB("SELECT user FROM bom_user_token WHERE token = ?",[token]);
    let user = null;
    if(result && result.length > 0) {
        user = result[0].user;
    }    
    if(!user) return res.json({success:false, message: "Invalid token"});
    console.log("username",user);

    const md5Username = md5(user);
    //get sendbird object
    const metadata = await sendbird.getUserMetadata(md5Username);
    const keys = Object.keys(metadata);
    if(["isAdmin","isMapper"].every(key=>!keys.includes(key))) return res.json({success:false, message: "User is not a mapper", keys});

    //validate token

    if(!lat || !lng || !map || !guid) return res.json({success:false, message: "Invalid data", lat,lng,map,guid});

    const sql = `UPDATE bom_places_coords SET lat = ?, lng = ?, map = ?, time = NOW(), user = ? WHERE guid = ? LIMIT 1`;
    await queryDB(sql,[lat,lng,map,user,guid]);


    res.json({success:true, message: "Coords updated", user});
}


module.exports = { updateCoords }