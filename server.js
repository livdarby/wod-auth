require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

const allowedOrigins = [
  "https://crossfitclaremont.myshopify.com",
  "https://crossfitclaremont.com.au",
  "https://www.crossfitclaremont.com.au",
];

app.use(express.json());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith(".shopifypreview.com");

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
  }),
);

function richTextToHtml(input) {
  let doc;

  try {
    doc = typeof input === "string" ? JSON.parse(input) : input;
  } catch {
    return input || "";
  }

  function renderNode(node) {
    if (!node) return "";

    if (node.type === "root") {
      return (node.children || []).map(renderNode).join("");
    }

    if (node.type === "paragraph") {
      return `<p>${(node.children || []).map(renderNode).join("")}</p>`;
    }

    if (node.type === "text") {
      let value = node.value || "";
      if (node.bold) value = `<strong>${value}</strong>`;
      if (node.italic) value = `<em>${value}</em>`;
      return value;
    }

    if (node.type === "list") {
      const tag = node.listType === "ordered" ? "ol" : "ul";
      return `<${tag}>${(node.children || []).map(renderNode).join("")}</${tag}>`;
    }

    if (node.type === "list-item") {
      return `<li>${(node.children || []).map(renderNode).join("")}</li>`;
    }

    return "";
  }

  return renderNode(doc);
}

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

app.post("/wod-content", async (req, res) => {
  try {
    const { password, articleId } = req.body;

    if (password !== process.env.WOD_PASSWORD) {
      return res
        .status(401)
        .json({ allowed: false, message: "Incorrect password" });
    }

    const url =
      `https://${process.env.SHOPIFY_STORE_DOMAIN}` +
      `/admin/api/2026-01/blogs/${process.env.SHOPIFY_BLOG_ID}/articles/${articleId}.json`;

    console.log("Fetching Shopify URL:", url);

    const shopifyRes = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
        "Content-Type": "application/json",
      },
    });

    const data = await shopifyRes.json();

    console.log("Shopify response:", JSON.stringify(data, null, 2));
    const article = data.article;

    if (!article) {
      return res.status(404).json({
        allowed: false,
        message: "Article not found",
        shopifyResponse: data,
      });
    }

    const metafieldsUrl =
      `https://${process.env.SHOPIFY_STORE_DOMAIN}` +
      `/admin/api/2026-01/articles/${article.id}/metafields.json`;

    const metafieldsRes = await fetch(metafieldsUrl, {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
        "Content-Type": "application/json",
      },
    });

    const metafieldsData = await metafieldsRes.json();

    const contentKeys = [
      "fitness_content",
      "performance_content",
      "weightlifting_content",
      "flow_content",
      "hyrox_content",
      "crossfit_content",
    ];

    // const metafieldContent = (metafieldsData.metafields || [])
    //   .filter((field) => contentKeys.includes(field.key))
    //   .map((field) => richTextToHtml(field.value))
    //   .filter(Boolean)
    //   .join("\n");

    const programs = [];

    for (const field of metafieldsData.metafields) {
      if (!contentKeys.includes(field.key)) continue;

      programs.push({
        title: field.key
          .replace("_content", "")
          .replace("crossfit", "CrossFit")
          .replace("hyrox", "HYROX")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),

        html: richTextToHtml(field.value),
      });
    }

    // const contentHtml = article.body_html || metafieldContent;

    return res.json({
      allowed: true,
      article: {
        title: article.title,
        id: article.id,
        body_html: article.body_html || "",
        image: article.image?.src || null,
        published_at: article.published_at,
        programs,
      },
    });
  } catch (error) {
    console.error("WOD content error:", error);

    return res.status(500).json({
      allowed: false,
      message: "Server error",
      error: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`WOD auth server running on port ${port}`);
});
