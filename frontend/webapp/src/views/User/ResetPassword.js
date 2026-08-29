import React, { useState } from "react";
import { Alert, Button, Card, CardBody, CardHeader, Input, InputGroup } from "reactstrap";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [success, setSuccess] = useState(false);

  const submit = async () => {
    if (!token) return setMessage("invalid_or_expired_token");
    if (password !== confirmation) return setMessage("password_no_match");
    setLoading(true);
    try {
      const result = await BoMOnlineAPI({ resetPassword: { token, password } }, { useCache: false });
      if (result?.resetPassword?.isSuccess) {
        setSuccess(true);
        setMessage(null);
      } else {
        setMessage(result?.resetPassword?.msg || "invalid_or_expired_token");
      }
    } catch {
      setMessage("invalid_or_expired_token");
    } finally {
      setLoading(false);
    }
  };

  return <Card className="loginGroup">
    <CardHeader><h5>{label("reset_password")}</h5></CardHeader>
    <CardBody>
      {success ? <Alert color="success">{label("password_reset_success")}</Alert> : <>
        <p>{label("reset_password_instructions")}</p>
        <InputGroup><Input type="password" autoComplete="new-password" value={password}
          onChange={(event) => setPassword(event.target.value)} placeholder={label("new_password")} /></InputGroup>
        <InputGroup><Input type="password" autoComplete="new-password" value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)} placeholder={label("confirm_password")} /></InputGroup>
        <div className="Login"><Button className="login" onClick={submit} disabled={loading}>{label("reset_password")}</Button></div>
      </>}
      {message ? <Alert color="danger">{label(message)}</Alert> : null}
      <Link to="/home/user">{label("back_to_login")}</Link>
    </CardBody>
  </Card>;
}
