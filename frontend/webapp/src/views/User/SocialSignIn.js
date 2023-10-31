import { label } from "src/models/Utils";
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
import FacebookLogin from 'react-fb-login-component/dist/facebook-login-render-props';
import { GoogleLogin, useGoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import NaverLogin from "react-login-by-naver"
import KakaoLogin from "react-kakao-login";

import facebook from "./svg/facebook.svg"
import google from "./svg/google.svg"
import naver from "./svg/naver.svg"
import kakao from "./svg/kakao.svg"
import ReactPixel from 'react-facebook-pixel';
import BoMOnlineAPI, { fbPixel } from "src/models/BoMOnlineAPI";
import "./SignIn.css"
import { error } from "src/models/alertMessageService";



export default function SocialSignIn({appController, setLoading}) {

    const login = useGoogleLogin({
        onSuccess: tokenResponse => console.log(tokenResponse),
        flow: 'auth-code',
      });
      
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
            console.log({network,token,social_token,loginResult})
            error(label("network_failure"));
        }
    }
    
    const responseFacebook = (response) => {
        console.log(response)
        const {accessToken} = response;
        if(!accessToken) return console.log("⚠️ No Access Token Provided by Facebook Login!");
        return socialResponse(accessToken,"facebook");
    }

    const responseGoogle = (response) => {
        const {credential} = response;
        if(!credential) return console.log("⚠️ No Access Token Provided by Google Login!");
        return socialResponse(credential,"google");
    }

    const responseNaver = ({accessToken}) => {
        console.log({accessToken})
        return socialResponse(accessToken,"naver");
    
    };
    const responseKakao = ({response}) => {
        return socialResponse(response.access_token,"kakao");
    
    };

    window.responseNaver = responseNaver;
    return  <div className="loginGroup">
            <h5>{label("social_login")}</h5>
            {false ? null : <>
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
                    //onSuccess={(naverUser) => console.log(naverUser)}
                    //onFailure={(result) => console.error(result)}
                />
            </div><div className="Social">
                {false && <FacebookLogin
                    appId={"806253479718989"}
                    autoLoad={false}
                    callback={responseFacebook}
                    disableMobileRedirect={true}
                    render={renderProps => (
                        <Button onClick={renderProps.onClick} className={"facebook"}><img src={facebook} /> {label("facebook")}</Button>
                    )}
                />}
                <GoogleLogin
                    onSuccess={responseGoogle}
                    text="signin_with"
                >
                    <Button onClick={login} className={"google"}><img src={google} /> {label("google")}</Button>
                </GoogleLogin>
            </div></>}
        </div>
}