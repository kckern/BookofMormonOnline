import React, { useEffect, useState } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI.js";
import { Card, CardBody, CardHeader } from "reactstrap";
import { label } from "src/models/Utils";
export default function Gallery({ token, onStarted }) {
  const [programs, setPrograms] = useState(null);
  useEffect(() => {
    let c = false;
    BoMOnlineAPI({ readingplanprograms: null }, { useCache: false })
      .then((r) => { if (!c) setPrograms(Object.values(r?.readingplanprograms || {})); });
    return () => { c = true; };
  }, []);
  return (
    <Card><CardHeader><h3>{label("rp_start_a_plan")}</h3></CardHeader>
      <CardBody className="programGallery">
        {(programs || []).map((p) => (
          <div className="programCard" key={p.slug}><h5>{p.title}</h5>
            <p>{p.description}</p><div className="duration">{p.durationLabel}</div></div>
        ))}
      </CardBody></Card>
  );
}
