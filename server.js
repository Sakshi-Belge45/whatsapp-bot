const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const dotenv = require("dotenv");
const fs = require("fs");
const dialogflow = require("@google-cloud/dialogflow");

dotenv.config();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Load Dialogflow credentials
const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

function getProjectId() {
  try {
    if (!keyPath) return "";
    const raw = fs.readFileSync(keyPath, "utf8");
    const json = JSON.parse(raw);
    return json.project_id || "";
  } catch (e) {
    console.warn("Could not read project id from key file", e);
    return "";
  }
}

const projectId = getProjectId();
require('dotenv').config();

const PROJECT_ID = process.env.GCP_PROJECT_ID || getProjectId();

let sessionClient;
if (process.env.DF_SERVICE_ACCOUNT_JSON) {
  try {
    const credentials = JSON.parse(process.env.DF_SERVICE_ACCOUNT_JSON);
    sessionClient = new dialogflow.SessionsClient({ credentials });
    console.log('✅ Dialogflow: using credentials from env variable');
  } catch (err) {
    console.error('❌ Error parsing DF_SERVICE_ACCOUNT_JSON:', err);
    throw err;
  }
} else {
  sessionClient = new dialogflow.SessionsClient({ keyFilename: keyPath });
  console.log('✅ Dialogflow: using local key file');
}
app.post("/webhook", async (req, res) => {
  console.log("Incoming webhook:",req.body); //
  try {
    const message = req.body.Body || "";
    const sessionPath = sessionClient.projectAgentSessionPath(PROJECT_ID,"12345");

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: message,
          languageCode: "en",
        },
      },
    };

    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;
    const reply =
      result && result.fulfillmentText
        ? result.fulfillmentText 
        : "Sorry, I didn’t understand that.";
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const twiml = new MessagingResponse();
twiml.message(reply);

res.type('text/xml');
res.send(twiml.toString());
    
  } catch (err) {
    console.error("Dialogflow error:", err);
    res.set("Content-Type", "text/xml");
    res.send(
      `<Response><Message>⚠ Error communicating with PharmaBot.</Message></Response>`
    );
  }
});

app.get("/", (req, res) => res.send("PharmaBot bridge is running."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ PharmaBot running on port ${PORT}`));