
import { useEffect, useRef, useCallback } from 'react';

interface WakeWordHookProps {
  onWakeWordDetected: () => void;
  enabled: boolean;
  lang: string;
}

const useWakeWord = ({ onWakeWordDetected, enabled, lang }: WakeWordHookProps) => {
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  const startWakeWordListener = useCallback(() => {
    if (!enabled || isListeningRef.current) return;

    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    try {
      const recognition = new SpeechRecognitionAPI();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onresult = (event: any) => {
        const results = event.results;
        const lastResult = results[results.length - 1];
        
        // Only process if it's a new result index to avoid multiple triggers for interim results
        const resultIndex = event.resultIndex;
        const transcript = lastResult[0].transcript.toLowerCase();

        // Simple debounce: only trigger once per result index
        if (transcript.includes('hello') || transcript.includes('aura')) {
          if ((recognition as any)._lastTriggeredIndex !== resultIndex) {
            (recognition as any)._lastTriggeredIndex = resultIndex;
            console.log('Wake word detected:', transcript);
            onWakeWordDetected();
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Wake word recognition error:', event.error);
        if (event.error === 'not-allowed') {
          isListeningRef.current = false;
        }
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        // Auto-restart if still enabled
        if (enabled) {
          setTimeout(() => {
            if (enabled && !isListeningRef.current) {
              startWakeWordListener();
            }
          }, 1000);
        }
      };

      recognition.start();
      isListeningRef.current = true;
    } catch (err) {
      console.error('Failed to start wake word listener:', err);
      isListeningRef.current = false;
    }
  }, [enabled, lang, onWakeWordDetected]);

  const stopWakeWordListener = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors on stop
      }
      isListeningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      startWakeWordListener();
    } else {
      stopWakeWordListener();
    }

    return () => {
      stopWakeWordListener();
    };
  }, [enabled, startWakeWordListener, stopWakeWordListener]);
};

export default useWakeWord;
