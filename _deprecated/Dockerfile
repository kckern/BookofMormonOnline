ARG NODE_VERSION=18.16.0
FROM node:${NODE_VERSION}-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies first (cached unless package.json changes)
COPY package*.json ./
COPY frontend/webapp/package*.json ./frontend/webapp/
RUN npm install -g typescript
RUN npm install
RUN cd frontend/webapp && npm install react-app-rewired sass

# Now copy source (only this layer invalidates on code changes)
ARG COMMIT_ID
ENV MY_COMMIT_ID=$COMMIT_ID
COPY . .

# Build
RUN cd frontend/webapp/public && date > build.txt && echo ${MY_COMMIT_ID:-"unknown"} >> build.txt
RUN cd frontend/webapp/public && sed -i "s/{{BUILD_VERSION}}/${MY_COMMIT_ID:-unknown}/g" sw.js
RUN cd frontend/webapp && npm run build
RUN tsc -p tsconfig.build.json

# Production stage - smaller final image
FROM node:${NODE_VERSION}-alpine

WORKDIR /usr/src/app
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/America/Los_Angeles /etc/localtime && \
    echo "America/Los_Angeles" > /etc/timezone
RUN npm install -g forever

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/frontend/webapp/build ./frontend/webapp/build
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

ARG PORT=5005
ENV PORT=$PORT
EXPOSE $PORT

CMD ["forever", "./dist/index.js"]
