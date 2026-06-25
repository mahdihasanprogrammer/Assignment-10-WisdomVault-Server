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
        const lessonsCollection = database.collection("lessons");
        const favoritesCollection = database.collection("favorites");
        const commentsCollection = database.collection('comments');
        const lessonsReportsCollection = database.collection('lessonsReports')


        // ----------------lessons related apis------------------

        //1. get lesson data by _id;
        app.get('/api/public-lessons/:id', async (req, res) => {
            const { id } = req.params;
            const result = await lessonsCollection.findOne({ _id: new ObjectId(id) })
            res.send(result)
        })

        // get lessons by author id , the id is dynamic;
        app.get('/api/author-lessons/:authorId', async (req, res) => {

            const authorId = req.params.authorId;
            const query = {
                creatorId: authorId,
                visibility: "public"
            };

            const total = await lessonsCollection.countDocuments(query);
            const lessons = await lessonsCollection.find(query).toArray();
            res.send({ total, lessons });
        })

        //2. get featured lesson data ;
        app.get('/api/featured-lessons', async (req, res) => {
            const cursor = lessonsCollection.find({ isFeatured: true });
            const result = await cursor.sort({ createdAt: -1 }).limit(6).toArray();
            res.send(result)
        })

        //3. get all lessons for all users with search and filtering;
        app.get("/api/all-lessons", async (req, res) => {
            const { search, category, emotionalTone, sortBy } = req.query;

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
            const [total, lessons] = await Promise.all([
                lessonsCollection.countDocuments(query),
                lessonsCollection.find(query)
                    .sort(sortQuery).skip(skipItems).limit(perPage)
                    .toArray()
            ])
            res.status(200).send({
                total, lessons
            })

        })


        // toggle like , add or remove;
        app.post('/api/lessons/:lessonId/like', async (req, res) => {
            const { lessonId } = req.params;
            const { userId } = req.body;
            const query = { _id: new ObjectId(lessonId) }

            const lesson = await lessonsCollection.findOne(query);
            const hasLiked = lesson.likes?.includes(userId);

            const updateDoc = hasLiked ?
                { $pull: { likes: userId }, $inc: { likesCount: -1 } }
                : { $push: { likes: userId }, $inc: { likesCount: 1 } };


            const result = await lessonsCollection.updateOne(query, updateDoc);

            res.send(result)
        })

        //4. get my lessons data;
        app.get('/api/my-lessons', async (req, res) => {
            const { creatorId } = req.query;
            const cursor = lessonsCollection.find({ creatorId: creatorId });
            const result = await cursor.toArray()
            res.send(result)
        })

        //5. get single lesson by id and update;
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

        //6. create a new lesson ;
        app.post('/api/create-lesson', async (req, res) => {
            const data = req.body;
            const createLesson = {
                ...data,
                createdAt: new Date()
            }
            const result = await lessonsCollection.insertOne(createLesson);
            res.send(result || {})
        })

        //7. delete lesson;
        app.delete("/api/delete-lesson/:lessonId", async (req, res) => {
            const lessonId = req.params.lessonId;
            const deleteLesson = await lessonsCollection.deleteOne({
                _id: new ObjectId(lessonId)
            })
            res.send(deleteLesson)
        })

        //----------favorites lessons related apis----------

        // get favorites by lesson id;
        app.get('/api/favorite-lesson/:id', async (req, res) => {
            const { id } = req.params;
            const { userId } = req.query;
            const query = { lessonId: id, userId: userId }
            const totalFavorite = await favoritesCollection.countDocuments({ lessonId: id });
            const favorite = await favoritesCollection.findOne(query);
            if (favorite) {
                res.send({ totalFavorite, isFavorite: true })
            } else {
                res.send({ totalFavorite, isFavorite: false })
            }


        })

        // toggle , add and count or decrement and remove
        app.post('/api/lessons/:lessonId/favorite', async (req, res) => {
            const { lessonId } = req.params;
            const data = req.body;
            const query = { lessonId: lessonId, userId: data.userId };


            const existingFavorite = await favoritesCollection.findOne(query);


            if (existingFavorite) {
                const result = await favoritesCollection.deleteOne(query)
                const total = await favoritesCollection.countDocuments({ lessonId: lessonId });
                return res.send({ success: true, total: total, isFavorite: false, message: "Removed from favorites" })
            }
            else {
                const newFavorite = {
                    ...data,
                    savedAt: new Date()
                }
                const result = await favoritesCollection.insertOne(newFavorite);
                const total = await favoritesCollection.countDocuments({ lessonId: lessonId });
                return res.status(200).send({ success: true, total: total, isFavorite: true, message: "Added to favorites" })
            }

        })


        //---------- lesson comments related apis----------

        // get comment by lesson id;
        app.get('/api/lesson-comments/:lessonId', async(req, res) =>{
            const {lessonId} = req.params;
            const query = {lessonId: lessonId};
            const result = await commentsCollection.find(query).sort({createdAt: -1}).toArray();
            res.send(result)
        })

        // create a comment;
        app.post('/api/lesson/create-comment/:lessonId', async (req, res) => {
            const { lessonId } = req.params;
            const  commentData  = req.body;
            const newCommentData = {
                ...commentData,
                createdAt: new Date()
            }

            const addCommentToDB = await commentsCollection.insertOne(newCommentData);

            const comments = await commentsCollection.find({lessonId})
            .sort({createdAt: -1}).toArray()

            res.send(comments)

        })


        //----------lessons Report related apis----------

        // create a report in a single lesson;
        app.post('/api/lesson/create-report', async(req, res) =>{
          
            const reportData = req.body;
            const addReport = {
                ...reportData, 
                createdAt: new Date()
            }
            const insertReport = await lessonsReportsCollection.insertOne(addReport);
            res.send(insertReport)
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