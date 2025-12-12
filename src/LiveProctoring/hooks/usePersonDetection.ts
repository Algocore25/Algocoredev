import { useCallback, useRef, useState, useEffect } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import { DetectionResult } from '../types/proctoring';

export const usePersonDetection = () => {
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsLoading(true);
        const loadedModel = await cocoSsd.load();
        setModel(loadedModel);
        setError(null);
      } catch (err) {
        setError('Failed to load detection model');
        console.error('Model loading error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadModel();
  }, []);

  const detectPersons = useCallback(async (
    videoElement: HTMLVideoElement
  ): Promise<DetectionResult[]> => {
    if (!model || !videoElement) return [];

    try {
      const predictions = await model.detect(videoElement);
      return predictions
        .filter(prediction => prediction.class === 'person')
        .map(prediction => ({
          class: prediction.class,
          score: prediction.score,
          bbox: prediction.bbox as [number, number, number, number]
        }));
    } catch (err) {
      console.error('Detection error:', err);
      return [];
    }
  }, [model]);

  return { detectPersons, isLoading, error, modelReady: !!model };
};