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
    // Data collections
    const servicesCollection = client.db('doctorsPortal').collection('services');
    const bookingCollection = client.db('doctorsPortal').collection('bookings');

    // Get all appointments
    app.get('/service', async(req, res) => {
      const query  = {};
      const cursor = servicesCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });

    // Get avaiable booking
    app.get('/available', async (req, res) => {
      const date = req.query.date;
      const services = await servicesCollection.find().toArray();
      // Get all booking of the day
      const query = {date: date};
      const bookings = await bookingCollection.find(query).toArray();
      // for each services to find bookings for that service
      services.forEach(service => {
        const serviceBookings = bookings.filter(book => book.treatment === service.name);
        const bookedSlots = serviceBookings.map(book => book.slot);
        const avaiable = service.slots.filter(slot => !bookedSlots.includes(slot));
        service.slots = avaiable;
      });
      res.send(services);
    })

    // Book a appointment
    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = {date: booking.date, patient: booking.patient, slot: booking.slot}
      console.log(query);
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({success: false, booking: exists})
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({success: true, result});
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