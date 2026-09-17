This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Backend API configuration

This app talks to the FastAPI backend in `../backend` through the typed
client in `lib/api.ts`. Copy the example env file and point it at your
backend:

```bash
cp .env.local.example .env.local
```

`NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:8000/api/v1` for
local dev. For a deployed environment (e.g. both apps running on the same
EC2 instance), change it to the instance's public IP or domain:

```bash
NEXT_PUBLIC_API_BASE_URL=http://<EC2-PUBLIC-IP>:8000/api/v1
```

Note this value is baked in at build time (it's a `NEXT_PUBLIC_*` var), so
rebuild the frontend after changing it. Never put LLM/API secret keys here —
only the backend talks to the LLM provider.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
