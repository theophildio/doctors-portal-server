const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { json } = require('express/lib/response');
const jwt = require('jsonwebtoken');
const res = require('express/lib/response');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
var nodemailer = require('nodemailer');
var sgTransport = require('nodemailer-sendgrid-transport');

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.3hxoz.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if(!authHeader) {
    return res.status(401).send({message: '401 Unauthorized access'});
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
    if(err) {
      return res.status(403).send({message: '403 Forbidden access'});
    }
    req.decoded = decoded;
    next();
  });
}

var senderOptions = {
  auth: {
    api_key: process.env.EMAIL_SENDER_KEY
  }
}

var emailClient = nodemailer.createTransport(sgTransport(senderOptions));

function sendAppointmentEmail (booking) {
  const {patientName, patientEmail, treatment, date, slot} = booking;
  var email = {
    from: process.env.EMAIL_SENDER,
    to: patientEmail,
    subject: `Appointment confirmatin for ${treatment} on ${date} at ${slot}`,
    text: `Your appointment confirmatin for ${treatment} on ${date} at ${slot}`,
    html: `
      <div>
      <p> Hello ${patientName}, </p>
      <h3>Your Appointment for ${treatment} is confirmed</h3>
      <p>Looking forward to seeing you on ${date} at ${slot}.</p>
      
      <h3>Our Address</h3>
      <p>Nodda, Dhaka</p>
      <p>Bangladesh</p>
      <a href="https://codertheo.com">unsubscribe</a>
     </div>
    `
  };

  emailClient.sendMail(email, function(err, info){
    if (err ){
      console.log(err);
    }
    else {
      console.log('Message sent: ', info);
    }
  });
}

async function run() {
  try{
    await client.connect();
    // Data collections
    const servicesCollection = client.db('doctorsPortal').collection('services');
    const bookingCollection = client.db('doctorsPortal').collection('bookings');
    const userCollection = client.db('doctorsPortal').collection('users');
    const doctorCollection = client.db('doctorsPortal').collection('doctors');

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({ email: requester });
      if (requesterAccount.role === 'admin') {
        next();
      }
      else{
        res.status(403).send({message: 'forbidden'});
      }
    }

    // Get all appointments
    app.get('/service', async(req, res) => {
      const query  = {};
      const cursor = servicesCollection.find(query).project({name: 1});
      const services = await cursor.toArray();
      res.send(services);
    });

    // Get all users
    app.get('/user', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    })

    // Admin 
    app.get('/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({email: email});
      const isAdmin = user.role === 'admin';
      res.send({admin: isAdmin});
    })

    // Make admin
    app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
        const filter = { email: email };
        const updateDoc = {
          $set: { role: 'admin' },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
    })

    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = {email: email};
      const options = {upsert: true};
      const updateDoc = {$set: user};
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({email: email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
      res.send({result, token});
    });

    // Get avaiable booking
    app.get('/available',  async (req, res) => {
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

    app.get('/appointment', verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if(patient === decodedEmail) {
        const query = {patientEmail: patient};
        const bookings = await bookingCollection.find(query).toArray();
        return res.send(bookings);
      }
      else {
        return res.status(403).send({message: '403 Forbidden access'});
      }
    })

    // Book a appointment
    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = {date: booking.date, patientEmail: booking.patientEmail, slot: booking.slot}
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({success: false, booking: exists})
      }
      const result = await bookingCollection.insertOne(booking);
      sendAppointmentEmail(booking);
      return res.send({success: true, result});
    });

    app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors);
    })

    // Add Doctor
    app.post('/doctor', verifyJWT, verifyAdmin, async(req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });

    app.delete('/doctor/:email', verifyJWT, verifyAdmin, async(req, res) => {
      const email = req.params.email;
      const filter = {email: email}
      const result = await doctorCollection.deleteOne(filter);
      res.send(result);
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