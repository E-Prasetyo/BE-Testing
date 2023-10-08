require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { graphqlHTTP } = require('express-graphql');
const fileUtil = require('./utils/removeFile')
const serverless = require("serverless-http");

const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/is-auth')

const app = express();

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'images')
  },
  filename: (req, file, cb) => {
    // cb(null, moment().format('YYYY-MM-DD-HHmmss') + file.originalname )
    cb(null, uuidv4() )
  }
})

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg' ||
    file.mimetype === 'image/jpeg'
  ) {
    cb(null, true)
  } else {
    cb(null, false)
  }
}

// path.dirname(process.mainModule.filename);

app.use(cors())
// app.use(bodyParser.urlencoded()); // x-www-form-urlencoded <form>
app.use(bodyParser.json()); // application/json
app.use(multer({ storage: fileStorage, fileFilter: fileFilter }).single('image'));
app.use('/images', express.static(path.join(__dirname, 'images')))

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === "OPTIONS") {
    return res.sendStatus(200)
  }
    next();
});

app.use(auth)

app.put('/post-image', (req, res, next) => {
  if (!req.isAuth) {
    return res.status(200).json({ message: 'No !'})
  }
  if (!req.file) {
    return res.status(200).json({ message: 'No file provided!'})
  }
  if (req.body.oldPath) {
    fileUtil.removeFile(req.body.oldPath);
  }
  return res.status(200).json({ message: 'file store', filePath: req.file.path})
});

app.use('/graphql', graphqlHTTP({
  schema: graphqlSchema,
  rootValue: graphqlResolver,
  graphiql: true,
  customFormatErrorFn(err) {
    if (!err.originalError) {
      return err;
    }
    const data = err.originalError.data;
    const message = err.message || 'An error occurred.';
    const code = err.originalError.code || 500;
    return { message: message, status: code, data: data }
  }
}));


app.use((error, req, res, next) => {
  console.log(error);
  const status = error.statusCode || 500;
  const message = error.message;
  res.status(status).json({ message: message });
});

mongoose
  .connect(process.env.APP_DB_MONGGODB)
  .then(result => {
    app.listen(process.env.APP_PORT);
    console.log('Client connected in ' + process.env.APP_PORT);
  })
  .catch(err => console.log(err));

  module.exports.handler = serverless(app);

  