import * as tf from "@tensorflow/tfjs";
import { loadGraphModel } from "@tensorflow/tfjs";

const MODEL_URL = "./tfjs_model/model.json";

const loadModel = async () => {
  const model = await loadGraphModel(MODEL_URL);
  return model;
};
