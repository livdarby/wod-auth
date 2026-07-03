require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN,
  }),
);

app.post("/check-password", (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      allowed: false,
      message: "Password is required",
    });
  }

  if (password === process.env.WOD_PASSWORD) {
    return res.json({
      allowed: true,
      message: "Password accepted",
    });
  }

  return res.status(401).json({
    allowed: false,
    message: "Incorrect password",
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`WOD auth server running on port ${port}`);
});

app.post("/wod-content", async (req, res) => {
  const { password, path } = req.body;

  if (password !== process.env.WOD_PASSWORD) {
    return res.status(401).json({ allowed: false });
  }

  const match = path.match(/^\/blogs\/([^/]+)\/([^/?#]+)/);

  if (!match) {
    return res.status(400).json({
      allowed: false,
      message: "Unsupported path",
    });
  }

  const blogHandle = match[1];
  const articleHandle = match[2];

  const query = `
    query GetArticle($query: String!) {
      articles(first: 1, query: $query) {
        edges {
          node {
            title
            contentHtml
            publishedAt
            image {
              url
              altText
            }
          }
        }
      }
    }
  `;

  const shopifyRes = await fetch(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/api/2026-07/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token":
          process.env.SHOPIFY_STOREFRONT_TOKEN,
      },
      body: JSON.stringify({
        query,
        variables: {
          query: `blog:${blogHandle} handle:${articleHandle}`,
        },
      }),
    },
  );

  const data = await shopifyRes.json();
  const article = data?.data?.articles?.edges?.[0]?.node;

  if (!article) {
    return res.status(404).json({
      allowed: false,
      message: "Article not found",
      debug: data,
    });
  }

  res.json({
    allowed: true,
    article,
  });
});
