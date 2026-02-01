// Load the modules that we'll need to initialize the bot
const express = require("express");
const { Collection } = require("@discordjs/collection");
const { KokoroTTS } = require("kokoro-js");
const { RegExpMatcher, TextCensor, englishDataset, englishRecommendedTransformers } = require('obscenity');
const { promisify } = require("util");
const readdir = promisify(require("fs").readdir);
const fs = require('node:fs/promises');
const crypto = require("crypto");
const mongoose = require("mongoose");

// Initialize our client object
const client = {};
client.funcs = require("./functions.js");
client.config = require("./config.json");
client.tts = {
  "isReading": false,
  "message": null
};
client.matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers
});

// Initialize the express server
const app = express();
app.use(express.json());
app.set('view engine', 'ejs');

mongoose.connect("mongodb://127.0.0.1:27017/sekai-bot");

const ttsMessage = require("./models/ttsMessage.js");

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

    console.log(JSON.stringify(req.body));

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

        const user = req.body.eventData.user;

        // Check whether the command exists in out collection
        const cmd = client.commands.get(command);
        if (!cmd) return res.sendStatus(404);

        // Check to make sure that the command is enabled
        if (!cmd.conf.enabled) return res.sendStatus(404);

        // If we've passed all these checks, it's probably okay to run the command
        try {
          console.log(`Running command ${cmd.help.name}`);
          await cmd.run(client, user, args);
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

  app.get("/alerts", async (req, res) => {
    res.render("alerts", {});
  });

  app.get("/api/tts/reading", async (req, res) => {
    res.send(JSON.stringify({"isReading": client.tts.isReading}));
  });
  app.post("/api/tts/reading", async (req, res) => {
    if (req.body.isReading !== true && req.body.isReading !== false) {
      console.log(`Invalid reading status: ${JSON.stringify(req.body)}`);
      return res.sendStatus(400);
    }
    client.tts.isReading = req.body.isReading;
    console.log(`Reading status set to ${client.tts.isReading}`);
    res.sendStatus(200);
  });

  app.get("/api/tts/message", async (req, res) => {
    res.send(JSON.stringify({"message": client.tts.message}));
  });

  app.post("/api/tts/reset", async (req, res) => {
    console.log("Message queue reset")
    client.tts.message = null;
    res.sendStatus(200);
  });

  app.listen(client.config.expressPort, () => {
    console.log(`Express server listening on port ${client.config.expressPort}`);
  });

  while (true) {
    if (!client.tts.isReading) {
      const tts = await ttsMessage.find({ read: false }).sort("timestamp");
      if (tts.length === 0) {
        continue;  
      }
      client.tts.isReading = true;

      const model_id = "onnx-community/Kokoro-82M-v1.0-ONNX";
      const kokoro = await KokoroTTS.from_pretrained(model_id, {
        dtype: "q8",
        device: "cpu"
      });

      console.log("Generating new TTS message");
      const audio = await kokoro.generate(tts[0].message, {
        voice: "af_heart",
        speed: 0.7
      });

      const filePath = "./tmp/";

      try {
        await fs.access(filePath);
      } catch {
        await fs.mkdir(filePath);
      }

      const id = crypto.randomBytes(16).toString("hex");

      await audio.save(`${filePath}${id}.wav`);
      const audioBuffer = await fs.readFile(`${filePath}${id}.wav`);
      console.log("TTS has been generated");

      client.tts.message = {
        user: tts[0].username,
        text: tts[0].message,
        audio: audioBuffer.toString("base64")
      };
      await fs.unlink(`${filePath}${id}.wav`);
      await ttsMessage.updateOne({ _id: tts[0]._id }, { read: true });
    }
    
    await client.funcs.sleep(5000); // 5 seconds
  }
})();
