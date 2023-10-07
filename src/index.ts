
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { ApolloServer } from 'apollo-server-express';
import { apollo_config } from './config/apollo';
import express from 'express';
import {handleSSR} from '../src/ssr/index.js';
import {requireSSR} from '../src/ssr/lib.js';
//import json_apis from  '../src/json/index.js';
import httpProxy from 'http-proxy';
import dns from 'dns';
import net from 'net';
import axios from 'axios';
import bodyParser from 'body-parser';
import { processSphinx } from './search/sphinx';
import {ping} from "../src/library/ping.js"
import {apis} from "../src/api/index.js"


const langs = process.env.LANGS?.split(',') || ['', 'en', 'ko', 'dev'];

var apiProxy = httpProxy.createProxyServer();
apiProxy.on('proxyRes', (proxyRes, req:any, res:any) => {
  if(proxyRes.statusCode > 200) {
    const reqheaders = req.headers;

    const curl = `curl -X ${req.method} "${req.url}" -H "Host: ${req.headers.host}" ${Object.keys(reqheaders).map(i=>`-H "${i}: ${reqheaders[i]}"`).join(" ")} ${req.body ? `-d '${JSON.stringify(req.body)}'` : ""}`;

    console.error(`[Proxy Error] ${proxyRes.statusCode}, ${req.method} ${req.url}`);
    const {statusCode, statusMessage,headers: proxiedHeaders} = proxyRes;
    res.status(500).send({proxy:"error",reqheaders,curl, statusCode, statusMessage, proxiedHeaders, req: {method: req.method, url: req.url}});
  }
});
apiProxy.on('error', (err, req, res:any) => {
  console.error(`[Proxy Communication Error] ${err.message}, ${req.method} ${req.url}`);
  res.status(500).json(err);
});



const findTarget = (req:any): string | boolean  => {


  const host = req.headers.host;
  let fwdTarget = "";
  const fwds = [
    ["ssr", process.env.PROXY_BOM_SSR],
    ["preview", process.env.PROXY_BOM_IMG],
    ["sg", process.env.PROXY_SCRIPTURE_GUIDE],
    ["translate", process.env.PROXY_TRANSLATE],
    ["scripture.guide", process.env.PROXY_SCRIPTURE_GUIDE]
    ];
  fwdTarget = fwds.find(([sub, target]) => (new RegExp(`^${sub}`,"i")).test(host))?.pop() || "";


  const isSSR = requireSSR(req);
  if(isSSR && !fwdTarget) return process.env.PROXY_BOM_SSR;


  return fwdTarget;
};

//FRONEND (GET): STATIC EXPRESS
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.all("/ping", ping);


app.use( (req, res, next) => {
  const target = String(findTarget(req));
  const host = req.headers.host;
  if(target) {

    const targetDomain = target.split("://").pop();
    //remove these headers:
    delete req.headers["range"];

    apiProxy.web(req, res, {target,
      autoRewrite: true,
      cookieDomainRewrite: targetDomain,
      changeOrigin: false});
  }
  else if(/\/sphinx/.test(req.url) || /^sphinx.*/.test(host)) {
    processSphinx(req, res);
  }else if(/\/network-check/.test(req.url)) {

    const query = req.query;
    const host = String(query.host || "google.com");
    const port = Number(query.port || 80);

   // console.log(host, port);

    dns.lookup(host, (err, address, family) => {
      if(err) return res.json({err, host, port, msg:`${host} is not discovered on the network`});
        const socket = new net.Socket();

        const start = new Date();
        socket.connect(port, address);
        socket.setTimeout(5000);
        socket.on('timeout', () => {
          console.log(`Port ${port} is closed on ${host}`);
          res.json({host, port, msg:`❌ ${host} is NOT listening on port ${port}`});
          socket.destroy();
        });

        socket.on('connect', () => {
          const millisTaken = new Date().getTime() - start.getTime();
          console.log(`Port ${port} is open on ${host}. Ping: ${millisTaken}ms`);
          socket.destroy();
          //get headers from axios
          axios.get(`http://${host}:${port}`,{timeout: 5000}).then((response) => {
            const headers = response.headers;
            res.json({host, port, millisTaken, msg:`🟢 ${host} is listening on port ${port}, 🟢 and http call succeeded.`,headers});
          }).catch((err) => {

            res.json({host, port, millisTaken, msg:`🟢 ${host} is listening on port ${port}, ❌ but http call failed.`,err});
          });


      }).on('error', (err) => {
          console.log(`Port ${port} is closed on ${host}`);
          res.json({err, host, port, msg:`❌ ${host} is NOT listening on port ${port}`});
      });
    });
   } else next();
});





const frontends = ["webapp", "game", "welcome"];

//FRONTEND (GET): STATIC EXPRESS
frontends.forEach(i=>{
  const frontendPath = `frontend/${i}/build`;
  app.use('/', express.static(frontendPath));
  app.use('/static', express.static(path.join(frontendPath, 'static')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(frontendPath, 'index.html'));
  });
});

//BACKEND (POST) JSON APIS
//Object.keys(json_apis).forEach(i=>app.post(`/${i}`, json_apis[i]));

const apiPaths = Object.keys(apis);
apiPaths.forEach((i:any)=>app.post(`/${i}`, apis[i]));



//BACKEND (POST): APOLLO SERVER
const server = new ApolloServer(apollo_config);
const { sequelize } = apollo_config;
server.start().then(() => {
  ["",...langs].map(i => server.applyMiddleware({ app, path: `/${i}` }));
  app.listen(process.env.PORT, async () => {
    try {
      await sequelize.authenticate();
      console.log('Sequelize initiated.');
      console.log(`Listening on port ${process.env.PORT}`);
    } catch (err) {
      console.log('Sequelize init failed', err);
    }
  });
});
