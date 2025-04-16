const multer = require("multer");
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const predictService = require("../services/image_predict");

const router = express.Router(); 

// Đảm bảo thư mục temp và uploads tồn tại
const tempDir = path.join(process.cwd(), "temp");
const uploadDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "temp/");
  },
  filename: (req, file, cb) => {
    const tempFilename = `temp_${Date.now()}_${Math.round(
      Math.random() * 1000000
    )}`;
    cb(null, tempFilename);
  },
});

const upload = multer({ storage });

router.post("/upload/init", (req, res) => {
  const fileId = crypto.randomUUID();

  console.log(`File ID: ${fileId}`);

  res.json({
    success: true,
    fileId,
  });
});

router.post("/upload/chunk", upload.single("chunk"), (req, res) => {
  const { fileId, chunkId, totalChunks, fileName } = req.body;

  console.log("Request body:", req.body);

  if (!fileId || chunkId === undefined || !totalChunks) {
    res.status(400).json({
      success: false,
      message: "Missing parameters",
    });

    return;
  }

  console.log("Uploaded file:", req.file);

  if (!req.file) {
    res.status(400).json({
      success: false,
      message: "No file uploaded",
    });

    return;
  }

  const newFilename = `${fileId}_${chunkId}`;
  const oldPath = req.file.path;
  const newPath = path.join("temp", newFilename);

  try {
    fs.renameSync(oldPath, newPath);

    res.json({
      success: true,
      fileId,
      chunkId: parseInt(chunkId),
      message: `Chunk ${chunkId} uploaded successfully`,
    });
  } catch (error) {
    console.error("Error renaming file:", error);
    res.status(500).json({
      success: false,
      message: "Error processing file",
    });
  }
});

router.post("/upload/complete", async (req, res) => {
  const { fileId, fileName, totalChunks } = req.body;

  if (!fileId || !fileName || !totalChunks) {
    res.status(400).json({
      success: false,
      message: "Missing parameters",
    });

    return;
  }

  try {
    // Khai báo mảng missingChunks
    const missingChunks = [];
    
    // Kiểm tra các chunk đã tải lên
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join("temp", `${fileId}_${i}`);

      if (!fs.existsSync(chunkPath)) {
        missingChunks.push(i);
      }
    }

    if (missingChunks.length > 0) {
      res.status(400).json({
        success: false,
        message: "Missing chunks",
        missingChunks,
      });

      return;
    }

    // Tạo đường dẫn đầy đủ với uploadDir
    const file = path.join(uploadDir, fileName);
    const writeStream = fs.createWriteStream(file);

    // Ghép các chunk
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join("temp", `${fileId}_${i}`);
      const chunk = fs.readFileSync(chunkPath);

      writeStream.write(chunk);
      fs.unlinkSync(chunkPath); // Xóa chunk sau khi sử dụng
    }

    writeStream.end();

    // Đợi writeStream hoàn thành trước khi dự đoán
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const result = await predictService.predict(file);

    res.json({
      success: true,
      result,
      filePath: file,
    });
  } catch (error) {
    console.error("Error completing upload:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error processing file",
    });
  }
});

module.exports = router;