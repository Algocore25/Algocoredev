import { useCallback, useState, useEffect } from 'react';

export const usePersonDetection = () => {
  const [model, setModel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsLoading(true);
        // cocoSsd is provided globally via a script tag in index.html
        const loadedModel = await globalThis.cocoSsd.load();
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

  const detectPersons = useCallback(async (videoElement) => {
    if (!model || !videoElement) return [];

    try {
      const predictions = await model.detect(videoElement);
      return predictions
        .filter((prediction) => prediction.class === 'person')
        .map((prediction) => ({
          class: prediction.class,
          score: prediction.score,
          bbox: prediction.bbox,
        }));
    } catch (err) {
      console.error('Detection error:', err);
      return [];
    }
  }, [model]);

  return { detectPersons, isLoading, error, modelReady: !!model };
};
