import React from "react";
import { Link } from "react-router-dom";
import { label, breakCache, timeAgoString } from "src/models/Utils";

export default function ActivityTile({ data }) {
  if (!data) return null;
  const text = (data.msg || "")
    .replace(/<[^>]*>/gi, "")
    .replace(/^•$/, label("highlight_msg"));
  // latest.timestamp is milliseconds (see Feed.js, which divides by 1000);
  // timeAgoString expects UNIX seconds.
  return (
    <Link
      to={`/community/${data.channel}/${data.id}`}
      className="samplerTileInner activityTile"
    >
      <h3 className="tileHeading">{label("latest_activity")}</h3>
      <div className="activityTileMsg">
        <img src={data.user?.picture} alt="" onError={breakCache} />
        <div>
          <div className="activityTileUser">
            {data.user?.nickname}
            {data.timestamp ? (
              <span className="activityTileTime">
                {timeAgoString(data.timestamp / 1000)}
              </span>
            ) : null}
          </div>
          <p>{text}</p>
        </div>
      </div>
    </Link>
  );
}
