const express = require('express');
const cors = require('cors')
require('dotenv').config()

const app = express();
const port =process.env.PORT || 5050

// Middleware
app.use(express.json())
app.use(cors())

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server run on listening port ${port}`);
});