import { label } from "src/models/Utils";
import { Button } from "reactstrap";
import { GoogleLogin } from '@react-oauth/google';
import NaverLogin from "react-login-by-naver"
import KakaoLogin from "react-kakao-login";

import naver from "./svg/naver.svg"
import kakao from "./svg/kakao.svg"
import ReactPixel from 'react-facebook-pixel';
import BoMOnlineAPI, { fbPixel } from "src/models/BoMOnlineAPI";
import "./SignIn.css"
import { error } from "src/models/alertMessageService";
import { useAppController } from "src/contexts/AppControllerContext";



export default function SocialSignIn({setLoading}) {
    const appController = useAppController();

    const socialResponse = async (social_token,network) => {
        let token = localStorage.getItem("token");
        setLoading(true);
        let loginResult = await BoMOnlineAPI({socialsignin:{network,token,social_token}},{useCache:false});
        setLoading(false);
        if(loginResult.socialsignin?.isSuccess)
        {
            appController.functions.socialSignIn(loginResult.socialsignin);
            
            ReactPixel.trackSingle(fbPixel, 'track', 'CompleteRegistration'); 
        }
        else
        {
            error(label("network_failure"));
        }
    }
    
    const responseGoogle = (response) => {
        const {credential} = response;
        if(!credential) return console.warn("No credential provided by Google login");
        return socialResponse(credential,"google");
    }

    const responseNaver = ({accessToken}) => {
        return socialResponse(accessToken,"naver");
    
    };
    const responseKakao = ({response}) => {
        return socialResponse(response.access_token,"kakao");
    
    };

    window.responseNaver = responseNaver;
    return  <div className="loginGroup">
            <h5>{label("social_login")}</h5>
            <div className="Social2">
                <KakaoLogin
                    token={"8b6072cf120c9e72da6e1b83d5fff175"}
                    onSuccess={responseKakao}
                    onFail={console.error}
                    onLogout={console.info}
                    render={({ onClick }) => {

                        return <Button className={"kakao"} onClick={(e) => {
                            e.preventDefault();
                            onClick();
                        }}><img src={kakao} /> {label("kakao")}</Button>

                    }}
                />
                <NaverLogin
                    clientId="1jk7eDpPsnozqZtVhUxH"
                    callbackUrl={`${window.location.protocol}//${window.location.host}/naver.html`}
                    render={(props) => <Button className={"naver"} onClick={props.onClick}><img src={naver} /> {label("naver")}</Button>}
                />
            </div><div className="Social">
                <GoogleLogin
                    onSuccess={responseGoogle}
                    text="signin_with"
                />
            </div>
        </div>
}