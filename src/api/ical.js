
const { queryDB } = require("../library/db");
const USER = require("../resolvers/BomUser.ts");
const moment = require("moment");
require('moment-duration-format');

const { determineLanguage } = require("./utils");


const ical = async (req, res) => {
    
    const hostname = req.hostname;
    const lang = determineLanguage(req);
    const token = req.path.split("/").pop().replace(/\?.*$/, "");
    console.log({token});
    const log = await USER.default.Query.studylog(null, {token: token}, {lang}, null);

    const ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BomCalendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:BomCalendar
X-WR-TIMEZONE:America/New_York
` +

    //{ "timestamp": 1708083200, "datetime": "2024-02-16T11:33:20.000Z", "duration": 70, "description": null, "slug": "home", "pagelink": null },
    log.sessions.map(session => {

        const {timestamp, duration, description, slug} = session;
        //FORMAT: 19980118T073000Z
        const startDateTime = moment(timestamp*1000).utc().format("YYYYMMDDTHHmmssZ");
        const endDateTime = moment(timestamp*1000).add(duration, "seconds").utc().format("YYYYMMDDTHHmmssZ");
        const [page] = description?.split("—") || [];
        if(duration < 90) return "";

        //format 0hrs 30min
        const timeSpentHM = moment.duration(duration, "seconds").format("h[h] m[m]", {trim: "both"});
        const summary = `${timeSpentHM} 📘 ${page || "Book of Mormon Study"}`;
        const desc = description ? `${description}\\nhttps://${hostname}/${slug}` : "";

        return `BEGIN:VEVENT
UID:${session.timestamp}
DTSTAMP:${startDateTime}
DTSTART:${startDateTime}
DTEND:${endDateTime}
SUMMARY:${summary}
DESCRIPTION:${desc}
END:VEVENT\n`
    }).join("")

    + `END:VCALENDAR`.replace(/\n\s*/gm, "\n").replace(/\n+/g, "\r\n");

    //return res.json({log});

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename=${token}.ics`);
    res.send(ical);
}   


module.exports = {
    ical
}
