import React, { lazy, Suspense, useEffect } from "react";
import { Router } from 'react-router';
import { Route } from 'react-router-dom';
import { toast, ToastContainer } from "react-toastify";
import { createBrowserHistory } from 'history';
import Cookies from 'js-cookie';

import Header from "./views/_Common/Header";
import "react-toastify/dist/ReactToastify.css";
import "bootstrap/dist/css/bootstrap.css";
import "./assets/theme/scss/paper-dashboard.scss";
//import Cohere from "cohere-js";
import crypto from "crypto-browserify";
import { AppModal } from "./views/_Common/AppModal";
import { GoogleOAuthProvider } from "@react-oauth/google";

const base64EncodedString = atob("NDA1MDg5ODg1Nzg3LWk5ODJoaW85M2xhYmJjY29jMWRvamhsYzF1aW5ubXN2LmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29t");

const  REACT_APP_GOOGLE_CLIENT_ID  = process.env.REACT_APP_GOOGLE_CLIENT_ID || base64EncodedString;


const history = createBrowserHistory();

const MainLayout = lazy(() => import("./views/_Common/Main"));
const containerStyle = {
  zIndex: 1999,
  top: "15%",
};
//Generate Device Token and Save to Local Storage
if (localStorage.getItem("token") === null) {
  let cookie = Cookies.get("u") || null;
  localStorage.setItem('token', cookie || crypto.createHash('md5').update(crypto.randomBytes(20).toString('hex')).digest("hex"));
  if (cookie) window.location.reload();
}
export default function App() {
  // LINE ADDED BY ME
  console.disableYellowBox = true;



  return (
    <>
      <ToastContainer autoClose={3000} style={containerStyle} limit={1} position={toast.POSITION.BOTTOM_LEFT} />
      <AppModal />
    <GoogleOAuthProvider clientId={REACT_APP_GOOGLE_CLIENT_ID}>
      <Suspense fallback={<Header />}>
        <Router history={history}>
          <MainLayout />
        </Router>
      </Suspense>
      </GoogleOAuthProvider>
    </>
  );
}
