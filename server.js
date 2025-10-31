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
const twilio = require("twilio");
const TW_CLIENT = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

app.post("/webhook", express.urlencoded({ extended: false }), async (req, res) => {
  try {
    console.log("📩 Incoming webhook payload:", req.body);

    const from = req.body.From;
    const to = process.env.TWILIO_WHATSAPP_NUMBER;
    const userMessage = req.body.Body || "";

    if (!from) throw new Error("❌ 'From' number missing in webhook");

    // ---- Dialogflow session setup ----
    const sessionClient = new dialogflow.SessionsClient({
      keyFilename: keyPath,
    });
    const sessionPath = sessionClient.projectAgentSessionPath(
      process.env.DIALOGFLOW_PROJECT_ID,
      "unique-session-id"
    );

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: userMessage,
          languageCode: "en",
        },
      },
    };

    // ---- Send user message to Dialogflow ----
    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;
    const botReply = result.fulfillmentText || "Sorry, I didn’t get that.";

    // ---- Send Dialogflow's reply back to WhatsApp ----
    await TW_CLIENT.messages.create({
      from: to,
      to: from,
      body: botReply,
    });

    res.status(200).send("<Response><Message>Processed successfully</Message></Response>");
  } catch (err) {
    console.error("❌ Webhook Error:", err);
    res.status(500).send("<Response><Message>Error processing message.</Message></Response>");
  }
});
app.get("/", (req, res) => res.send("PharmaBot bridge is running."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ PharmaBot running on port${PORT}`));