"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Camera, RefreshCw, AlertCircle } from "lucide-react";
import jsQR from "jsqr";

interface QrScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: string) => void;
}

export default function QrScannerDialog({
  isOpen,
  onClose,
  onScanSuccess,
}: QrScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Play a beautiful POS scan beep using synthesized browser AudioContext
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime); // High pitch beep
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime); // Low volume
      
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        audioCtx.close();
      }, 120);
    } catch (e) {
      console.warn("Could not play audio scan signal:", e);
    }
  };

  // Start video stream
  const startCamera = async () => {
    setError(null);
    setIsCameraActive(false);
    
    // Clean up any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      // First try environment (back) camera
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      // If exact environment camera fails, try any available video camera
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          setIsCameraActive(true);
        }
      } catch (fallbackErr) {
        setError(
          "Unable to access camera. Please ensure camera permissions are allowed."
        );
      }
    }
  };

  // Switch facing camera mode
  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Stop video stream
  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Scanning loop using requestAnimationFrame
  useEffect(() => {
    if (!isOpen) return;

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  // Frame decoding loop
  useEffect(() => {
    if (!isCameraActive) return;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // Draw the video frame on the canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Fetch image pixels
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // Run jsQR decoder
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data) {
            playBeep();
            onScanSuccess(code.data);
            stopCamera();
            onClose();
            return;
          }
        }
      }
      requestRef.current = requestAnimationFrame(tick);
    };

    requestRef.current = requestAnimationFrame(tick);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isCameraActive]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-indigo-650" />
            <h2 className="font-extrabold text-slate-900 text-sm sm:text-base">
              Scan Product QR Code
            </h2>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Camera Feed Screen */}
        <div className="relative aspect-square w-full bg-slate-950 flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center text-rose-500 flex flex-col items-center gap-2.5">
              <AlertCircle className="h-10 w-10" />
              <p className="text-sm font-semibold">{error}</p>
            </div>
          ) : (
            <>
              {/* HTML5 Video element */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover"
              />
              {/* Offscreen decoding Canvas */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Holographic targeting square & scan overlay */}
              {isCameraActive && (
                <div className="absolute inset-0 flex items-center justify-center p-12 pointer-events-none">
                  <div className="relative w-64 h-64 border-2 border-indigo-500/80 rounded-2xl flex items-center justify-center">
                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-indigo-500 -translate-x-1 -translate-y-1 rounded-tl-md" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-indigo-500 translate-x-1 -translate-y-1 rounded-tr-md" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-indigo-500 -translate-x-1 translate-y-1 rounded-bl-md" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-indigo-500 translate-x-1 translate-y-1 rounded-br-md" />

                    {/* Lasers line animation */}
                    <div className="w-full h-0.5 bg-rose-500 absolute top-0 left-0 right-0 shadow-md shadow-rose-500/80 animate-scan" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Scan helper info / Controls */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500 leading-snug">
            Align the product QR code printed on the sticker label inside the camera viewfinder square.
          </p>
          
          {!error && (
            <button
              onClick={toggleCameraFacing}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs shrink-0 transition-all active:scale-95 shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Flip Camera
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
