const express = require("express");
const axios = require("axios");

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

// PayPal Sandbox Base URL for REST APIs
const PAYPAL_SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com";

// Check if placeholders are still present
if (
  PAYPAL_SANDBOX_CLIENT_ID === "YOUR_PAYPAL_SANDBOX_CLIENT_ID" ||
  PAYPAL_SANDBOX_CLIENT_SECRET === "YOUR_PAYPAL_SANDBOX_CLIENT_SECRET"
) {
  console.error(
    "ERROR: Please replace 'YOUR_PAYPAL_SANDBOX_CLIENT_ID' and 'YOUR_PAYPAL_SANDBOX_CLIENT_SECRET' with your actual PayPal Sandbox credentials."
  );
  console.error(
    "This script is for testing ONLY. Do not hardcode credentials in production!"
  );
  process.exit(1); // Exit if credentials aren't updated
}

let paypalAccessToken = null; // To store the token once fetched

/**
 * Fetches an access token from the PayPal Sandbox API.
 * @returns {Promise<string>} The access token string.
 */
const getAccessToken = async () => {
  console.log("Fetching PayPal Sandbox access token...");

  // PayPal uses Basic Authentication for the token endpoint
  // The credentials should be base64 encoded: client_id:client_secret
  const auth = Buffer.from(
    `${PAYPAL_SANDBOX_CLIENT_ID}:${PAYPAL_SANDBOX_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const response = await axios.post(
      `${PAYPAL_SANDBOX_BASE_URL}/v1/oauth2/token`,
      "grant_type=client_credentials", // Required body for client_credentials grant
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en_US",
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded", // Required content type
        },
      }
    );

    // Store the token globally (for this simple script's duration)
    paypalAccessToken = response.data.access_token;
    console.log("PayPal access token fetched successfully.");
    return paypalAccessToken;
  } catch (error) {
    console.error("Error fetching PayPal access token:");
    if (error.response) {
      // The request was made and the server responded with a status code
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data); // PayPal often includes error details here
      console.error("Headers:", error.response.headers);
      // Common errors: 400 (Bad Request), 401 (Authentication failed)
    } else if (error.request) {
      console.error("No response received from server:", error.request);
    } else {
      console.error("Error setting up request:", error.message);
    }
    throw new Error("Could not obtain PayPal access token"); // Stop if we can't get a token
  }
};

/**
 * Fetches PayPal Sandbox account balance using the access token.
 * @param {string} accessToken - The valid PayPal access token.
 * @returns {Promise<object>} Balance information object.
 */
const fetchPayPalBalance = async (accessToken) => {
  console.log("Fetching PayPal Sandbox balance...");

  try {
    const response = await axios.get(
      `${PAYPAL_SANDBOX_BASE_URL}/v1/reporting/balances`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`, // Use Bearer token for API calls
          Accept: "application/json",
        },
        params: {
          // You might specify a currency, but the API often returns all available balances
          // currency_code: 'USD',
        },
      }
    );

    console.log("PayPal balance fetched successfully.");
    // The API returns an array of balances, usually grouped by currency/type
    return response.data.balances;
  } catch (error) {
    console.error("Error fetching PayPal balance:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else if (error.request) {
      console.error("No response received from server:", error.request);
    } else {
      console.error("Error setting up request:", error.message);
    }
    throw new Error("Failed to fetch PayPal balance"); // Re-throw to be caught by main
  }
};

/**
 * Fetches PayPal Sandbox transaction history using the access token.
 * Note: Sandbox might have limited transaction history.
 * @param {string} accessToken - The valid PayPal access token.
 * @param {number} daysAgo - How many days back to fetch history.
 * @returns {Promise<object[]>} Array of transaction records.
 */
const fetchPayPalTransactions = async (accessToken, daysAgo = 30) => {
  console.log(
    `Fetching PayPal Sandbox transaction history for the last ${daysAgo} days...`
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
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        params: {
          start_date: startDateString,
          end_date: endDateString,
          // Note: For large history, you might need to handle pagination
          // count: 100,
          // start_id: '...',
        },
      }
    );

    console.log(`PayPal transaction history fetched successfully.`);
    // The API returns an object containing transaction details
    return response.data.transaction_details || []; // Return the array of transactions
  } catch (error) {
    console.error(`Error fetching PayPal transactions (${daysAgo} days):`);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
    } else if (error.request) {
      console.error("No response received from server:", error.request);
    } else {
      console.error("Error setting up request:", error.message);
    }
    throw new Error("Failed to fetch PayPal transactions"); // Re-throw
  }
};

// --- Main Execution ---
const main = async () => {
  console.log("Starting PayPal Sandbox data fetch...");

  try {
    // 1. Get Access Token
    const accessToken = await getAccessToken();

    // 2. Fetch Balance and Transactions concurrently using Promise.allSettled
    // Use Promise.allSettled so if one fails, the other still runs.
    const [balanceResult, transactionsResult] = await Promise.allSettled([
      fetchPayPalBalance(accessToken),
      fetchPayPalTransactions(accessToken, 90), // Fetch last 90 days as an example
    ]);

    console.log("\n--- PayPal Sandbox Data Summary ---");

    // Process results from Promise.allSettled
    if (balanceResult.status === "fulfilled") {
      console.log("\nAccount Balances:");
      // Print each balance entry found
      if (balanceResult.value && balanceResult.value.length > 0) {
        balanceResult.value.forEach((bal) => {
          console.log(
            `  Type: ${bal.balance_type}, Currency: ${bal.currency.currency_code}, Value: ${bal.currency.value}`
          );
        });
      } else {
        console.log(
          "No balance information found or account has zero balance."
        );
      }
    } else {
      console.error(
        "\nFailed to fetch Account Balances:",
        balanceResult.reason.message
      );
    }

    if (transactionsResult.status === "fulfilled") {
      const transactions = transactionsResult.value;
      console.log(`\nTransaction History (last 90 days):`);
      console.log(`Total Transactions Fetched: ${transactions.length}`);
      if (transactions.length > 0) {
        // Show first few records as a sample
        const displayCount = 5;
        console.log(`Sample (first ${displayCount}):`);
        console.log(
          JSON.stringify(transactions.slice(0, displayCount), null, 2)
        );
        if (transactions.length > displayCount) {
          console.log(
            `... showing first ${displayCount} out of ${transactions.length} total transactions.`
          );
        }
      } else {
        console.log("No transaction history found for the specified period.");
      }
      // Note: You might want to process transactions to distinguish deposits/withdrawals
      // PayPal transaction_details often contain status, transaction_event_code (e.g., T1107 for payment received), payer_info, etc.
      // Analyzing transaction_event_code and net_amount is key to categorizing.
    } else {
      console.error(
        "\nFailed to fetch Transaction History:",
        transactionsResult.reason.message
      );
    }
  } catch (error) {
    // This catch block handles errors from getAccessToken or unexpected issues
    console.error("\n--- Uncaught Error During PayPal Fetch ---");
    console.error(error.message);
  }

  console.log("\nPayPal Sandbox data fetch complete.");
};

// Execute the main function
main();
