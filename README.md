This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Install dependencies, then copy `.env.example` to `.env.local`. Set the
server-only `OPENAI_API_KEY` value to enable the AI Stylist's preference
extraction. The chat sends each message to `/api/extraction` and shows the
extracted preferences and matching catalogue products.

## Product photos

Set the five `S3_*` variables from `.env.example` in `.env.local` using your
Supabase Storage S3 configuration. Keep the access key and secret server-only.
`S3_BUCKET_NAME` must be the actual bucket containing your product photos.

Store the bucket-relative object path in `products.image_key`, for example
`products/ABC001/main.jpg`. Existing public or signed Supabase object URLs are
also supported if they belong to the configured project and bucket; the app
extracts the object path and generates a fresh signature. Local `/images/`
demo photos continue to work.

Search, stylist results, product details and cart items use a stable
`/api/products/[productId]/image` URL. That server route checks catalogue access
through the existing RLS policies, then redirects to an S3 URL valid for five
minutes. It supports public and private buckets without changing bucket
permissions. Temporary signatures are never saved in the cart. Missing or
unavailable photos show the existing product placeholder.

Storage photos bypass Next.js image optimization so the browser can follow
fresh storage signatures without caching them in the optimizer. Upload suitably
sized product photos (such as 1200px on the longest side). Local demo photos
still use Next.js optimization. Homepage and related-product lists currently
use demo catalogue data.

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
