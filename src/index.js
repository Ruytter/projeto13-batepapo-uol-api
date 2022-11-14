import express, { json } from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import dotenv from "dotenv";
import joi from "joi";

const uolpSchema = joi.object({
  name: joi.string().required().min(3).max(100),
});
const uolmSchema = joi.object({
  to: joi.string().required().min(3).max(100),
  from: joi.string().required().min(3).max(100),
  text: joi.string().required(),
  type: joi.string().required(),
});

const app = express();

dotenv.config();
app.use(cors());
app.use(json());

const mongoClient = new MongoClient(process.env.MONGO_URI);

try {
  await mongoClient.connect();
  console.log("mongodb conectato");
} catch (err) {
  console.log(err);
}

const db = mongoClient.db("batepapouol");
const Participants = db.collection("participants");
const Messages = db.collection("messages");

let insereMessage = async (messObg) => {
  const { from, to, text, type } = messObg;

  return Messages.insertOne({
    from,
    to,
    text,
    type,
    time: dayjs().format("HH:mm:ss"),
  });
};

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  try {
    const validation = uolpSchema.validate({ name }, { abortEarly: false });
    if (validation.error) {
      const errors = validation.error.details.map((detail) => detail.message);
      res.status(422);
      return;
    }

    const nameExists = await Participants.findOne({ name });
    if (nameExists) {
      return res.status(409);
    }

    await Participants.insertOne({
      name: name,
      lastStatus: Date.now(),
    });
    await insereMessage({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
    });
    res.status(201);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await Participants.find().toArray();
    res.send(participants);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;

  try {
    const userExists = await Participants.findOne({ name: user });
    if (!userExists) {
      return res.status(422);
    }
    await Participants.updateOne(
      { name: user },
      { $set: { lastStatus: Date.now() } }
    );
    await insereMessage({ from: user, to, text, type });
    res.status(201);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get("/messages", async (req, res) => {
  const limit = req.params.limit;
  const { user } = req.headers;

  try {
    if (limit){
      const menssages = await Messages.find({$or: [{name: user}, {to: user}]}).limit(limit).toArray();
      res.send(menssages);
    }else{
      const menssages = await Messages.find({$or: [{name: user}, {to: user}]}).toArray();
      res.send(menssages);
    }
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

app.post("/status", async (req, res) => {
  const { user } = req.header;
  console.log ("Status: "+user)
  try {
    const userExists = await Participants.findOne({ name: user });
    if (!userExists) {
      return res.status(404);
    }

    await Participants.updateOne(
      { name: user },
      { $set: { lastStatus: Date.now() } }
    );
    res.status(200);
  } catch (err) {
    res.status(500).send(err);
  }
});

setInterval(async() => {
  const adel = await Participants.find({lastStatus: {$lt: Date.now()-10000}}).toArray()
  adel.map(function (u) {
    insereMessage({
      from: u.name,
      to: "Todos",
      text: "sai na sala...",
      type: "status",
    });
  });
  await Participants.deleteMany({ lastStatus: {$lt: Date.now()-10000} })
}, 15000);

app.listen(5000, () => {
  console.log("Runing in port 5000");
});
