const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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


        // ----------------lessons related apis------------------

        // get featured lesson data ;
        app.get('/api/featured-lessons', async (req, res) =>{
            const cursor = lessonsCollection.find({isFeatured: true});
            const result = await cursor.sort({createdAt: -1}).limit(6).toArray();
            res.send(result)
        })
        
        // get all lessons for all users with search and filtering;
        app.get("/api/all-lessons", async (req, res) => {
            const { search, category, emotionalTone, sortBy} = req.query;

            const query = { visibility: "public" }

            if (search) {
                query.$or = [
                    { lessonTitle: { $regex: search, $options: "i" } },
                    { lessonDescription: { $regex: search, $options: "i" } }
                ]
            }
            if (category) query.category = category;
            if (emotionalTone) query.emotionalTone = emotionalTone;
            let sortQuery = {}
            if (sortBy === 'newest') {
                sortQuery = { createdAt: -1 }
            }
            // else if (sortBy === "mostSaved") {
            //     // sortQuery = {}
            // }

            const page = Number(req.query.page || 1)
            const perPage = req.query.perPage || 6;
            const skipItems = (page - 1) * perPage;
            const [total, lessons] =await Promise.all([
                lessonsCollection.countDocuments(query),
                lessonsCollection.find(query)
                .sort(sortQuery).skip(skipItems).limit(perPage)
                .toArray()
            ])
          res.status(200).send({
            total, lessons
          })

        })

        // create a new lesson ;
        app.post('/api/create-lesson', async (req, res) => {
            const data = req.body;
            const createLesson = {
                ...data,
                createdAt: new Date()
            }
            const result = await lessonsCollection.insertOne(createLesson);
            res.send(result || {})
        })

        // get my lessons data;
        app.get('/api/my-lessons', async (req, res) => {
            const { creatorId } = req.query;
            const cursor = lessonsCollection.find({ creatorId: creatorId });
            const result = await cursor.toArray()
            res.send(result)
        })

        // get single lesson by id and update;
        app.patch('/api/update-lesson/:lessonId', async (req, res) => {
            const { lessonId } = req.params;
            const updateLesson = req.body;

            const query = { _id: new ObjectId(lessonId) }
            const updateDoc = {
                $set: { ...updateLesson, lastUpdated: new Date() }
            }

            const result = await lessonsCollection.updateOne(query, updateDoc)
            res.send(result)
        })

        // delete lesson;
        app.delete("/api/delete-lesson/:lessonId", async (req, res) => {
            const lessonId = req.params.lessonId;
            const deleteLesson = await lessonsCollection.deleteOne({
                _id: new ObjectId(lessonId)
            })
            res.send(deleteLesson)
        })

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