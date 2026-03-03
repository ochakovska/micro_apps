const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// Extract plain text from a Notion rich_text array
function richText(prop) {
  if (!prop || !Array.isArray(prop)) return "";
  return prop.map((t) => t.plain_text).join("");
}

// Extract multi-select values as string array
function multiSelect(prop) {
  if (!prop || !Array.isArray(prop)) return [];
  return prop.map((s) => s.name);
}

// Extract select value
function select(prop) {
  return prop ? prop.name : "";
}

// Extract date string
function dateVal(prop) {
  return prop ? prop.start : "";
}

function mapPage(page) {
  const p = page.properties;
  return {
    name: richText(p["Source Name"]?.title),
    publisher: richText(p["Publisher"]?.rich_text),
    categories: multiSelect(p["Category"]?.multi_select),
    sourceType: select(p["Source Type"]?.select),
    cost: select(p["Cost"]?.select),
    scope: select(p["Geographic Scope"]?.select),
    url: p["URL"]?.url || "",
    description: richText(p["Description"]?.rich_text),
    legislation: multiSelect(p["Relevant Legislation"]?.multi_select),
    verificationStatus: select(p["Verification Status"]?.select),
    memberCount: p["Member Confirmations"]?.number || 0,
    rating: p["Usefulness Rating"]?.number || 0,
    lastUpdate: dateVal(p["Last Source Update"]?.date),
    lastReviewed: dateVal(p["Last Reviewed by Community"]?.date),
    highlights: richText(p["Highlights & Changes"]?.rich_text),
  };
}

exports.handler = async function () {
  try {
    const results = [];
    let cursor;
    do {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        start_cursor: cursor,
      });
      results.push(...response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    const sources = results.map(mapPage);

    const verified = sources.filter(
      (s) => s.verificationStatus === "Verified"
    ).length;
    const recentlyUpdated = sources.filter((s) => {
      if (!s.lastUpdate) return false;
      const updated = new Date(s.lastUpdate);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      return updated >= oneYearAgo;
    }).length;
    const totalReviews = sources.reduce((sum, s) => sum + s.memberCount, 0);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        sources,
        stats: {
          total: sources.length,
          verified,
          recentlyUpdated,
          totalReviews,
        },
      }),
    };
  } catch (err) {
    console.error("Notion API error:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: err.code === "object_not_found"
          ? "Database not found. Make sure the Notion integration has access to the database."
          : "Failed to load sources. Please try again later.",
      }),
    };
  }
};
