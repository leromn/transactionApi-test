// testBinanceFetch.js
const axios = require("axios");
const crypto = require("crypto");

// *** !!! WARNING !!! ***
// HARDCODING API KEYS IS DANGEROUS AND ONLY DONE HERE FOR A QUICK TEST.
// REPLACE THESE WITH YOUR ACTUAL BINANCE API KEY AND SECRET KEY
// Ensure the API key has 'Enable Reading' permissions at minimum.
// *** REPLACE THESE PLACEHOLDERS ***
const BINANCE_API_KEY =
  "ivsGtXBmg9zQ2ShTXKOORM6qzwdTbiswBdA5ziFyqHTrAHqYTTYy50sUMhVY8erg";
const BINANCE_SECRET_KEY =
  "wDVQVrqx0QCZLXJ5RmgauPWM47HdgbbVRj6hlKaQbAahnAu7O6PXRKYM5cyw8GlB";
// Use 'https://api.binance.com' for mainnet, 'https://testnet.binance.vision' for testnet
const BINANCE_BASE_URL = "https://api.binance.com";

// Check if placeholders are still present
if (
  BINANCE_API_KEY === "YOUR_BINANCE_API_KEY" ||
  BINANCE_SECRET_KEY === "YOUR_BINANCE_SECRET_KEY"
) {
  console.error(
    "ERROR: Please replace 'YOUR_BINANCE_API_KEY' and 'YOUR_BINANCE_SECRET_KEY' with your actual Binance API credentials."
  );
  console.error(
    "This script is for testing ONLY. Do not hardcode keys in production!"
  );
  process.exit(1); // Exit if credentials aren't updated
}

/**
 * Generates a HMAC SHA256 signature for Binance API requests.
 * @param {string} queryString - The query string of the request parameters.
 * @param {string} secretKey - Your Binance API Secret Key.
 * @returns {string} The hexadecimal signature.
 */
const generateSignature = (queryString, secretKey) => {
  return crypto
    .createHmac("sha256", secretKey)
    .update(queryString)
    .digest("hex");
};

const axiosInstance = axios.create({
  baseURL: BINANCE_BASE_URL,
  headers: {
    "X-MBX-APIKEY": BINANCE_API_KEY,
  },
});

/**
 * Fetches Binance account information, including balances.
 * Requires the 'Account Read' permission on the API key.
 * @returns {Promise<object[]>} Array of balance objects (asset, free, locked).
 */
const fetchBinanceAccountBalances = async () => {
  const endpoint = "/api/v3/account";
  const timestamp = Date.now(); // Binance requires a timestamp for signed endpoints

  // For the account endpoint, the timestamp is typically the only parameter needed for signing
  const queryString = `timestamp=${timestamp}`;

  // Generate the signature using the timestamp query string and your secret key
  const signature = generateSignature(queryString, BINANCE_SECRET_KEY);

  // The actual parameters sent in the request include timestamp and signature
  const params = {
    timestamp: timestamp,
    signature: signature,
  };

  console.log(
    `Attempting to fetch account balances from: ${BINANCE_BASE_URL}${endpoint}`
  );

  try {
    const response = await axiosInstance.get(endpoint, {
      params: params, // Send timestamp and signature as query parameters
    });

    console.log("\n--- Binance Account Balances ---");
    if (
      response.data &&
      response.data.balances &&
      Array.isArray(response.data.balances)
    ) {
      // The response data includes an array named 'balances'
      const balances = response.data.balances;

      // Filter out assets with zero balance for cleaner output (optional)
      const nonZeroBalances = balances.filter(
        (b) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
      );

      if (nonZeroBalances.length > 0) {
        console.log(
          `Found ${nonZeroBalances.length} assets with non-zero balances:`
        );
        // Print each non-zero balance
        nonZeroBalances.forEach((bal) => {
          console.log(
            `  Asset: ${bal.asset}, Free: ${bal.free}, Locked: ${bal.locked}`
          );
        });
        console.log(
          "\n'Free' is available balance, 'Locked' is held in orders etc."
        );
      } else {
        console.log("No assets with non-zero balances found in your account.");
      }
    } else {
      console.error(
        "Unexpected response format for account balances:",
        response.data
      );
    }
  } catch (error) {
    console.error("\n--- Error Fetching Binance Account Balances ---");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data); // Binance often includes error details here
      console.error("Headers:", error.response.headers);
      // Common errors: 401 (Invalid API-Key or Signature), 403 (Permissions), 429 (Rate limit)
    } else if (error.request) {
      console.error("No response received from server:", error.request);
    } else {
      console.error("Error setting up request:", error.message);
    }
    console.error("Axios Config:", error.config); // Log config to see the URL/params that were sent
  }
};

// Execute the fetch function
fetchBinanceAccountBalances();
