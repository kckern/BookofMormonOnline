
import "./User.css";
import React, { useState, useEffect, useCallback } from "react";
import {
    Button,
    Card,
    CardHeader,
    CardBody,
    Input,
    InputGroupAddon,
    InputGroupText,
    InputGroup,
    Alert
} from "reactstrap";
import { label } from "src/models/Utils";
import { toast } from "react-toastify";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
export function ChangePassword({ setProfileState, appController }) {

    const pwRegEx = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$%^&*{};.,'_-]).{8,}$/;

    const changePassword = ()=>{

        let pass1 = document.querySelector("input[name=pass1]")?.value;
        let pass2 = document.querySelector("input[name=pass2]")?.value;

        if(!pwRegEx.test(pass1)) return toast.error(label("pasword_requirements"));
        if(pass1!==pass2) return toast.error(label("password_no_match"));

        document.querySelector(".savebutton").innerHTML = label("saving");

        let input = {
            token: appController.states.user.token,
            password: pass1
        }

        //set Saving
        BoMOnlineAPI(
            {changePassword:input}, 
            { useCache: false }).then(response=>{
                if(response.changePassword) {
                    toast.info("new_password_saved");
                    setProfileState("profile");
                }
                else toast.error(label("could_not_change_password"));
            });
    }

    return <Card>
    <CardHeader>
      <h5 className="title">🔒 {label("change_password")}</h5>
    </CardHeader>
    <CardBody>
    <CardBody>
        <InputGroup>
            <InputGroupAddon addonType="prepend">
                <InputGroupText>
                    🔑
                </InputGroupText>
            </InputGroupAddon>
            <Input
                placeholder={label("new_password")}
                name="pass1"
                type="password"
                autoComplete="off"
            />
        </InputGroup>
        <InputGroup>
            <InputGroupAddon addonType="prepend">
                <InputGroupText>
                    🔑
                </InputGroupText>
            </InputGroupAddon>
            <Input
                placeholder={label("confirm_password")}
                type="password"
                name="pass2"
                autoComplete="off"
            />
        </InputGroup>
        <div className="Login">
            <Button className={"login savebutton"} onClick={changePassword}>{label("save")}</Button>
            <Button className={"login"} onClick={() => setProfileState("profile")}>{label("cancel")}</Button>
        </div>

    </CardBody>
    </CardBody>
  </Card>

}