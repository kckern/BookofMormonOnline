import "./User.css";
import React, { useState, useEffect, useCallback } from "react";
import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  Alert,
  CardBody,
  Input,
  InputGroupAddon,
  InputGroupText,
  InputGroup,
} from "reactstrap";
import { label } from "src/models/Utils";
import BoMOnlineAPI, { fbPixel } from "src/models/BoMOnlineAPI";
import ReactPixel from 'react-facebook-pixel';
const pwRegEx = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*{};.,'_-]).{8,}$/;
const emailRegEx = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export function SignUp({ username, cancel, callback, appController }) {


  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const sign_up = ( setMessage, setDisabled) => {
    
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;
    let name = document.getElementById("name").value;
    let email = document.getElementById("email").value;
    let zip = document.getElementById("zip").value;
    let token = localStorage.getItem("token");
    setDisabled(true);
    BoMOnlineAPI({ signup: { username, password, token, name, email, zip } }).then(results => {

      setDisabled(false);
      if (!results?.signup?.isSuccess) {
        setMessage(results?.signup?.msg);
      }
      else if (results?.signup?.user) {
        ReactPixel.trackSingle(fbPixel, 'track', 'CompleteRegistration'); 
        window.clicky?.goal("signup");
        appController.functions.processSignIn({ user: results?.signup, callback: callback });
      }
      else {
        setMessage("could_not_sign_up");
      }

    }).catch(e => {
      setMessage("could_not_login");
    });
  }



  const scrubUsername = (username) => {
    return username.toLowerCase().replace(/[^0-9a-z.-]/ig, '')
  }

  const [validatonMode, setValidationMode] = useState(false);
  const [readyToSubmit, setReady] = useState(false);

  const updateCondition = (key, val) => {
    if (val === undefined) val = true;
    if (val === "") val = false;
    setInputs(state => {
      state[key] = val
      let isReady = Object.values(state).every(x => x !== null && x !== false);
      setReady(isReady);
      return { ...state };
    }
    )
  }

  const handleChange = (key, e) => {
    let val = e.target.value;
    if (key === "username") {
      e.target.value = scrubUsername(val);
      updateCondition("username")
    }
    if (key === "name") updateCondition("name", val);
    if (key === "email") updateCondition("email", emailRegEx.test(val));
    if (key === "pass") {
      updateCondition("pass_val", val);
      updateCondition("pass", pwRegEx.test(val));
    }
    if (key === "pass2") {
      updateCondition("pass_match", inputs.pass_val === val);
    }

  }

  const [inputs, setInputs] = useState({
    username: null,
    pass: null,
    pass_val: null,
    pass_match: null,
    email: null,
    name: null
  })

  const validateForm = () => {
    setValidationMode(true);
  }

  if(username===true) username=null;

  return <>
      <h5>{label("sign_up")}</h5>
      <div className="helpmsg">{label("privacy_policy_review_x", [<Link to="/about/privacy">{label("privacy_policy")}</Link>])}</div>
      <InputGroup className={(validatonMode && !inputs.username) ? "req" : null}>
        <InputGroupAddon addonType="prepend">
          <InputGroupText>
            👤
          </InputGroupText>
        </InputGroupAddon>
        <Input id="username" placeholder={label("username")} defaultValue={username} disabled={loading} type="text" onChange={(e) => handleChange("username", e)} />
      </InputGroup>
      <InputGroup className={(validatonMode && !inputs.name) ? "req" : null}>
        <InputGroupAddon addonType="prepend">
          <InputGroupText>
            🏷️
          </InputGroupText>
        </InputGroupAddon>
        <Input id="name" placeholder={label("name")} disabled={loading} type="text" onChange={(e) => handleChange("name", e)} />
      </InputGroup>
      <InputGroup className={(validatonMode && !inputs.email) ? "req" : null}>
        <InputGroupAddon addonType="prepend">
          <InputGroupText>
            ✉️
          </InputGroupText>
        </InputGroupAddon>
        <Input id="email" placeholder={label("email")} disabled={loading} type="text" onChange={(e) => handleChange("email", e)} />
      </InputGroup>
      <InputGroup>
        <InputGroupAddon addonType="prepend">
          <InputGroupText>
            📍
          </InputGroupText>
        </InputGroupAddon>
        <Input id="zip" placeholder={label("zip_code")} disabled={loading} type="text" onChange={(e) => handleChange("zip", e)} />
      </InputGroup>
      <InputGroup className={(validatonMode && !inputs.pass) ? "req" : null}>
        <InputGroupAddon addonType="prepend">
          <InputGroupText>
            🔑
          </InputGroupText>
        </InputGroupAddon>
        <Input
          id="password"
          placeholder={label("password")}
          type="password"
          autoComplete="off" onChange={(e) => handleChange("pass", e)}
        />
      </InputGroup>
      <InputGroup className={(validatonMode && !inputs.pass_match) ? "req" : null}>
        <InputGroupAddon addonType="prepend">
          <InputGroupText>
            🔑
          </InputGroupText>
        </InputGroupAddon>
        <Input
          placeholder={label("confirm_password")}
          disabled={loading}
          type="password"
          autoComplete="off"
          onChange={(e) => handleChange("pass2", e)}
        />
      </InputGroup>
      <Validator inputs={inputs} />
      <div className="helpmsg">{label("tos_agree_x", [<Link to="/about/tos">{label("terms_of_service")}</Link>])} .</div>
      <div className="Login">
        <Button
          disabled={(!readyToSubmit && validatonMode)}
          className={"login"}
          onMouseEnter={validateForm}
          onClick={() => sign_up(setMessage, setLoading)}
        >
          {label("sign_up")}</Button>
        {cancel ? <Button className={"login"} onClick={cancel} >{label("cancel")}</Button> : null }
      </div>
      {message ? <Alert color="danger" fade={true}>⚠️ {label(message)}</Alert> : null}
    </>
}

function checkPasswords(inputs) {
  if (inputs.pass === false) return "🔑 " + label("pasword_requirements");
  if (inputs.pass_match === false) return "🔑 " + label("password_no_match");
  return null
}


function Validator({ inputs }) {

  let message = checkPasswords(inputs);

  if (!message) return null

  return <Alert color="warning" fade={true}>{message} </Alert>
}