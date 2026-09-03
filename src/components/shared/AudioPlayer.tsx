import { useState, useCallback, useRef } from 'react';
import { Volume2, Loader2, Square } from 'lucide-react';
import { textToSpeech, type LanguageCode } from '../../services/sarvam';
import { useAppStore } from '../../store';

interface AudioPlayerProps {
  text: string;
  className?: string;
}

export function AudioPlayer({ text, className = '' }: AudioPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const language = useAppStore(s => s.language);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handlePlay = useCallback(async () => {
    if (playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlaying(false);
      return;
    }

    setLoading(true);
    try {
      // Trim text to first 500 chars for TTS.
      // Sarvam bulbul:v3 works best with English/Roman text.
      const ttsText = text.substring(0, 500).replace(/[#*\-\n]+/g, ' ').trim();
      if (!ttsText) return;

      const result = await textToSpeech(ttsText, 'en' as LanguageCode, 'female');
      if (!result.audioContent) return;

      const audio = new Audio(`data:audio/mp3;base64,${result.audioContent}`);
      audioRef.current = audio;
      audio.onended = () => {
        setPlaying(false);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setPlaying(false);
        audioRef.current = null;
      };
      await audio.play();
      setPlaying(true);
    } catch (err) {
      console.error('[TTS] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [text, language, playing]);

  return (
    <button
      onClick={handlePlay}
      disabled={loading}
      className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] rounded-md transition-colors cursor-pointer disabled:opacity-50 ${
        playing
          ? 'bg-red-100 text-red-600 hover:bg-red-200'
          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
      } ${className}`}
      title={playing ? 'Stop audio' : 'Listen to this text'}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : playing ? (
        <Square className="w-3 h-3" />
      ) : (
        <Volume2 className="w-3 h-3" />
      )}
      {playing ? 'Stop' : loading ? 'Loading...' : '🔊 Suniye'}
    </button>
  );
}
