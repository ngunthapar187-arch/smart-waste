# SortWise deployment

SortWise is a static, browser-based waste sorting guide. The included Node.js server serves the app as a Render **Web Service** and exposes `/healthz` for Render health checks.

## Deploy to Render

1. Push this project to a GitHub, GitLab, or Bitbucket repository.
2. In Render, choose **New** → **Blueprint** and connect the repository containing `render.yaml`.
3. Review the `sortwise` web service and deploy it.

The Blueprint configures Node.js, runs `npm ci` to build and `npm start` to launch, and checks `/healthz`. Render supplies the listening port through `PORT`; no environment variables need to be added manually. Render serves the site over HTTPS, which is required for browser camera and microphone permissions on non-localhost sites.

Alternatively, create a Render **Web Service** directly with:

- Runtime: **Node**
- Build command: `npm ci`
- Start command: `npm start`
- Health check path: `/healthz`

Do not deploy this as a Render Static Site if you want to use the included Web Service setup.

## Run locally

Requires Node.js 22 or later.

```sh
npm start
```

Open `http://localhost:3000`. To run the server on another port, set `PORT` in the environment.

## Verify

```sh
npm test
```

The app's optional speech and camera recognition load browser APIs and third-party libraries at runtime; text-based sorting works without them. Camera and microphone use stays in the browser, subject to browser permissions and the providers' availability.
