"use strict";

const fs = require("fs");
const path = require("path");
const $RefParser = require("json-schema-ref-parser");
const marked = require("marked");

const SPEC_PATH = path.resolve(__dirname, "swagger.json");
const OUTPUT_FILE = "index.html";

async function loadSpec() {
  if (!fs.existsSync(SPEC_PATH)) {
    throw new Error(`Spec file not found at: ${SPEC_PATH}`);
  }

  return $RefParser.bundle(SPEC_PATH);
}

function buildHtmlDocument(title, bodyContent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <title>${title} API Documentation</title>
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/css/bootstrap.min.css"
    integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz57+ZrXrY686NEJoaghKYF8CNE3wBug7"
    crossorigin="anonymous"
  >
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; line-height: 1.6; color: #333; background: #fff; }
    .container { max-width: 960px; margin: 20px auto; padding: 20px; }
    h1, h2, h3, h4, h5, h6 { border-bottom: 2px solid #eee; padding-bottom: 5px; margin-top: 20px; }
    pre { background: #f8f8f8; padding: 10px; border-radius: 5px; overflow: auto; white-space: pre-wrap; }
    .endpoint, .component-section, .operation, .section, .responses, .response { margin-bottom: 30px; padding: 15px; border: 1px solid #ddd; border-radius: 5px; background: #fdfdfd; }
    .method { font-weight: bold; text-transform: uppercase; padding: 4px 10px; margin-right: 10px; border-radius: 3px; color: #fff; display: inline-block; }
    .method.get { background: #28a745; }
    .method.post { background: #007bff; }
    .method.put { background: #ffc107; }
    .method.delete { background: #dc3545; }
    .method.patch { background: #6f42c1; }
    .badge { font-size: 0.8em; margin-right: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f0f0f0; }
    @media print { body, .container { margin: 0; padding: 0; width: 100%; } }
  </style>
</head>
<body>
  <div class="container">
    ${bodyContent}
  </div>
  <script src="https://code.jquery.com/jquery-3.5.1.slim.min.js" integrity="sha384-DfXdz2htPH0lsSSs5nCTpuj/zy4C+OGpamoFVy38MVBnE+IbbVYUew+OrCXaRkfj" crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@4.6.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-Fy6S3B9q64WdZWQUiUq4/2Lc9npb8tCaSX9FK7E8HnRr0Jz8D6OP9dO5Vg3Q9ct" crossorigin="anonymous"></script>
</body>
</html>`;
}

function renderInfo(info) {
  return `
    <h1 class="display-4">${info.title}</h1>
    ${info.description ? marked.marked(info.description) : ""}
    <p><strong>Version:</strong> ${info.version || "N/A"}</p>
  `;
}

function renderEndpoints(paths) {
  let html = "<h2>API Endpoints</h2>";

  for (const [route, methods] of Object.entries(paths)) {
    html += `<div class="endpoint"><h3>Path: <code>${route}</code></h3>`;

    for (const [method, op] of Object.entries(methods)) {
      html += `<div class="operation">
        <span class="method ${method}">${method}</span>
        <strong>${op.summary || ""}</strong>
      `;

      if (op.description) html += marked.marked(op.description);
      if (op.operationId) html += `<p><strong>Operation ID:</strong> ${op.operationId}</p>`;
      if (op.tags) html += `<p><strong>Tags:</strong> ${op.tags.join(", ")}</p>`;

      html += renderParameters(op.parameters);
      html += renderRequestBody(op.requestBody);
      html += renderResponses(op.responses, route, method);
      html += "</div>";
    }
    html += "</div>";
  }

  return html;
}

function renderParameters(parameters = []) {
  if (!parameters.length) return "";

  const rows = parameters
    .map(
      (p) => `
    <tr>
      <td>${p.name}</td>
      <td>${p.in}</td>
      <td>${p.schema?.type || p.type || ""}</td>
      <td>${p.required ? "Yes" : "No"}</td>
      <td>${p.description ? marked.marked(p.description) : ""}</td>
    </tr>
  `
    )
    .join("");

  return `
    <div class="section">
      <h4>Parameters</h4>
      <table class="table table-sm">
        <thead><tr><th>Name</th><th>In</th><th>Type</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderRequestBody(requestBody = {}) {
  const contentMap = requestBody.content || {};
  if (!Object.keys(contentMap).length) return "";

  let html = '<div class="section"><h4>Request Body</h4>';
  if (requestBody.description) html += marked.marked(requestBody.description);

  for (const [media, obj] of Object.entries(contentMap)) {
    html += `<h5>Media Type: ${media}</h5>`;

    // link to schema if a $ref
    if (obj.schema && obj.schema.$ref) {
      const parts = obj.schema.$ref.split("/");
      const compName = parts[parts.length - 1];
      html += `
        <p>
          Schema: 
          <a href="#schema-${compName}" class="btn btn-sm btn-link">
            ${compName}
          </a>
        </p>
      `;
    }

    if (obj.schema) html += `<pre>${JSON.stringify(obj.schema, null, 2)}</pre>`;
    if (obj.example) html += `<h6>Example:</h6><pre>${JSON.stringify(obj.example, null, 2)}</pre>`;
    if (obj.examples) {
      for (const [k, ex] of Object.entries(obj.examples)) {
        html += `<h6>Example (${k}):</h6><pre>${JSON.stringify(ex, null, 2)}</pre>`;
      }
    }
  }

  html += "</div>";
  return html;
}

function renderResponses(responses = {}, route = "", method = "") {
  const codes = Object.entries(responses);
  if (!codes.length) return "";

  let html = `
    <div class="responses">
      <h4>Responses for <code>${method.toUpperCase()}</code> <code>${route}</code></h4>
  `;

  for (const [code, r] of codes) {
    html += `<div class="response ${code}"><h5>Status: ${code}${r.description ? ` - ${r.description}` : ""}</h5>`;

    for (const [media, obj] of Object.entries(r.content || {})) {
      html += `<div class="media-type"><h6>Media Type: ${media}</h6>`;

      if (obj.schema && obj.schema.$ref) {
        const parts = obj.schema.$ref.split("/");
        const compName = parts[parts.length - 1];
        html += `
          <a href="#schema-${compName}" class="btn btn-sm btn-outline-primary mb-2">
            Show ${compName} Schema
          </a>
        `;
      }

      if (obj.schema) html += `<pre>${JSON.stringify(obj.schema, null, 2)}</pre>`;
      if (obj.example) html += `<h6>Example:</h6><pre>${JSON.stringify(obj.example, null, 2)}</pre>`;

      if (obj.examples) {
        for (const [k, ex] of Object.entries(obj.examples)) {
          html += `<h6>Example (${k}):</h6><pre>${JSON.stringify(ex, null, 2)}</pre>`;
        }
      }

      html += `</div>`;
    }

    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function renderComponents(components = {}) {
  const types = Object.entries(components);
  if (!types.length) return "";

  let html = "<h2>Components</h2>";
  for (const [type, items] of types) {
    html += `<div class="component-section"><h3>${type.charAt(0).toUpperCase() + type.slice(1)}</h3>`;

    for (const [name, comp] of Object.entries(items)) {
      html += `
        <div class="section" id="schema-${name}">
          <h4>${name} Schema</h4>
          ${comp.description ? marked.marked(comp.description) : ""}
          <pre>${JSON.stringify(comp, null, 2)}</pre>
        </div>
      `;
    }

    html += "</div>";
  }

  return html;
}

async function generateDocumentation() {
  try {
    const spec = await loadSpec();
    const content = renderInfo(spec.info) + renderEndpoints(spec.paths) + renderComponents(spec.components);
    const html = buildHtmlDocument(spec.info.title, content);

    await fs.promises.writeFile(OUTPUT_FILE, html, "utf-8");
    console.log(`Documentation generated: ${OUTPUT_FILE}`);
  } catch (err) {
    console.error("Error generating documentation:", err.message);
    process.exit(1);
  }
}

generateDocumentation();
