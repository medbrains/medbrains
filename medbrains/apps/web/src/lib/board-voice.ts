/**
 * What a waiting-room board says when a token is called, in each language a
 * queue speaks (RFCs/modules/RFC-MODULE-token-queues.md, P3).
 */

export type VoiceLanguage = "en" | "hi" | "ta";

export const VOICE_LANGUAGES: { value: VoiceLanguage; label: string; speechLang: string }[] = [
  { value: "en", label: "English", speechLang: "en-IN" },
  { value: "hi", label: "हिन्दी (Hindi)", speechLang: "hi-IN" },
  { value: "ta", label: "தமிழ் (Tamil)", speechLang: "ta-IN" },
];

/**
 * "T-014" → "T 0 1 4": read one character at a time, which is what a patient
 * matches against the slip in their hand in a noisy hall. "T fourteen" and
 * "T zero fourteen" are both misheard.
 */
export function spokenNumber(tokenNumber: string): string {
  return tokenNumber
    .replace(/[^A-Za-z0-9]/g, "")
    .split("")
    .join(" ");
}

/** The sentence for one language. */
export function callPhrase(language: VoiceLanguage, tokenNumber: string, where?: string): string {
  const n = spokenNumber(tokenNumber);
  switch (language) {
    case "hi":
      return where ? `टोकन ${n}, कृपया ${where} पर आइए।` : `टोकन ${n}।`;
    case "ta":
      return where ? `டோக்கன் ${n}, தயவுசெய்து ${where} க்கு வாருங்கள்.` : `டோக்கன் ${n}.`;
    default:
      return where ? `Token ${n}, please come to ${where}.` : `Token ${n}.`;
  }
}

/**
 * Languages this screen cannot speak: a Hindi sentence read by an English
 * voice is noise, so a language with no installed voice is skipped and the
 * board says so. An empty voice list means the browser has not loaded them
 * yet — assume all can be spoken rather than silence the board.
 */
export function unspeakable(
  languages: VoiceLanguage[],
  voices: Pick<SpeechSynthesisVoice, "lang">[],
): VoiceLanguage[] {
  if (voices.length === 0) return [];
  return languages.filter((language) => {
    const prefix = language.toLowerCase();
    return !voices.some((voice) => voice.lang.toLowerCase().startsWith(prefix));
  });
}

/** "Payment of rupees 600 received, thank you" — paise are not read out. */
export function paidPhrase(language: VoiceLanguage, rupees: number): string {
  const amount = Math.round(rupees).toString();
  switch (language) {
    case "hi":
      return `${amount} रुपये का भुगतान प्राप्त हुआ, धन्यवाद।`;
    case "ta":
      return `${amount} ரூபாய் பணம் பெறப்பட்டது, நன்றி.`;
    default:
      return `Payment of rupees ${amount} received, thank you.`;
  }
}

/** Speak one sentence in each language this screen can, `repeat` times over. */
function speakIn(
  phrase: (language: VoiceLanguage) => string,
  { languages, repeat }: { languages: VoiceLanguage[]; repeat: number },
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const skip = new Set(unspeakable(languages, synth.getVoices()));
  synth.cancel();
  for (let round = 0; round < repeat; round += 1) {
    for (const language of languages) {
      if (skip.has(language)) continue;
      const utter = new SpeechSynthesisUtterance(phrase(language));
      utter.lang = VOICE_LANGUAGES.find((l) => l.value === language)?.speechLang ?? "en-IN";
      utter.rate = 0.9;
      synth.speak(utter);
    }
  }
}

/** Speak a call in each language, `repeat` times over. */
export function announceCall(
  tokenNumber: string,
  where: string | undefined,
  voice: { languages: VoiceLanguage[]; repeat: number },
): void {
  speakIn((language) => callPhrase(language, tokenNumber, where), voice);
}

/** Say a counter payment was received, once in each language. */
export function announcePaid(rupees: number, languages: VoiceLanguage[]): void {
  speakIn((language) => paidPhrase(language, rupees), { languages, repeat: 1 });
}
