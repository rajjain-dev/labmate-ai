// Fixed general preparation, paraphrased from the linked ACS references.
// This conversation is a reminder, never a certification or permission to start.
const ACS_TIPS = "https://www.acs.org/education/celebrating-chemistry-editions/science-safety-tips.html";
const ACS_LAB = "https://institute.acs.org/acs-center/lab-safety/education-training/high-school-labs/student-lab-code-of-conduct.html";
export const PREPARATION = [
  { text: "If you have long hair, tie it back and secure loose sleeves. Tell me when you're ready, or say not applicable.", source: ACS_TIPS, topic: /hair|tied|secured|sleeves|short hair/i },
  { text: "Next, put on the eye protection required by your lab instructions. Have you got it on?", source: ACS_TIPS, topic: /goggles|glasses|eye protection|wearing|on/i },
  { text: "Check that you're wearing closed-toe shoes and the protective clothing your lab requires. Ready?", source: ACS_LAB, topic: /shoes|coat|clothing|wearing|on/i },
  { text: "Finally, locate your lab's eyewash and safety shower. Ask your TA if you need help finding them. Tell me when you're ready.", source: ACS_LAB, topic: /found|located|know|eyewash|shower/i },
] as const;
export const PREP_GREETING = "Hi, I'm Sable! Let's get ready together, one thing at a time. " + PREPARATION[0].text;

export function preparationResponse(text: string, step: number): "advance" | "wait" | "question" {
  const value = text.toLowerCase().replace(/[’]/g, "'").replace(/[.,!]/g, " ").replace(/\s+/g, " ").trim();
  if (/^(?:not applicable|n\/a|skip(?: this(?: one)?)?|next)$/.test(value)) return "advance";
  if (/\?|\b(why|how|what|which|where|help|explain)\b/.test(value)) return "question";
  if (/\b(no|not|cannot|can't|don't|haven't|isn't|aren't)\b/.test(value)) return "wait";
  if (/^(?:yes|yeah|yep|yup|done|ready|okay|ok|all set|i am ready|i'm ready|i have done it|i've done it)$/.test(value)) return "advance";
  if (value.length < 140 && PREPARATION[step]?.topic.test(value) && /\b(yes|done|ready|tied|secured|wearing|on|found|located|short|know)\b/.test(value)) return "advance";
  return "question";
}
