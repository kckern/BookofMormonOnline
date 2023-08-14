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
import BoMOnlineAPI from "src/models/BoMOnlineAPI";

export default function EditProfile({ setProfileState, appController }) {


    const editProfile = ()=>{

        document.querySelector(".savebutton").innerHTML = label("saving");

        let input = {
            token: appController.states.user.token,
            name: document.querySelector("input[name=name]")?.value,
            email: document.querySelector("input[name=email]")?.value,
            zip: document.querySelector("input[name=zip]")?.value
        }

        //set Saving
        BoMOnlineAPI(
            {editProfile:input}, 
            { useCache: false }).then(response=>{
                appController.functions.editProfile(response.editProfile);
                setProfileState("profile");
            });
    }

    return <Card>
        <CardHeader>
            <h5 className="title">✏️ {label("edit_profile")}</h5>
        </CardHeader>
        <CardBody>
            <CardBody>
                <InputGroup>
                    <InputGroupAddon addonType="prepend">
                        <InputGroupText>
                            👤
                        </InputGroupText>
                    </InputGroupAddon>
                    <Input value={appController.states.user.user} type="text" disabled />
                </InputGroup>
                <InputGroup>
                    <InputGroupAddon addonType="prepend">
                        <InputGroupText>
                            🏷️
                        </InputGroupText>
                    </InputGroupAddon>
                    <Input placeholder={label("name")} defaultValue={appController.states.user.name} type="text" name="name" />
                </InputGroup>
                <InputGroup>
                    <InputGroupAddon addonType="prepend">
                        <InputGroupText>
                            ✉️
                        </InputGroupText>
                    </InputGroupAddon>
                    <Input placeholder={label("email")} defaultValue={appController.states.user.email} type="text" name="email"  />
                </InputGroup>
                <InputGroup>
                    <InputGroupAddon addonType="prepend">
                        <InputGroupText>
                            📍
                        </InputGroupText>
                    </InputGroupAddon>
                    <Input placeholder={label("zip_code")} defaultValue={appController.states.user.zip} type="text"  name="zip" />
                </InputGroup>

                <div className="Login">
                    <Button className={"login savebutton"} onClick={editProfile}>{label("save")}</Button>
                    <Button className={"login"} onClick={() => setProfileState("profile")}>{label("cancel")}</Button>
                </div>
            </CardBody>
        </CardBody>
    </Card>

}