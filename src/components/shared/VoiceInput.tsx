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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setProcessing(true);

        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(',')[1];
            if (!base64) {
              setProcessing(false);
              return;
            }

            try {
              const result = await speechToText(base64, language as LanguageCode);
              if (result.text) {
                onResult(result.text);
              }
            } catch (err) {
              console.error('[STT] Error:', err);
            } finally {
              setProcessing(false);
            }
          };
          reader.readAsDataURL(blob);
        } catch {
          setProcessing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error('[Mic] Permission denied:', err);
    }
  }, [language, onResult]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
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
