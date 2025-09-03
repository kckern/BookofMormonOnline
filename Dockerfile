ARG NODE_VERSION=18.16.0
FROM node:${NODE_VERSION}-alpine

ARG COMMIT_ID
ENV MY_COMMIT_ID=$COMMIT_ID 
WORKDIR /usr/src/app
COPY . .
ARG PORT=5005
ENV PORT=$PORT
EXPOSE $PORT

RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/America/Los_Angeles /etc/localtime && \
    echo "America/Los_Angeles" > /etc/timezone
RUN cd frontend/webapp/public && date > build.txt && echo ${MY_COMMIT_ID:-"unknown"} >> build.txt
RUN cd frontend/webapp/public && sed -i "s/{{BUILD_VERSION}}/${MY_COMMIT_ID:-unknown}/g" sw.js
RUN npm install -g typescript forever && \
cd frontend/webapp && npm install react-app-rewired sass && npm run build && cd ../.. && \
npm install && tsc -p tsconfig.build.json

CMD ["forever", "./dist/index.js"]