import React from "react";
import { Link } from "react-router-dom";
import { useAppController } from "src/contexts/AppControllerContext";
import { label } from "src/models/Utils";
import { ReadingPlan } from "../ReadingPlan";
import login from "../login.svg";

export default function ReadingPlanTile() {
  const appController = useAppController();
  if (!appController?.states?.user?.user) {
    return (
      <Link to="/user/signin" className="samplerTileInner signinTile">
        <img src={login} alt="" />
        <div>{label("sign_in")}</div>
      </Link>
    );
  }
  return (
    <div className="samplerTileInner readingPlanTile">
      <ReadingPlan />
    </div>
  );
}
