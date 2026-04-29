import { ref } from 'vue';

export function useSpeechRecognition() {
  const isListening = ref(false);
  const transcript = ref('');
  const interimTranscript = ref('');
  const error = ref(null);
  
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!Recognition) {
    error.value = "API no suportada.";
    return { isListening, transcript, interimTranscript, error, start: () => {}, stop: () => {} };
  }

  const recognition = new Recognition();
  recognition.lang = 'ca-ES'; 
  recognition.continuous = false; 
  recognition.interimResults = true; 

  recognition.onstart = () => { isListening.value = true; error.value = null; };
  recognition.onend = () => { isListening.value = false; };
  recognition.onerror = (e) => { isListening.value = false; error.value = e.error; };
  
  recognition.onresult = (event) => {
    let finalChunk = '';
    let interimChunk = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript;
      else interimChunk += event.results[i][0].transcript;
    }
    if (finalChunk) transcript.value = finalChunk;
    interimTranscript.value = interimChunk; 
  };

  const start = () => recognition.start();
  const stop = () => recognition.stop();

  return { isListening, transcript, interimTranscript, error, start, stop };
}