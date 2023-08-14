import "./User.css";
import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Card,
  CardHeader,
  Alert,
  CardBody,
  Input,
  InputGroupAddon,
  InputGroupText,
  InputGroup,
} from "reactstrap";

import { SignUp } from "./SignUp.js"
import { label } from "src/models/Utils";

import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import SocialSignIn from "./SocialSignIn";
import "./SignIn.css"
import { Spinner } from "../_Common/Loader";




export default function SignIn({  appController }) {



  const [signUp, setSignUp] = useState(false);
  const [message, setMessage] = useState(null);
  const [loadingButton, setLoadingButton] = useState(false);
  const [loading, setLoading] = useState(false);
  const [noSignUp, setNoSignUp] = useState(false);

  const loginwithpassword = (setMessage, setBtnLoading) => {

    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;
    let token = localStorage.getItem("token");
    setBtnLoading(true);
    BoMOnlineAPI({ signin: { username, password, token } }).then(results => {

      setBtnLoading(false);
      if (!results?.signin?.isSuccess) {
        setMessage(results?.signin?.msg);
      }
      else if (results?.signin) {
        appController.functions.processSignIn({ user: results?.signin });
      }
      else {
        setMessage("could_not_login");
      }

    }).catch(e => {
      setMessage("could_not_login");
    });
  }

  if (signUp) return (<div className="signUpWrapper"><SignUp username={signUp} cancel={() => setSignUp(false)} appController={appController} /></div>)
  if(loading) return <Spinner/>
  return <>
      <div className="loginGroup">
        <h5>{label("password_login")}</h5>
        <InputGroup>
          <InputGroupAddon addonType="prepend">
            <InputGroupText>
              👤
            </InputGroupText>
          </InputGroupAddon>
          <Input placeholder={label("username")} type="text" disabled={loadingButton} onChange={() => setNoSignUp(true)}
            id="username" />
        </InputGroup>
        <InputGroup>
          <InputGroupAddon addonType="prepend">
            <InputGroupText>
              🔑
            </InputGroupText>
          </InputGroupAddon>
          <Input
            id="password"
            placeholder={label("password")}
            onChange={() => setNoSignUp(true)}
            type="password"
            disabled={loadingButton}
            autoComplete="off"
            onKeyUp={(e) => {
              if (e.key === "Enter") loginwithpassword(setMessage, setLoadingButton)
            }}
          />
        </InputGroup>
        <div className="Login">
          <Button className={"login"} onClick={() => loginwithpassword(setMessage, setLoadingButton)}>{label(loadingButton ? "logging_in" : "login")}</Button>
          <Button  className={"login"} onClick={e => setSignUp(document.getElementById("username").value || true)} >{label("signup")}</Button>
        </div>
        {message ? <Alert color="danger" fade={true}>⚠️ {label(message)}</Alert> : null}
      </div>

    <SocialSignIn appController={appController} cancel={() => { }} setLoading={setLoading} /></>
}
//{process.env.GOOGLE_CLIENTID}  {process.env.FACEBOOK_APPID}