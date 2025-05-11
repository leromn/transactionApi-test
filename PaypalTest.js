const express = require("express");
const axios = require("axios");
const path = require("path");
const { URLSearchParams } = require("url"); // Built-in node module for URL parameters

// Hardcoded PayPal Sandbox credentials for testing
const PAYPAL_CLIENT_ID =
  "AaDRQ4BHtrVyJ_dOFsKy8q8Dhin5De1FPHl5WgGz3U8w1V0Ub_mLGIx0YJykTkUR8VEVHIO1Vlnl1ygE";
const PAYPAL_CLIENT_SECRET =
  "ECp0zUGTejr_HcHPyVdhy0gg7t59WMRCi9lj7yNlmFPLcPRPgtDq4KN3fcKeoAaGXpkpf-kZKNACucDH";

// *** !!! WARNING !!! ***
// HARDCODING PAYPAL SANDBOX CREDENTIALS IS DANGEROUS AND ONLY DONE HERE FOR A QUICK TEST.
// REPLACE THESE WITH YOUR ACTUAL PAYPAL SANDBOX CLIENT ID AND CLIENT SECRET
// You can get these from your PayPal Developer Dashboard (developer.paypal.com)
// Create a Sandbox account if you don't have one, then create REST API credentials.
// *** REPLACE THESE PLACEHOLDERS ***
const PAYPAL_SANDBOX_CLIENT_ID = PAYPAL_CLIENT_ID;
const PAYPAL_SANDBOX_CLIENT_SECRET = PAYPAL_CLIENT_SECRET;
// server.js
// *** !!! WARNING !!! ***
// HARDCODING SENSITIVE CREDENTIALS IS A MAJOR SECURITY RISK.
// THIS IS FOR ISOLATED TESTING ONLY ON YOUR SPECIFIC DEVBOX.
// DO NOT USE IN PRODUCTION OR ANY ENVIRONMENT REQUIRING SECURITY.
// *** !!! WARNING !!! ***

// THIS REDIRECT_URI MUST EXACTLY MATCH THE ONE CONFIGURED IN YOUR PAYPAL APP SETTINGS
const REDIRECT_URI =
  "https://transactionapi-test-bpw.onrender.com/paypal-redirect"; // <-- REPLACE THIS if needed (e.g., different port)
const PORT = 3000; // Server port

// Check if placeholders are still present
if (
  PAYPAL_SANDBOX_CLIENT_ID === "YOUR_PAYPAL_SANDBOX_CLIENT_ID" ||
  PAYPAL_SANDBOX_CLIENT_SECRET === "YOUR_PAYPAL_SANDBOX_CLIENT_SECRET"
) {
  console.error(
    "FATAL: Please replace 'YOUR_PAYPAL_SANDBOX_CLIENT_ID' and 'YOUR_PAYPAL_SANDBOX_CLIENT_SECRET' placeholders."
  );
  console.error(
    `Also ensure REDIRECT_URI '${REDIRECT_URI}' matches your PayPal app settings.`
  );
  console.error("HARDCODING IS DANGEROUS! This is for testing ONLY.");
  process.exit(1);
}

const PAYPAL_SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com"; // Use sandbox for testing

// --- Express App Setup ---
const app = express();

// Serve static HTML file from the same directory
app.use(express.static(__dirname));

// --- Routes ---

// Root route serves the HTML page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Initiates the PayPal OAuth flow
app.get("/connect-paypal", (req, res) => {
  // Define the permissions (scopes) you need from the client's account
  const scopes = [
    "openid", // Basic profile info
    "email", // Client's email
    "https://uri.paypal.com/services/reporting/transactions/read", // Permission to read transactions
    "https://uri.paypal.com/services/reporting/balances/read", // Permission to read balances
    // Add other scopes as needed (e.g., profile, phone number)
  ];

  // Build the PayPal authorization URL
  const authorizeUrl =
    `${PAYPAL_SANDBOX_BASE_URL}/oauth2/authorize?` +
    `client_id=${PAYPAL_SANDBOX_CLIENT_ID}&` + // Your hardcoded app's Client ID
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` + // Your hardcoded redirect URI
    `scope=${encodeURIComponent(scopes.join(" "))}&` + // Permissions requested
    `response_type=code`; // We want an authorization code

  console.log(
    `Redirecting user to PayPal Sandbox for authorization: ${authorizeUrl}`
  );
  res.redirect(authorizeUrl); // Redirect the user's browser
});

// This is the Redirect URI endpoint that PayPal calls after authorization
app.get("/paypal-redirect", async (req, res) => {
  const authCode = req.query.code;
  const error = req.query.error;
  const errorDescription = req.query.error_description;

  if (error) {
    console.error("PayPal authorization failed:", error, errorDescription);
    return res.status(400).send(`
      <h1>PayPal Authorization Failed</h1>
      <p>Error: ${error}</p>
      <p>Description: ${errorDescription}</p>
      <p><a href="/">Try again</a></p>
    `);
  }

  if (!authCode) {
    console.error("PayPal authorization failed: No code received.");
    return res.status(400).send(`
       <h1>PayPal Authorization Failed</h1>
       <p>No authorization code received.</p>
       <p><a href="/">Try again</a></p>
     `);
  }

  console.log(`Received authorization code: ${authCode}`);

  // Now, exchange the authorization code for an access token using YOUR app's credentials
  console.log("Exchanging auth code for access token...");
  // Use your hardcoded app credentials for Basic Auth
  const auth = Buffer.from(
    `${PAYPAL_SANDBOX_CLIENT_ID}:${PAYPAL_SANDBOX_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const tokenResponse = await axios.post(
      `${PAYPAL_SANDBOX_BASE_URL}/v1/oauth2/token`,
      `grant_type=authorization_code&code=${authCode}&redirect_uri=${encodeURIComponent(
        REDIRECT_URI
      )}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    const refreshToken = tokenResponse.data.refresh_token; // Save this for later token refreshing if needed
    console.log("Successfully obtained access token.");
    console.log(
      "Refresh Token (for refreshing later, save securely!):",
      refreshToken
    ); // In a real app, store this securely with the user

    // --- Use the client's access token to fetch their data ---
    console.log("Fetching client's data using their access token...");

    // Use Promise.allSettled to fetch multiple data points concurrently
    // If one fails, the other results are still available.
    const [balanceResult, transactionsResult] = await Promise.allSettled([
      fetchClientPayPalBalance(accessToken),
      fetchClientPayPalTransactions(accessToken, 90), // Fetch last 90 days for testing
    ]);

    // --- Display Results ---
    let htmlOutput = `
      <!DOCTYPE html>
      <html>
      <head><title>PayPal Data</title></head>
      <body>
      <h1>PayPal Data Fetched Successfully!</h1>
    `;

    // Display Balance
    if (balanceResult.status === "fulfilled") {
      htmlOutput += `<h2>Account Balances:</h2>`;
      if (
        balanceResult.value &&
        Array.isArray(balanceResult.value) &&
        balanceResult.value.length > 0
      ) {
        htmlOutput += "<ul>";
        balanceResult.value.forEach((bal) => {
          htmlOutput += `<li>Type: ${bal.balance_type}, Currency: ${bal.currency.currency_code}, Value: ${bal.currency.value}</li>`;
        });
        htmlOutput += "</ul>";
      } else {
        htmlOutput +=
          "<p>No balance information found or account has zero balance.</p>";
      }
    } else {
      htmlOutput += `<h2>Failed to fetch Account Balances:</h2><p>${balanceResult.reason.message}</p>`;
      console.error("Failed fetching balance:", balanceResult.reason);
    }

    // Display Transactions
    if (transactionsResult.status === "fulfilled") {
      const transactions = transactionsResult.value;
      htmlOutput += `<h2>Transaction History (last 90 days):</h2>`;
      htmlOutput += `<p>Total Transactions Fetched: ${transactions.length}</p>`;
      if (transactions.length > 0) {
        // Limit display to avoid flooding the browser
        const displayCount = 10; // Show up to 10 transactions in the sample
        htmlOutput += "<ul>";
        transactions.slice(0, displayCount).forEach((tx) => {
          // Extract some basic transaction info
          const type = tx.transaction_info.transaction_event_code || "N/A";
          const status = tx.transaction_info.transaction_status || "N/A";
          const amount = tx.transaction_info.transaction_amount
            ? `${tx.transaction_info.transaction_amount.value} ${tx.transaction_info.transaction_amount.currency_code}`
            : "N/A";
          const date = tx.transaction_info.transaction_initiation_date || "N/A";
          // Payer or Payee info might be in one of these fields depending on transaction type
          const counterparty = tx.payer_info
            ? tx.payer_info.email_address || tx.payer_info.payer_id
            : tx.payee_info
            ? tx.payee_info.email_address || tx.payee_info.merchant_id
            : "N/A";

          htmlOutput += `<li>[${date}] Type: ${type}, Status: ${status}, Amount: ${amount}, Counterparty: ${counterparty}</li>`;
        });
        htmlOutput += "</ul>";
        if (transactions.length > displayCount) {
          htmlOutput += `<p>... showing first ${displayCount} out of ${transactions.length} total transactions.</p>`;
        }
        htmlOutput += `<p>Note: transaction_event_code indicates transaction type (e.g., T1107 is payment received, T0002 is payment sent).</p>`;
      } else {
        htmlOutput +=
          "<p>No transaction history found for the specified period.</p>";
      }
    } else {
      htmlOutput += `<h2>Failed to fetch Transaction History:</h2><p>${transactionsResult.reason.message}</p>`;
      console.error("Failed fetching transactions:", transactionsResult.reason);
    }

    htmlOutput += `<br><p><a href="/">Connect another account</a></p>`;
    htmlOutput += `
      </body>
      </html>
     `;

    res.send(htmlOutput); // Send the results back to the user's browser
  } catch (error) {
    console.error(
      "Error during PayPal Data Fetch:",
      error.response?.data || error.message
    );
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>PayPal Error</title></head>
      <body>
      <h1>Error during PayPal Data Fetch</h1>
      <p>An error occurred while trying to exchange the authorization code or fetch data.</p>
      <p>Details: ${
        error.response?.data?.error_description || error.message || error
      }</p>
      <p><a href="/">Try again</a></p>
      </body>
      </html>
     `);
  }
});

// --- Helper functions to fetch data using the client's access token ---

/**
 * Fetches PayPal account balance for the connected client.
 * @param {string} accessToken - The client's valid PayPal access token.
 * @returns {Promise<object>} Balance information.
 */
const fetchClientPayPalBalance = async (accessToken) => {
  console.log("Attempting to fetch client balance...");
  try {
    const response = await axios.get(
      `${PAYPAL_SANDBOX_BASE_URL}/v1/reporting/balances`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`, // Use the client's token
          Accept: "application/json",
        },
      }
    );
    return response.data.balances; // This is an array of balances
  } catch (error) {
    console.error(
      "Error fetching client PayPal balance:",
      error.response?.data || error.message
    );
    // Throw a specific error object so Promise.allSettled captures it
    throw new Error(
      `API Error fetching balance: ${
        error.response?.data?.error_description || error.message
      }`
    );
  }
};

/**
 * Fetches PayPal transaction history for the connected client.
 * @param {string} accessToken - The client's valid PayPal access token.
 * @param {number} daysAgo - How many days back to fetch history.
 * @returns {Promise<object[]>} Array of transaction records.
 */
const fetchClientPayPalTransactions = async (accessToken, daysAgo = 90) => {
  console.log(
    `Attempting to fetch client transaction history for last ${daysAgo} days...`
  );
  // Calculate start and end dates in ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ)
  const endDate = new Date(); // Current date/time
  const startDate = new Date(endDate.getTime() - daysAgo * 24 * 60 * 60 * 1000); // Date/time X days ago

  const startDateString = startDate.toISOString();
  const endDateString = endDate.toISOString();

  try {
    const response = await axios.get(
      `${PAYPAL_SANDBOX_BASE_URL}/v1/reporting/transactions`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`, // Use the client's token
          Accept: "application/json",
        },
        params: {
          start_date: startDateString,
          end_date: endDateString,
          // Note: For large history, you might need to handle pagination
          // count: 100, // Adjust if needed, default is often reasonable
          // start_id: '...', // For subsequent pages
        },
      }
    );
    return response.data.transaction_details || []; // Return the array of transactions
  } catch (error) {
    console.error(
      `Error fetching client PayPal transactions (${daysAgo} days):`,
      error.response?.data || error.message
    );
    // Throw a specific error object so Promise.allSettled captures it
    throw new Error(
      `API Error fetching transactions: ${
        error.response?.data?.error_description || error.message
      }`
    );
  }
};

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
  console.log(`Remember to replace hardcoded credentials in server.js!`);
  console.log(
    `Ensure your PayPal Sandbox App Redirect URI is set to '${REDIRECT_URI}' in your Developer Dashboard.`
  );
});
