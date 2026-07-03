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
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("Initializing...");

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
    setDebugInfo("Requesting camera permissions...");
    
    // Clean up any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setDebugInfo("Camera active. Waiting for frames...");
      }
    } catch (err: any) {
      console.error("Camera access failed:", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          setIsCameraActive(true);
          setDebugInfo("Fallback camera active.");
        }
      } catch (fallbackErr) {
        setError(
          "Unable to access camera. Please ensure camera permissions are allowed."
        );
        setDebugInfo("Error: Camera access denied.");
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
    setDebugInfo("Camera stopped.");
  };

  // Scanning loop using requestAnimationFrame
  useEffect(() => {
    if (!isOpen) return;

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  // Frame decoding loop with time-throttling & proportional downscaling
  useEffect(() => {
    if (!isCameraActive) return;

    // Create a single canvas instance in memory to reuse across tick frames
    const canvas = document.createElement("canvas");
    let lastScanTime = 0;

    const tick = () => {
      const video = videoRef.current;

      if (!video) {
        setDebugInfo("Waiting for video ref...");
        requestRef.current = requestAnimationFrame(tick);
        return;
      }

      if (video.readyState < 2) {
        setDebugInfo(`Loading stream (ReadyState: ${video.readyState})...`);
        requestRef.current = requestAnimationFrame(tick);
        return;
      }

      const now = performance.now();
      // Throttle scanning to once every 200ms (5 FPS is instant but keeps CPU usage minimal)
      if (now - lastScanTime >= 200) {
        lastScanTime = now;

        if (video.videoWidth > 0 && video.videoHeight > 0) {
          try {
            // Proportional downscaling (limit width to max 600px for speed)
            const maxDimension = 600;
            let width = video.videoWidth;
            let height = video.videoHeight;

            if (width > maxDimension) {
              const ratio = maxDimension / width;
              width = maxDimension;
              height = Math.round(video.videoHeight * ratio);
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            
            if (ctx) {
              // Draw video frame downscaled
              ctx.drawImage(video, 0, 0, width, height);
              
              // Get pixels
              const imageData = ctx.getImageData(0, 0, width, height);
              
              // Next.js ESM/CJS safe import fallback
              const qrDecoder = typeof jsQR === "function" ? jsQR : (jsQR as any).default;
              
              if (typeof qrDecoder === "function") {
                setDebugInfo(`Scanning scaled ${width}x${height}...`);
                
                const code = qrDecoder(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: "attemptBoth",
                });

                if (code && code.data) {
                  setDebugInfo(`Decoded: ${code.data}`);
                  playBeep();
                  onScanSuccess(code.data);
                  stopCamera();
                  onClose();
                  return;
                }
              } else {
                setDebugInfo("Error: jsQR decoder function is missing.");
              }
            } else {
              setDebugInfo("Error: Canvas context is null.");
            }
          } catch (err: any) {
            setDebugInfo(`Loop Error: ${err.message || err}`);
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

              {/* Live HUD overlay */}
              <div className="absolute bottom-3 left-3 right-3 bg-slate-950/80 text-[10px] text-indigo-400 font-mono py-1 px-2.5 rounded-lg border border-slate-800 text-center select-none pointer-events-none z-30 tracking-tight">
                {debugInfo}
              </div>

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
