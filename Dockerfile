ARG NODE_VERSION=18.16.0
FROM node:${NODE_VERSION}-alpine

ARG COMMIT_ID
ENV MY_COMMIT_ID=$COMMIT_ID 
WORKDIR /usr/src/app
COPY . .
ARG PORT=5005
ENV PORT=$PORT
EXPOSE $PORT

RUN cd frontend/webapp/public && echo $(date) > build.txt && echo ${MY_COMMIT_ID:-"unknown"} >> build.txt
RUN npm install -g typescript forever && \
cd frontend/webapp && npm install react-app-rewired sass && npm run build && cd ../.. && \
npm install && tsc -p tsconfig.build.json

CMD ["forever", "./dist/index.js"]