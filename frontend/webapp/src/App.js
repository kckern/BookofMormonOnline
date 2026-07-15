import React from "react";
import { Router } from 'react-router';
import { Route } from 'react-router-dom';
import { toast, ToastContainer } from "react-toastify";
import { createBrowserHistory } from 'history';
import Cookies from 'js-cookie';

import "react-toastify/dist/ReactToastify.css";
import "bootstrap/dist/css/bootstrap.css";
import "./assets/theme/scss/paper-dashboard.scss";
import "./assets/theme/scss/darkmode.scss";
// Imported AFTER the global stylesheets above so the app-shell CSS (Header/Sidebar
// nav, imported transitively by Main) loads last and wins the cascade — matching
// the order that held when MainLayout was a lazy chunk. Importing it before these
// sheets lets bootstrap/paper-dashboard/darkmode override the nav styling.
import MainLayout from "./views/_Common/Main";
//import Cohere from "cohere-js";
import crypto from "crypto-browserify";
import { AppModal } from "./views/_Common/AppModal";
import { GoogleOAuthProvider } from "@react-oauth/google";

const base64EncodedString = atob("NDA1MDg5ODg1Nzg3LWk5ODJoaW85M2xhYmJjY29jMWRvamhsYzF1aW5ubXN2LmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29t");

const  REACT_APP_GOOGLE_CLIENT_ID  = process.env.REACT_APP_GOOGLE_CLIENT_ID || base64EncodedString;


const history = createBrowserHistory();

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
        <Router history={history}>
          <MainLayout />
        </Router>
      </GoogleOAuthProvider>
    </>
  );
}
