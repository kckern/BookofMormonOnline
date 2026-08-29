import React, { useState } from "react";
import { Alert, Button, Input, InputGroup } from "reactstrap";
import { label } from "src/models/Utils";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

export default function AccountRecovery({ mode, cancel }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  const submit = async () => {
    if (!value.trim() || loading) return;
    setLoading(true);
    const operation = mode === "username" ? "requestAccountRecovery" : "requestPasswordReset";
    try {
      await BoMOnlineAPI({ [operation]: { email: value.trim() } }, { useCache: false });
      setComplete(true);
    } finally {
      setLoading(false);
    }
  };

  return <div className="loginGroup">
    <h5>{label(mode === "username" ? "forgot_username" : "forgot_password")}</h5>
    {complete ? <Alert color="info">{label("recovery_request_received")}</Alert> : <>
      <InputGroup>
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyUp={(event) => { if (event.key === "Enter") submit(); }}
          placeholder={label(mode === "username" ? "email" : "email_or_username")}
          autoComplete="email"
          disabled={loading}
        />
      </InputGroup>
      <div className="Login">
        <Button className="login" onClick={submit} disabled={loading}>
          {label("send_recovery_email")}
        </Button>
      </div>
    </>}
    <Button color="link" onClick={cancel}>{label("back_to_login")}</Button>
  </div>;
}
