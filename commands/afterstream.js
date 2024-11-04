const afterstream = require("../models/afterstream");

exports.help = {
  name: "afterstream",
  description: "Saves a message to be reviewed after the stream ends",
  usage: "afterstream <message>"
};

exports.conf = {
  enabled: true
}

exports.run = async (client, args) => {
  await afterstream.create({ message: args.join(" "), resolved: false });
  client.funcs.sendMessage(client.config.owncastUrl, client.config.owncastToken, "Message has been logged.");
};