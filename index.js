const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = 3000;

// Hardcoded PayPal Sandbox credentials for testing
const PAYPAL_CLIENT_ID =
  "AaDRQ4BHtrVyJ_dOFsKy8q8Dhin5De1FPHl5WgGz3U8w1V0Ub_mLGIx0YJykTkUR8VEVHIO1Vlnl1ygE";
const PAYPAL_CLIENT_SECRET =
  "ECp0zUGTejr_HcHPyVdhy0gg7t59WMRCi9lj7yNlmFPLcPRPgtDq4KN3fcKeoAaGXpkpf-kZKNACucDH";
const REDIRECT_URI = "/callback";

app.use(express.static("public"));

// Step 1: Redirect to PayPal Login
app.get("/connect", (req, res) => {
  const url = `https://www.sandbox.paypal.com/signin/authorize?client_id=${PAYPAL_CLIENT_ID}&response_type=code&scope=openid profile email https://uri.paypal.com/services/paypalattributes https://uri.paypal.com/services/invoicing https://uri.paypal.com/services/transactions&redirect_uri=${REDIRECT_URI}`;
  res.redirect(url);
});

// Step 2: Callback to exchange code for access token and fetch transactions
app.get("/callback", async (req, res) => {
  const { code } = req.query;

  try {
    // Get Access Token
    const tokenRes = await axios({
      method: "post",
      url: "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      auth: {
        username: PAYPAL_CLIENT_ID,
        password: PAYPAL_CLIENT_SECRET,
      },
      data: `grant_type=authorization_code&code=${code}&redirect_uri=${REDIRECT_URI}`,
    });

    const accessToken = tokenRes.data.access_token;

    // Fetch transactions from last 30 days
    const transactions = await axios.get(
      "https://api-m.sandbox.paypal.com/v1/reporting/transactions",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          start_date: new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          end_date: new Date().toISOString(),
        },
      }
    );

    res.json({ transactions: transactions.data.transaction_details });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).send("OAuth or transaction fetch failed");
  }
});
//
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
