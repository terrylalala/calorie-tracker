/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Router Route Handlers (app/api/*) stream the request body and do not
  // impose the old 4MB Pages API limit, so downscaled base64 photos are fine
  // with the defaults. No extra config needed.

  // Next's dev overlay badge defaults to bottom-left, where it sits on top of
  // the first tab in the bottom nav and makes it unclickable while developing.
  // Development only — this badge never renders in a production build, so it
  // has no effect on the deployed app.
  devIndicators: {
    position: "top-left",
  },
};

export default nextConfig;
