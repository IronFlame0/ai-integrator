"use client";

import { useCallback, useRef, useState } from "react";

interface VoiceButtonProps {
  onTranscript: (text: string, isFinal: boolean) => void;
  disabled?: boolean;
  lang?: string;
}

export function VoiceButton({ onTranscript, disabled, lang = "ru-RU" }: VoiceButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    const SR =
      (window as typeof window & { SpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition ??
      (window as typeof window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SR) return;

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        onTranscript(final.trim(), true);
      } else if (interim) {
        onTranscript(interim, false);
      }
    };

    recognition.start();
  }, [lang, onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const handleClick = () => {
    if (isListening) stopListening();
    else startListening();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={isListening ? "Остановить запись" : "Голосовой ввод"}
      className={`flex shrink-0 items-center justify-center rounded-lg p-2 transition-colors disabled:opacity-50 ${
        isListening
          ? "animate-pulse bg-red-100 text-red-500 hover:bg-red-200"
          : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      }`}
    >
      {isListening ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      )}
    </button>
  );
}
