const axios = require('axios');

async function sendSMS(mobile, message) {
  try {
    const authkey = '353874616e6f7737343546';
    const sender = 'AUTHET';
    const route = '2';
    const country = '91';
    const dlt_te_id = '1707176519519241645';

    const smsUrl = `http://136.243.171.112/api/sendhttp.php?authkey=${authkey}&mobiles=91${mobile}&message=${encodeURIComponent(message)}&sender=${sender}&route=${route}&country=${country}&DLT_TE_ID=${dlt_te_id}`;

    console.log("Requesting URL:", smsUrl);
    
    // Using axios since fetch might not be globally available in older Node
    const response = await axios.get(smsUrl);
    console.log("SMS SENT RESPONSE:", response.data);
    return response.data;
  } catch (err) {
    console.error("SMS ERROR:", err.response?.data || err.message);
    throw err;
  }
}

sendSMS("8770374828", "Dear user , Your OTP is 123456. Use this to verify your authetik account within 10 minutes. For your security, do not share this code with anyone.")
  .then(() => console.log("Done"))
  .catch(console.error);
