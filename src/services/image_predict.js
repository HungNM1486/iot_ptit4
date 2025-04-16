const tf = require("@tensorflow/tfjs-node");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");

const sharp = require("sharp");

const MODEL_PATH = process.env.MODEL_PATH || path.join(process.cwd(), "tfjs_model");

const PLANT_DISEASE_CLASSES = [
  "Pepper_bell_healthy",
  "Pepper_bell_bacterial_spot",
  "Tomato_Early_blight",
  "Potato_Early_blight",
  "Potato_Late_blight",
  "Tomato_Bacterial_spot",
  "Tomato_Leaf_Mold",
  "Tomato_Septoria_leaf_spot",
  "Tomato_healthy",
  "Tomato_Late_blight",
  "Potato_healthy",
  "Tomato_Target_Spot",
  "Tomato_Spider_mites",
  "Tomato_Yellow_Leaf_Curl_Virus",
  "Tomato_mosaic_virus",
];

class ImagePredictionService {
  constructor() {
    this.model = null;
    this.labels = null;
    this.isLoaded = false;
    
    // Đảm bảo thư mục model tồn tại
    if (!fs.existsSync(MODEL_PATH)) {
      console.warn(`Thư mục model không tồn tại: ${MODEL_PATH}`);
    }
  }

  async loadModel() {
    try {
      console.log("Đang tải model...");
      console.log(`Đường dẫn model: ${MODEL_PATH}/model_fixed2.json`);
      
      this.model = await tf.loadLayersModel(
        `file://${MODEL_PATH}/model_fixed2.json`
      );

      const labelsPath = path.join(MODEL_PATH, "labels.json");
      if (fs.existsSync(labelsPath)) {
        this.labels = JSON.parse(
          fs.readFileSync(labelsPath, "utf8")
        );
        console.log("Đã tải labels thành công!");
      } else {
        console.log("File labels không tồn tại, sử dụng classes mặc định.");
      }

      this.isLoaded = true;
      console.log("Đã tải model thành công!");
    } catch (error) {
      console.error("Lỗi khi tải model:", error);
      throw new Error(`Không thể tải model: ${error.message}`);
    }
  }

  async ensureModelLoaded() {
    if (!this.isLoaded) {
      await this.loadModel();
    }
  }

  async preprocessImage(imagePath) {
    try {
      console.log(`Đang xử lý ảnh: ${imagePath}`);
      
      // Kiểm tra tồn tại của file
      if (!fs.existsSync(imagePath)) {
        throw new Error(`File ảnh không tồn tại: ${imagePath}`);
      }
      
      const imageBuffer = await sharp(imagePath).resize(224, 224).toBuffer();

      const imageTensor = tf.node.decodeImage(imageBuffer, 3);

      const normalizedImage = imageTensor.div(255.0);

      const batchedImage = normalizedImage.expandDims(0);

      return batchedImage;
    } catch (error) {
      console.error("Lỗi khi tiền xử lý ảnh:", error);
      throw new Error(`Không thể xử lý ảnh: ${error.message}`);
    }
  }

  async predict(imagePath) {
    try {
      await this.ensureModelLoaded();

      const inputTensor = await this.preprocessImage(imagePath);

      console.log("Đang thực hiện dự đoán...");
      const predictions = await this.model.predict(inputTensor);

      const predictionData = Array.isArray(predictions)
        ? await predictions[0].data()
        : await predictions.data();

      const predictionArray = Array.from(predictionData);
      const maxProbability = Math.max(...predictionArray);
      const classIndex = predictionArray.indexOf(maxProbability);
      
      // Kiểm tra tính hợp lệ của classIndex
      if (classIndex < 0 || classIndex >= PLANT_DISEASE_CLASSES.length) {
        throw new Error(`Class index không hợp lệ: ${classIndex}`);
      }

      const results = {
        prediction: classIndex,
        className: PLANT_DISEASE_CLASSES[classIndex],
        probability: maxProbability,
        allProbabilities: predictionArray.map((prob, idx) => ({
          className: PLANT_DISEASE_CLASSES[idx],
          probability: prob
        }))
      };

      // Giải phóng bộ nhớ tensor
      tf.dispose(inputTensor);
      tf.dispose(predictions);

      console.log(`Kết quả dự đoán: ${results.className} (${maxProbability})`);
      return results;
    } catch (error) {
      console.error("Lỗi khi dự đoán:", error);
      throw new Error(`Không thể thực hiện dự đoán: ${error.message}`);
    }
  }
}

const service = new ImagePredictionService();
module.exports = service;