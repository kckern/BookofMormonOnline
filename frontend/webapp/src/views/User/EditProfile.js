import "./User.css";
import React, { useState, useEffect, useCallback } from "react";
import {
    Button,
    Card,
    CardHeader,
    CardBody,
    Input,
    InputGroupText,
    InputGroup,
    Alert
} from "reactstrap";
import { label } from "src/models/Utils";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { useAppController } from "src/contexts/AppControllerContext";

export default function EditProfile({ setProfileState }) {
    const appController = useAppController();

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
                        <InputGroupText>
                            👤
                        </InputGroupText>
                    <Input value={appController.states.user.user} type="text" disabled />
                </InputGroup>
                <InputGroup>
                        <InputGroupText>
                            🏷️
                        </InputGroupText>
                    <Input placeholder={label("name")} defaultValue={appController.states.user.name} type="text" name="name" />
                </InputGroup>
                <InputGroup>
                        <InputGroupText>
                            ✉️
                        </InputGroupText>
                    <Input placeholder={label("email")} defaultValue={appController.states.user.email} type="text" name="email"  />
                </InputGroup>
                <InputGroup>
                        <InputGroupText>
                            📍
                        </InputGroupText>
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