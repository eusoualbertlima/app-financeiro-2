import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
            },
            {
                protocol: "https",
                hostname: "*.googleusercontent.com",
            },
        ],
    },
};

const sentryOptions = {
    silent: true,
};

if (process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
    sentryOptions.authToken = process.env.SENTRY_AUTH_TOKEN;
    sentryOptions.org = process.env.SENTRY_ORG;
    sentryOptions.project = process.env.SENTRY_PROJECT;
}

export default withSentryConfig(nextConfig, sentryOptions);
