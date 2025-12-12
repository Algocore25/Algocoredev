import React, { useRef, useEffect } from 'react';

export const VideoCanvas = ({ videoRef, detections, isActive }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!isActive || detections.length === 0) return;

    // Draw bounding boxes
    detections.forEach((detection, index) => {
      const [x, y, width, height] = detection.bbox;

      // Set box color based on detection count
      const color = detections.length === 1 ? '#10b981' : '#ef4444';

      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.fillStyle = color;

      // Draw bounding box
      ctx.strokeRect(x, y, width, height);

      // Draw label background
      const label = `Person ${index + 1} (${Math.round(detection.score * 100)}%)`;
      const labelWidth = ctx.measureText(label).width + 10;

      ctx.fillRect(x, y - 25, labelWidth, 25);

      // Draw label text
      ctx.fillStyle = 'white';
      ctx.font = '14px Arial';
      ctx.fillText(label, x + 5, y - 8);
    });
  }, [detections, isActive]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
};
