# BookofMormon.Online

This repository hosts the source code for the BookofMormon.Online website, a versatile study resource that presents the Book of Mormon text accompanied by an array of supportive elements like narrative synopses, images, commentary, audio, etc.

## Overview

The application is full-stack, with a frontend built using React and a backend that uses a combination of Apollo GraphQL server for handling POST requests and Express.js for GET requests and serving static files.

## Architecture

The application's primary frontend is a React.js based single-page application. The codebase is found in the `frontent/webapp` subdirectory. It's built into a single, production-optimized flat file repository containing all the required HTML, CSS, and JS assets and served statically by the backend server.

The backend is a Node.js application that uses a combination of ExpressJS Apollo GraphQL server. The codebase is found in the `src` subdirectory. The backend is responsible for:
 - Serving the frontend static files
 - Connecting to the database
 - Handling GraphQL POST requests

The server connects to an AWS RDS database, running MySQL, which is used to provide data for GraphQL responses.

## Getting Started

For initial setup and running the project you will need Node.js installed on your machine.  Optionally, you can also use Docker to build and deploy the application locally.

To get the application up and running after cloning the repository, follow these steps:

### Frontend
1. Navigate to the `frontend/webapp` subdirectory.
2. Run `npm install` to install the required dependencies for the frontend.
3. Run `npm start` to start the development server.
4. Navigate to `http://localhost:3000` in your browser to view the application.
5. In development mode, the application will point to the deployed development environent on dev.bookofmormon.online. The application is not designed to point to a local backend server in development mode.

### Backend
1. Contact mail@bookofmormononline.net for the `.env` files containing the dev database credentials.
2. Place the `.env` files in the root directory of the project.
3. Run `npm install` to install the required dependencies for the backend.
4. Run `npm start` to start the backend server.
5. Point your graphQL client (postman, insomnia, etc.) to `http://localhost:5000` to make requests to the backend.

## Local Docker Build (*nix Environments)
1. Ensure your `.env` file is the root directory of the project.
2. Make sure your `.env` file contains a  REGISTRY_ID variable.  This is the tag that will be used to identify the docker image.
3. Make sure you have Docker installed on your machine.
4. Run `sh docker.local.sh` to build the docker image and run the container.
5. Navigate to `http://localhost:5000` in your browser to view the application.


## Contributing

Interested contributors are welcomed. The application assumes a basic understanding of the following::

- Node.js environment
- React.js frontend development
- GraphQL and Apollo 
- Express.js

Before contributing, it is also recommended to take your time and familiarize yourself with the codebase. 

## Contact

For further inquiries, feel free to get in touch:

- Email: mail@bookofmormononline.net
- Twitter: @BkMormonOnline

## Licence
This project is licensed under MIT Liscense. For more information, please refer to the LICENSE file in this repository.

_Disclaimer: BookofMormon.Online is not an official production of The Church of Jesus Christ of Latter-day Saints._


