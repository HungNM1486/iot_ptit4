const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const fileUploadRouter = require('./handler/file_upload');
const predictService = require('./services/image_predict');

const app = express();
const port = 3000;

// Kết nối MongoDB
const uri = process.env.MONGODB_URI || 'mongodb://admin:password@localhost:27017/smart_agriculture';
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use('/', fileUploadRouter);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Tải model TensorFlow
(async () => {
  try {
    await predictService.loadModel();
  } catch (error) {
    console.error('Lỗi khi khởi tạo model:', error);
  }
})();

app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});

module.exports = app;
