const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { json } = require('express/lib/response');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.3hxoz.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run() {
  try{
    await client.connect();
    const servicesCollection = client.db('doctorsPortal').collection('services');

    app.get('/service', async(req, res) => {
      const query  = {};
      const cursor = servicesCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    })
  }
  finally{

  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello Doctors Portal!')
})

app.listen(port, () => {
  console.log(`Doctors Portal app listening on port ${port}`)
})