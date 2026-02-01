const { DateTime } = require("luxon");
const ttsMessage = require("../models/ttsMessage");

exports.help = {
  name: "tts",
  description: "Sends a message to be read aloud by text-to-speech",
  usage: "tts <message>"
};

exports.conf = {
  enabled: true
}

exports.run = async (client, user, args) => {
  const msg = args.join(" ");
  if (client.matcher.hasMatch(msg)) return;
  await ttsMessage.create({ username: user.displayName, message: msg, timestamp: new Date().toISOString(), read: false });
  return;
};
