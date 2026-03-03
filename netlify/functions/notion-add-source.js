const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

exports.handler = async function (event) {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { name, publisher, url, description, categories, sourceType, cost, scope } = body;

    if (!name || !publisher || !url || !description) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ error: "Name, publisher, URL, and description are required." }),
      };
    }

    const properties = {
      "Source Name": {
        title: [{ text: { content: name } }],
      },
      "Publisher": {
        rich_text: [{ text: { content: publisher } }],
      },
      "URL": { url },
      "Description": {
        rich_text: [{ text: { content: description } }],
      },
      "Verification Status": {
        select: { name: "Unverified" },
      },
      "Member Confirmations": { number: 1 },
    };

    if (categories && categories.length > 0) {
      properties["Category"] = {
        multi_select: categories.map((c) => ({ name: c })),
      };
    }

    if (sourceType) {
      properties["Source Type"] = { select: { name: sourceType } };
    }

    if (cost) {
      properties["Cost"] = { select: { name: cost } };
    }

    if (scope) {
      properties["Geographic Scope"] = { select: { name: scope } };
    }

    await notion.pages.create({
      parent: { database_id: DATABASE_ID },
      properties,
    });

    return {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error("Notion API error:", err.message);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: "Failed to add source. Please try again later.",
      }),
    };
  }
};
