import axios from "axios";

const NOMBA_BASE_URL = process.env.NOMBA_BASE_URL || "https://api.nomba.com"; // use https://sandbox.nomba.com while testing
const CLIENT_ID = process.env.NOMBA_CLIENT_ID as string;
const CLIENT_SECRET = process.env.NOMBA_CLIENT_SECRET as string;
const ACCOUNT_ID = process.env.NOMBA_ACCOUNT_ID as string;

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }
  const res = await axios.post(`${NOMBA_BASE_URL}/v1/auth/token/issue`, {
    grant_type: "client_credentials",
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  });
  const { access_token } = res.data;
  // Nomba tokens last 30 minutes -- refresh a little early to be safe.
  cachedToken = { accessToken: access_token, expiresAt: Date.now() + 25 * 60 * 1000 };
  return access_token;
}

export interface CreateCheckoutParams {
  amountNaira: number;
  orderReference: string;
  callbackUrl: string;
  customerEmail: string;
  customerId: string; // the schoolId -- echoed back in the webhook, that's how we know which school paid
}

export async function createCheckoutOrder(params: CreateCheckoutParams): Promise<{ checkoutLink: string }> {
  const token = await getAccessToken();
  const res = await axios.post(
    `${NOMBA_BASE_URL}/v1/checkout/order`,
    {
      order: {
        amount: params.amountNaira.toFixed(2),
        currency: "NGN",
        orderReference: params.orderReference,
        callbackUrl: params.callbackUrl,
        customerEmail: params.customerEmail,
        customerId: params.customerId
      }
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        accountId: ACCOUNT_ID
      }
    }
  );

  if (res.data.code !== "00") {
    throw new Error(res.data.description || "Nomba checkout creation failed");
  }
  return { checkoutLink: res.data.data.checkoutLink };
}