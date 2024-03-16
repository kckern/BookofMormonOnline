import React, { useState, useEffect } from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { playSound } from "src/models/Utils";
import StudyGroupHangUp from "./StudyGroupHangUp.svg";


export function CallCircle({ appController }) {
    const [participants, setParticipants] = useState(
        appController?.states?.studyGroup?.activeCall?._participantCollection?._remoteParticipants || []
    ); //inCall, noCall, isCall, limbo
    const [callState, setCallState] = useState(() => {
        let othersInCall = numberOfOthersInCall(participants, appController);
        return (othersInCall > 0) ? "isCall" : "noCall";
    }
    );
    let playSounds = appController.states.preferences.sound;

    const [playLocalJoined] = useState(
        new Audio(`${assetUrl}/interface/audio/LocalJoined`)
    );
    const [playLocalLeft] = useState(
        new Audio(`${assetUrl}/interface/audio/LocalLeft`)
    );
    const [playRemoteJoined] = useState(
        new Audio(`${assetUrl}/interface/audio/RemoteJoined`)
    );
    const [playRemoteLeft] = useState(
        new Audio(`${assetUrl}/interface/audio/RemoteLeft`)
    );
    const [playOngoingCall] = useState(
        new Audio(`${assetUrl}/interface/audio/CallOngoing`)
    );

    if (callState === "isCall" && participants.length === 0) setCallState("noCall");
    if (callState === "isCall") if (playSounds) playSound(playOngoingCall);//.play();
		useEffect(()=>{
			const getLiveRoom  = async()=>{
				const activeGroupMembers = appController.states.studyGroup.activeGroup?.members;
				if(activeGroupMembers!==undefined && activeGroupMembers?.length !== 1){
					const mainUser = appController.states.user;
					const queryParams = {
						userIdsFilter:[activeGroupMembers.filter(member=>member.userId !== mainUser.social.user_id)[0]?.userId]
					}
					const query = appController.sendbird.sb.createApplicationUserListQuery(queryParams);
			
					const queryUsers = await query.next();
					if(queryUsers[0].metaData.activeCall && callState === 'noCall'){
						setParticipants(queryUsers);
					}else if(!queryUsers[0].metaData.activeCall && callState === 'noCall'){
						setParticipants([])
					}else if(!queryUsers[0].metaData.activeCall && callState === 'isCall'){
						setCallState('noCall');
					}
				}
			}

			const interval = setInterval(getLiveRoom,1000);
			return ()=>{
				clearInterval(interval);
			}
		},[appController?.states?.studyGroup?.activeCall])

    useEffect(() => {
        if (appController?.states?.studyGroup?.activeCall?.autostart) enterCall();
    }, [appController?.states?.studyGroup?.activeCall?.autostart, appController?.states?.studyGroup?.activeCall?.roomId]);

    useEffect(() => {
        if (callState === "coolDown")
            setTimeout(
                () => setCallState(participants?.length ? "wasCall" : "noCall"),
                2000
            );
        if (callState === "warmUp") setTimeout(() => setCallState("inCall"), 2000);
        if (callState === "isCall") if (playSounds) playSound(playOngoingCall)//.play();
    }, [callState]);

    useEffect(() => {
        let newP = appController?.states?.studyGroup?.activeCall?._participantCollection?._remoteParticipants;
        setParticipants(newP || []);
        if (callState === "inCall") return false; ///
        let othersInCall = numberOfOthersInCall(newP, appController);
        let newCallStateVal = (othersInCall > 0) ? callState !== "wasCall" ? callState : "isCall" : "noCall";
        setCallState(newCallStateVal);
    }, [appController?.states?.studyGroup?.activeCall?._participantCollection?._remoteParticipants.length]);



    useEffect(() => {
        if (!appController?.states?.studyGroup?.activeCall?.roomId) return null;
        let newP = appController?.states?.studyGroup?.activeCall?._participantCollection?._remoteParticipants;
        setParticipants(newP || []);
        let othersInCall = numberOfOthersInCall(newP, appController);
        let newCallStateVal = (othersInCall > 0) ? "isCall" : "noCall";
        setCallState(newCallStateVal);

        appController?.states?.studyGroup?.activeCall.removeAllEventListeners();
        appController?.states?.studyGroup?.activeCall.on(
            "remoteParticipantEntered",
            (participant) => {
                // Called when a remote participant has entered the room.
                setParticipants(
                    appController?.states?.studyGroup?.activeCall?._participantCollection?._remoteParticipants
                );
                if (playSounds) playSound(playRemoteJoined)//.play();
                appController.sendbird?.fetchRoomFromGroup(appController.states.studyGroup.activeGroup, " StudyGroupCall useEffect")
                    .then((room) => appController.functions.setActiveCall(room));
            }
        );
        appController?.states?.studyGroup?.activeCall.on(
            "remoteParticipantExited",
            (participant) => {
                // Called when a remote participant has exited the room.
                setParticipants(
                    appController?.states?.studyGroup?.activeCall?._participantCollection?._remoteParticipants
                );
                if (playSounds) playSound(playRemoteLeft)//.play();
                appController.sendbird?.fetchRoomFromGroup(appController.states.studyGroup.activeGroup, "useEffect - roomId")
                    .then((room) => appController.functions.setActiveCall(room));
            }
        );
        appController?.states?.studyGroup?.activeCall.on(
            "remoteParticipantStreamStarted",
            (participant) => {
                const remoteMediaview = document.createElement('audio');
                remoteMediaview.autoplay = true;
                participant.setMediaView(remoteMediaview);
            }
        );
        setParticipants(
            appController?.states?.studyGroup?.activeCall?._participantCollection?._remoteParticipants
        );
        setCallState(participants?.length ? "isCall" : "noCall");
    }, [appController?.states?.studyGroup?.activeCall?.roomId]);

    if (!appController?.states?.studyGroup?.activeCall)
        return (
            <div className={"callCircle loading"}>
                <span></span>
            </div>
        );

    const enterCall = () => {
        setCallState("limbo");
        try {
            const enterParams = {
                videoEnabled: false,
                audioEnabled: true,
            };
            appController.states.studyGroup.activeCall
                .enter(enterParams)
                .then((room) => {
                    // User has successfully entered `room`.
                    setCallState("warmUp");
                    if (playSounds) playSound(playLocalJoined)//.play();
                    appController?.states?.studyGroup?.activeCall.setAudioForLargeRoom(document.getElementById("call_audio"))
                    setParticipants(
                        appController?.states?.studyGroup?.activeCall?._participantCollection
                    );
                    appController.sendbird?.updateUserState({
                        channels: appController.states.studyGroup.groupList,
                        activeCall: appController?.states?.studyGroup?.activeCall?.roomId,
                        key: "enterCall"
                    });
                })
                .catch((e) => {
                    // Handle error.
                    if (e.code === 1400122) {
                        exitCall();
                        enterCall();
                    }
                });
        } catch (e) { }
    };

    const exitCall = (e) => {
        e?.preventDefault();
        setCallState("limbo");
        try {
            appController.states.studyGroup.activeCall.exit(); // Participant has exited the room successfully.
            setCallState("coolDown");
            if (playSounds) playSound(playLocalLeft)//.play();
            setParticipants(
                appController?.states?.studyGroup?.activeCall?.participants
            );
            appController.sendbird?.updateUserState({
                channels: appController.states.studyGroup.groupList,
                activeCall: "",
                key: "exitCall"
            });
        } catch (error) {
            console.log("exitCall.ERROR", { error });
            // Error is thrown because the participant has not entered the room.
        }
    };

    if (participants?.length && callState === "noCall") {
        setCallState(participants?.length ? "isCall" : "noCall");
    }

    if (callState === "limbo")
        return (
            <div className={"callCircle " + callState}>
                <span>⋯</span>
            </div>
        );

    if (callState === "coolDown")
        return (
            <div className={"callCircle " + callState}>
                <span>✖️</span>
            </div>
        );
    if (["isCall", "wasCall"].includes(callState))
        return (
            <div onClick={enterCall} className={"callCircle " + callState}>
                <span>📞</span>
            </div>
        );

    if (["inCall", "warmUp"].includes(callState))
        return (
            <div className={"callCircle " + callState}>
                <svg
                    id="wave"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 50 38.05"
                >
                    <path
                        id="Line_1"
                        data-name="Line 1"
                        d="M0.91,15L0.78,15A1,1,0,0,0,0,16v6a1,1,0,1,0,2,0s0,0,0,0V16a1,1,0,0,0-1-1H0.91Z"
                    />
                    <path
                        id="Line_2"
                        data-name="Line 2"
                        d="M6.91,9L6.78,9A1,1,0,0,0,6,10V28a1,1,0,1,0,2,0s0,0,0,0V10A1,1,0,0,0,7,9H6.91Z"
                    />
                    <path
                        id="Line_3"
                        data-name="Line 3"
                        d="M12.91,0L12.78,0A1,1,0,0,0,12,1V37a1,1,0,1,0,2,0s0,0,0,0V1a1,1,0,0,0-1-1H12.91Z"
                    />
                    <path
                        id="Line_4"
                        data-name="Line 4"
                        d="M18.91,10l-0.12,0A1,1,0,0,0,18,11V27a1,1,0,1,0,2,0s0,0,0,0V11a1,1,0,0,0-1-1H18.91Z"
                    />
                    <path
                        id="Line_5"
                        data-name="Line 5"
                        d="M24.91,15l-0.12,0A1,1,0,0,0,24,16v6a1,1,0,0,0,2,0s0,0,0,0V16a1,1,0,0,0-1-1H24.91Z"
                    />
                    <path
                        id="Line_6"
                        data-name="Line 6"
                        d="M30.91,10l-0.12,0A1,1,0,0,0,30,11V27a1,1,0,1,0,2,0s0,0,0,0V11a1,1,0,0,0-1-1H30.91Z"
                    />
                    <path
                        id="Line_7"
                        data-name="Line 7"
                        d="M36.91,0L36.78,0A1,1,0,0,0,36,1V37a1,1,0,1,0,2,0s0,0,0,0V1a1,1,0,0,0-1-1H36.91Z"
                    />
                    <path
                        id="Line_8"
                        data-name="Line 8"
                        d="M42.91,9L42.78,9A1,1,0,0,0,42,10V28a1,1,0,1,0,2,0s0,0,0,0V10a1,1,0,0,0-1-1H42.91Z"
                    />
                    <path
                        id="Line_9"
                        data-name="Line 9"
                        d="M48.91,15l-0.12,0A1,1,0,0,0,48,16v6a1,1,0,1,0,2,0s0,0,0,0V16a1,1,0,0,0-1-1H48.91Z"
                    />
                </svg>
                <img
                    onClick={exitCall}
                    src={StudyGroupHangUp}
                    alt={"hangUp"}
                    className={"hangUp"}
                />
                <Timer
                    timeStamp={
                        appController.states.studyGroup.activeCall?.localParticipant
                            ?.enteredAt
                    }
                />
            </div>
        );

    //setCallState(((participants?.length) ? "isCall" : "noCall"));

    function numberOfOthersInCall(participants, appController) {
        let notMeParticipants = participants?.filter(part => part.user?.userId !== appController.states.user.social?.user_id);

        return 0 + notMeParticipants?.length;
    }

    return (
        <div onClick={enterCall} className={"callCircle " + callState}>
            📞
        </div>
    );
}

function Timer({ timeStamp }) {
    const [HMS, setHMS] = useState(0);

    useEffect(() => {
        setTimeout(() => {
            var date = new Date(null);
            date.setSeconds((Date.now() - timeStamp) / 1000); // specify value for SECONDS here
            try {

                var result = date.toISOString().substr(14, 5);
                setHMS(result);
            } catch (e) { }
        }, 1000);
    }, [HMS]);

    if (!timeStamp) return null;
    if (HMS === 0) return null;

    return <div className={"timer"}>{HMS}</div>;
}