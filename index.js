const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()

const app = express();
const port = process.env.PORT || 5050

// Middleware
app.use(express.json())
app.use(cors())


// MONGODB URI
const uri = process.env.MONGODB_URI

app.get('/', (req, res) => {
    res.send('Hello World!');
});



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        // connect to the database;
        const database = client.db(process.env.DB_NAME)
        const lessonsCollection = database.collection("lessons")


        // Send a ping to confirm a successful connection
        await database.command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}


run().catch(console.dir);

app.listen(port, () => {
    console.log(`Server run on listening port ${port}`);
});