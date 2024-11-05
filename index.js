// Load the modules that we'll need to initialize the bot
const express = require("express");
const { Collection } = require("@discordjs/collection");
const { promisify } = require("util");
const readdir = promisify(require("fs").readdir);
const mongoose = require("mongoose");

// Initialize our client object
const client = {};
client.funcs = require("./functions.js");
client.config = require("./config.json");

// Initialize the express server
const app = express();
app.use(express.json());
app.set('view engine', 'ejs');

mongoose.connect("mongodb://127.0.0.1:27017/sekai-bot");

// These 2 process methods will catch exceptions and give *more details* about the error and stack trace.
process.on("uncaughtException", (err) => {
  const errorMsg = err.stack.replace(new RegExp(`${__dirname}/`, "g"), "./");
  console.error(`Uncaught Exception: ${errorMsg}`);
  // Always best practice to let the code crash on uncaught exceptions. 
  // Because you should be catching them anyway.
  // That said, YOLO
  //process.exit(1);
});
process.on("unhandledRejection", (reason, p) => {
  console.error(`Unhandled rejection: \n${reason}\nStack:\n${reason.stack}\nPromise:\n${require("util").inspect(p, { depth: 2 })}`);
});

// Discord.js has a cool Collections utility that we will use to store our commands
client.commands = new Collection();

// Wrap our initialization in a self-executing async function so we can use async/await syntax
// And also because they're cool
(async () => {
  // Here we load commands into memory as a collection so they're accessible
  // here and everywhere else.
  const cmds = await readdir("./commands");
  console.log(`Loading a total of ${cmds.length} commands.`);
  cmds.forEach((c) => {
    if (!c.endsWith(".js")) return;
    try {
      console.log(`Loading command ${c.split(".")[0]}`);
      const props = require(`./commands/${c}`);
      client.commands.set(props.help.name, props);
    } catch (ex) {
      return console.error(`Failed to load ${c}: ${ex}`);
    }
  });

  app.post("/owncastWebhook/:key", async (req, res) => {
    // Verify that the webhook includes the correct key
    if (req.params.key !== client.config.whVerification) return res.sendStatus(403);

    // Determine the webhook event type
    switch (req.body.type) {
      case "CHAT":
        // Ignore events from bots
        if (req.body.eventData.user.isBot) return res.sendStatus(204);

        // Load the message into a variable
        const message = req.body.eventData.rawBody;

        // Ignore messages that don't start with the prefix
        if (!message.startsWith(client.config.prefix)) return res.sendStatus(204);

        // Here we separate our "command" name, and our "arguments" for the command.
        // e.g. if we have the message "+say Is this the real life?" , we'll get the following:
        // command = say
        // args = ["Is", "this", "the", "real", "life?"]
        const args = message.slice(client.config.prefix.length).trim().split(/ +/g);
        const command = args.shift().toLowerCase();

        // Check whether the command exists in out collection
        const cmd = client.commands.get(command);
        if (!cmd) return res.sendStatus(404);

        // Check to make sure that the command is enabled
        if (!cmd.conf.enabled) return res.sendStatus(404);

        // If we've passed all these checks, it's probably okay to run the command
        try {
          console.log(`Running command ${cmd.help.name}`);
          await cmd.run(client, args);
        } catch (ex) {
          console.error(ex);
          return res.sendStatus(500);
        }
        return res.sendStatus(200);
      default:
        return res.sendStatus(204);
    }
  });

  app.get("/afterstream", async (req, res) => {
    const afterstream = require("./models/afterstream.js");
    const msgs = await afterstream.find({ resolved: false });
    res.render("afterstream", {
      messages: msgs,
      DateTime: require("luxon").DateTime
    });
  });

  app.listen(client.config.expressPort, () => {
    console.log(`Express server listening on port ${client.config.expressPort}`);
  });
})();
