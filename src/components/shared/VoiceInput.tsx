import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { speechToText, type LanguageCode } from '../../services/sarvam';
import { useAppStore } from '../../store';

interface VoiceInputProps {
  onResult: (text: string) => void;
  className?: string;
}

export function VoiceInput({ onResult, className = '' }: VoiceInputProps) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const language = useAppStore(s => s.language);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      console.log('[VoiceInput] Requesting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[VoiceInput] Mic granted, starting recording...');

      // Check supported mime types
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      console.log('[VoiceInput] Using MIME type:', mimeType);
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        console.log('[VoiceInput] Data available:', e.data.size, 'bytes');
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onerror = (e) => {
        console.error('[VoiceInput] MediaRecorder error:', e);
        setRecording(false);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.onstop = async () => {
        console.log('[VoiceInput] Recording stopped. Chunks:', chunksRef.current.length);
        stream.getTracks().forEach(t => t.stop());
        setProcessing(true);

        try {
          const blob = new Blob(chunksRef.current, { type: mimeType });
          console.log('[VoiceInput] Audio blob size:', blob.size, 'bytes');

          if (blob.size < 100) {
            console.warn('[VoiceInput] Audio too small, likely empty recording');
            setProcessing(false);
            return;
          }

          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            if (!base64) {
              console.error('[VoiceInput] Failed to convert to base64');
              setProcessing(false);
              return;
            }

            console.log('[VoiceInput] Sending to STT, base64 length:', base64.length);

            try {
              const audioFormat = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'wav';
              const result = await speechToText(base64, language as LanguageCode, audioFormat);
              console.log('[VoiceInput] STT result:', result);
              if (result.text) {
                onResult(result.text);
              }
            } catch (err) {
              console.error('[VoiceInput] STT Error:', err);
            } finally {
              setProcessing(false);
            }
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          console.error('[VoiceInput] Error processing audio:', err);
          setProcessing(false);
        }
      };

      mediaRecorder.start(1000); // Request data every 1 second
      setRecording(true);
      console.log('[VoiceInput] Recording started');
    } catch (err) {
      console.error('[VoiceInput] Mic permission denied or error:', err);
    }
  }, [language, onResult]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log('[VoiceInput] Stopping recording...');
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const toggleRecording = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [recording, startRecording, stopRecording]);

  return (
    <button
      onClick={toggleRecording}
      disabled={processing}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all cursor-pointer disabled:opacity-50 ${
        recording
          ? 'bg-red-500 text-white animate-pulse'
          : processing
          ? 'bg-amber-100 text-amber-600'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      } ${className}`}
      title={recording ? 'Stop recording' : 'Speak your query'}
    >
      {processing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : recording ? (
        <MicOff className="w-4 h-4" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </button>
  );
}
