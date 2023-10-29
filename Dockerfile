ARG NODE_VERSION=18.4.0
FROM node:${NODE_VERSION}-alpine



ARG COMMIT_ID
ENV MY_COMMIT_ID=$COMMIT_ID 
WORKDIR /usr/src/app
COPY . .
EXPOSE 5005

RUN cd frontend/webapp/public && echo $(date) > build.txt && echo $MY_COMMIT_ID >> build.txt
RUN npm install -g typescript forever && \
cd frontend/webapp && npm install react-app-rewired sass && npm run build && cd ../.. && \
npm install && tsc

CMD ["forever", "./.build/index.js"]