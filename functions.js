const fetch = require("node-fetch");

module.exports = {
  "sendMessage": async (uri, token, message) => {
    const res = await fetch(`${uri}/api/integrations/chat/send`, {
      method: "POST",
      body: JSON.stringify({ "body": message }),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    }).then(res => res.json());
  }
};
