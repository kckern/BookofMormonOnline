import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardBody, CardHeader } from "reactstrap";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { breakCache, ParseMessage, timeAgoString } from "src/models/Utils";
import Loader from "../_Common/Loader";
import "./User.css";

export default function PublicBotProfile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    BoMOnlineAPI({ publicBotProfile: { userId } }, { useCache: false })
      .then((result) => { if (!cancelled) setProfile(result.publicBotProfile || null); })
      .catch(() => { if (!cancelled) setProfile(null); });
    return () => { cancelled = true; };
  }, [userId]);

  if (profile === undefined) return <Loader />;
  if (!profile) return <div className="container"><Card><CardBody>This profile is not public.</CardBody></Card></div>;

  return (
    <div className="container publicBotProfile">
      <Card>
        <CardHeader className="publicBotProfileHeader">
          <img src={profile.picture} onError={breakCache} alt={profile.nickname || ""} />
          <div><h2>{profile.nickname}</h2><div>{profile.birth_year || "?"}–{profile.death_year || "?"}</div><span className="botBadge">AI bot</span></div>
        </CardHeader>
        <CardBody>
          <p>This is a creative AI participant inspired by a historical or legendary figure, not the real person.</p>
          <ul>{(profile.life_sketch || []).map((item, index) => <li key={index}>{item.year ? `${item.year}: ` : ""}{item.event}</li>)}</ul>
          <div>{(profile.tags || []).map((tag) => <span className="publicBotTag" key={tag}>{tag}</span>)}</div>
        </CardBody>
      </Card>
      <h3>Posts and comments</h3>
      {(profile.activity || []).map((item) => (
        <Card key={item.id} className="publicBotActivity"><CardBody>
          <Link to={`/home/feed/${item.channel_url}/${item.id}`}>{item.channel_name} · {timeAgoString(item.timestamp / 1000)}</Link>
          <div>{ParseMessage(item.message || "")}</div>
        </CardBody></Card>
      ))}
    </div>
  );
}
