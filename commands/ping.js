exports.help = {
  name: "ping",
  description: "Pings the bot",
  usage: "ping"
};

exports.conf = {
  enabled: true
}

exports.run = async (client, user, args) => {
  client.funcs.sendMessage(client.config.owncastUrl, client.config.owncastToken, "Pong!");
};