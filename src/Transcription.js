import React, { useState, useRef, useEffect } from 'react';

const Transcription = () => {
  const [status, setStatus] = useState('Ready to connect');
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const mediaRecorderRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const transcriptBufferRef = useRef('');

  // Throttle function to limit DOM updates
  const throttle = (fn, limit) => {
    let lastCall = 0;
    return (...args) => {
      const now = new Date().getTime();
      if (now - lastCall >= limit) {
        lastCall = now;
        return fn(...args);
      }
    };
  };

  // Update transcript with throttling
  const updateTranscript = throttle(() => {
    setTranscript(transcriptBufferRef.current);
  }, 500); // Update every 500ms (adjust as needed)

  const startRecording = () => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((audioStream) => {
        streamRef.current = audioStream;

        if (!MediaRecorder.isTypeSupported('audio/webm')) {
          return alert('Browser not supported');
        }

        mediaRecorderRef.current = new MediaRecorder(audioStream, {
          mimeType: 'audio/webm',
        });

        socketRef.current = new WebSocket('wss://aiscribe.quipohealth.com/ws');

        socketRef.current.onopen = () => {
          setStatus('Connected');
          mediaRecorderRef.current.start(500); // Send audio chunks every 500ms
          mediaRecorderRef.current.addEventListener('dataavailable', (event) => {
            if (event.data.size > 0 && socketRef.current.readyState === 1) {
              socketRef.current.send(event.data);
            }
          });

          setIsRecording(true);
        };

        socketRef.current.onmessage = (message) => {
          const received = message.data;
          if (received) {
            transcriptBufferRef.current += ' ' + received;
            updateTranscript();
          }
        };

        socketRef.current.onclose = () => {
          setStatus('Connection closed');
          resetButtons();
        };

        socketRef.current.onerror = (error) => {
          setStatus('Error occurred');
          console.error('WebSocket error:', error);
          resetButtons();
        };
      })
      .catch((err) => {
        setStatus('Failed to access microphone');
        console.error('Microphone error:', err);
        resetButtons();
      });
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus('Paused');
      setIsPaused(true);
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('Recording');
      setIsPaused(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (socketRef.current) {
      socketRef.current.close();
    }
    setStatus('Stopped');
    resetButtons();
  };

  const resetButtons = () => {
    setIsRecording(false);
    setIsPaused(false);
  };

  return (
    <div>
      <h1>Transcribe Audio With FastAPI</h1>
      <p id="status">{status}</p>

      <div id="controls">
        <button
          id="startBtn"
          onClick={startRecording}
          disabled={isRecording}
          style={{ backgroundColor: '#2ecc71' }}
        >
          Start
        </button>

        <button
          id="pauseBtn"
          onClick={pauseRecording}
          disabled={!isRecording}
          style={{ backgroundColor: '#f39c12' }}
        >
          {isPaused ? 'Resume' : 'Pause'}
        </button>

        <button
          id="stopBtn"
          onClick={stopRecording}
          disabled={!isRecording}
          style={{ backgroundColor: '#e74c3c' }}
        >
          Stop
        </button>
      </div>

      <div id="transcript" style={{
        whiteSpace: 'pre-wrap',
        marginTop: '20px',
        maxHeight: '300px',
        overflowY: 'auto',
        border: '1px solid #bdc3c7',
        padding: '15px',
        backgroundColor: '#ffffff',
        borderRadius: '5px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
      }}>
        {transcript}
      </div>
    </div>
  );
};

export default Transcription;