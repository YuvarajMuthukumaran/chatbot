// What Tulasi Health Care's front desk actually tells people: locations,
// admission packages, fees, how booking works. Extracted from 97 translated
// front-desk call recordings (Downloads/Call Recordings/translated_en,
// VN1–VN97). Only facts staff stated consistently across several calls are
// kept; one-off figures (mistranslations like "₹25" or "₹5", or a single
// call's outlier price) were dropped. The VN numbers after each fact are the
// calls it came from, so it can be checked against the recordings.
//
// THIS FILE IS THE SOURCE OF TRUTH for every price and policy the chatbot may
// state. When a price or policy changes, edit it here (and run `npm test`).
// The model is told to quote nothing about the clinic beyond what's here.
//
// Each topic has a `match` test and `facts`. When someone's message matches a
// topic, its facts are handed to the model for that reply only, so the
// prompt stays short and the model can't drift into a price it was never
// given. The tests are deliberately narrow: an emotional message ("I had a
// hard time today", "my room feels like a cage") must not pull clinic prices
// into a conversation that isn't about them.

export const CLINIC_PHONE = "+91 8800000255";

// Signals, in English, Hinglish/Tanglish/Tenglish, and native Hindi, Tamil,
// and Telugu script. (Non-Latin alternatives sit outside the \b groups: \b
// only understands ASCII word characters.)
const PRICE =
  /\b(?:cost|costs|price|prices|pricing|charges?|fees?|rates?|tariff|how much|expensive|discounts?|concessions?|kitna|kitne|kitni|kharcha|paisa|paise|evvalavu|evlo|enta|entha)\b|कितना|कितने|कितनी|खर्च|फीस|शुल्क|कीमत|கட்டணம்|எவ்வளவு|விலை|ఎంత|ఫీజు|ఖర్చు/i;
const ADMIT =
  /\b(?:admit|admits|admitted|admitting|admission|inpatient|in-patient|ipd|rehab|rehabilitation|residential care|long[- ]term (?:care|stay)|bharti|bhartee|bharthi)\b|भर्ती|एडमिट|அட்மிட்|అడ్మిట్/i;
const ROOM = /\b(?:single|double|triple)[- ]?(?:rooms?|sharing|occupancy|beds?)\b|\bsharing rooms?\b|\bper day\b|\bpackages?\b/i;
const CONSULT =
  /\b(?:consult|consultation|opd|appointment|counsell?ing|counsell?or|therapist|therapy sessions?|psychologist|psychiatrist|doctor'?s? fees?|first visit|follow[- ]?up|registration)\b|परामर्श|काउंसलिंग/i;
const WHERE =
  /\bwhere\b[^.?!]*\b(?:you|your|clinic|hospital|cent(?:er|re)|tulasi|located|branch|situated|opd)\b|\b(?:location|address|directions?|branch(?:es)?|how (?:do i|to|can i|can we) (?:reach|get there|come there))\b|\b(?:kaha+n?|kidhar)\b|\b(?:enga|engey) (?:irukku|iruku|irukkinga)\b|\bekkada\b|\b(?:gurgaon|gurugram|delhi|mehrauli|mahrauli|chhatt?arpur|hauz khas|noida|ghaziabad|faridabad|jaipur|dehradun)\b|कहाँ|कहां|लोकेशन|எங்கே|முகவரி|ఎక్కడ|చిరునామా/i;
const BOOK_HOW =
  /\bhow (?:do|can|to) (?:i |we )?(?:book|see a|meet a|consult|get an? (?:appointment|consultation))\b|\bbooking process\b|\b(?:opd|clinic|hospital|doctor'?s?|consultation) (?:timings?|hours?)\b|\btimings?\b|\bwhat time (?:is|does|do)\b|\bwhen (?:is|are|does) (?:the )?(?:opd|clinic|doctor)\b|\b(?:video|online) (?:consult|consultation|call|session|counsell?ing)\b|\bwhatsapp\b/i;
const SERVICES =
  /\b(?:do you (?:have|treat|handle|offer|provide|deal with|take)|what (?:services|treatments?)|your services|de-?addiction|nasha|sharab|daru|alcohol|alcoholic|alcoholism|drugs?|drinking problem|drinks? (?:a lot|too much|heavily|daily|every day)|gambling|betting|gaming addiction|dementia|homeopath(?:y|ic)|ayurved(?:a|ic)|ect|electroconvulsive|child (?:psychiatrist|psychologist|specialist)|(?:for|treat) (?:my )?(?:child|kid|son|daughter))\b|नशा|शराब|दारू|போதை|மது|మద్యం|వ్యసనం/i;
const TRANSPORT =
  /\b(?:ambulance|pick ?up (?:the )?patient|how (?:do|can|will|should) (?:we|i) (?:bring|get|take) (?:him|her|them)|(?:refuses?|refused|refusing) (?:any |all )?(?:treatment|help|medicines?|medication)|(?:refuses?|refused|refusing|won'?t|doesn'?t want|does not want|not willing|not ready|not agreeing) (?:to )?(?:come|go|get treatment|be admitted|take (?:medicine|medicines|medication|treatment))|(?:without|against) (?:his|her|their) (?:consent|will))\b|एम्बुलेंस|एंबुलेंस|ஆம்புலன்ஸ்|అంబులెన్స్/i;

export const CLINIC_TOPICS = [
  {
    id: "locations",
    match: (t) => WHERE.test(t),
    facts: [
      "Main hospital: Tulasi Healthcare, Sector 64, Gurugram (Gurgaon), Haryana. A full psychiatric hospital and rehabilitation / de-addiction centre with about 120 beds, where admissions happen. (VN6, VN11, VN38, VN63, VN75)",
      "Delhi: a centre in Chhatarpur / Mehrauli (near Chhatarpur Metro), which also handles long-term residential care, and an OPD clinic near Hauz Khas Metro. (VN25, VN30, VN31, VN44, VN68, VN81)",
      "There are no branches in Noida, Jaipur, or Dehradun. People from other cities can use online video consultations or travel to Gurugram/Delhi. (VN63, VN74, VN82, VN84)",
      "Staff share the exact map location on WhatsApp after a call; don't make up landmarks or directions.",
    ],
  },
  {
    id: "admission",
    match: (t) => ADMIT.test(t),
    facts: [
      "Admission is decided by a psychiatrist after assessing the patient; families can visit the Gurugram hospital first to see the rooms, food, and activities and meet a doctor before deciding. (VN4, VN13, VN43, VN73, VN85)",
      "Inpatient treatment includes medication, individual counselling, group therapy, daily activities (yoga, gym, indoor/outdoor games), and a daily schedule. (VN1, VN42, VN54, VN63)",
      "Typical stay: at least about 3 weeks (often 3–6 weeks), but the doctor decides the length after assessment. No specific recovery time or result is guaranteed. (VN8, VN11, VN28, VN41, VN85, VN90)",
      "Families get regular updates on the patient's activities and progress, and follow-up with a psychiatrist and psychologist continues after discharge. (VN1, VN38, VN41)",
      "Women are admitted too, with a separate facility for female patients. (VN8, VN27, VN84, VN96)",
      "Bring the patient's photo ID and any old prescriptions or medical reports. (VN32, VN85)",
    ],
  },
  {
    id: "room_charges",
    // Room prices for a room question, or a price question about admission
    // (or one with no context at all: "what are your charges?").
    match: (t) => ROOM.test(t) || (PRICE.test(t) && (ADMIT.test(t) || !CONSULT.test(t))),
    facts: [
      "Inpatient package at Gurugram, per day: triple-sharing room about ₹6,000, double-sharing about ₹8,000, single room about ₹12,000. (VN41, VN66, VN73, VN75, VN85)",
      "The daily package covers the room, meals, psychiatrist and doctor fees, nursing, counselling/psychologist sessions, therapy, and daily activities (yoga, gym, games). (VN8, VN48, VN71, VN84)",
      "Not included, billed separately: medicines, blood tests and other investigations, and any outside specialist. (VN1, VN8, VN41, VN71, VN84)",
      "A family member can stay with the patient only in a single room, not in shared rooms. (VN1, VN71)",
      "A hospital attendant, if needed, is about ₹800 per 12-hour shift. (VN30, VN90)",
      "Delhi (Chhatarpur/Mehrauli) long-term care: about ₹4,000/day shared and ₹7,000/day single. (VN25, VN30)",
      "Some health-insurance policies may reimburse, but many exclude mental health, so it isn't guaranteed. (VN21, VN42)",
      "Staff describe the package as having no hidden charges beyond medicines and tests. No discount policy is listed here: don't say one exists or doesn't. Say the team can discuss it. (VN96)",
      "These are indicative figures from the front desk; the team confirms the exact amount.",
    ],
  },
  {
    id: "opd_fees",
    match: (t) => PRICE.test(t) && (CONSULT.test(t) || !(ADMIT.test(t) || ROOM.test(t))),
    facts: [
      "Consultation fees depend on the doctor. A first visit with a senior psychiatrist is usually about ₹1,700–₹2,500 (including a ₹200 registration fee); other consultants are about ₹1,000–₹1,500. Follow-ups usually cost less than the first visit. (VN50, VN65, VN69, VN72, VN86)",
      "A counselling session with a psychologist is usually about ₹1,200–₹1,500 and lasts around 40–45 minutes. Senior and junior counsellors charge differently. (VN18, VN24, VN44, VN47, VN74)",
      "Online video consultations and counselling are available, including for people in other cities or outside India. (VN7, VN16, VN44, VN64, VN72, VN87)",
      "The team confirms the exact fee for a specific doctor when booking.",
    ],
  },
  {
    id: "booking_process",
    match: (t) => BOOK_HOW.test(t),
    facts: [
      "OPD consultations run during the day, roughly 10 am to 5 pm. Exact slots vary by doctor and location, and mornings are usually easier. (VN36, VN42, VN50, VN69, VN93)",
      "Booking by phone: the team sends the doctor's profile and a short registration form on WhatsApp. The slot is confirmed once the form and the registration/consultation fee are paid online (QR/UPI). (VN59, VN69, VN72, VN94)",
      "For some senior doctors, a psychologist first calls to take the history so the doctor's consultation is more focused. (VN32, VN59, VN94)",
      "Bring old prescriptions and reports to the first visit. (VN32)",
    ],
  },
  {
    id: "services",
    match: (t) => SERVICES.test(t),
    facts: [
      "Tulasi treats the full range of psychiatric conditions: depression, anxiety, OCD, bipolar disorder, schizophrenia and psychosis, personality disorders, dementia and old-age issues, and more. (VN38, VN53, VN71, VN93)",
      "De-addiction programme for alcohol, drugs, and behavioural addictions such as gambling, betting, and gaming. (VN1, VN41, VN59)",
      "Child and adolescent psychiatry and child psychologists for under-18s, including ADHD, autism, and behaviour concerns. (VN65, VN73, VN74, VN97)",
      "Long-term residential care for elderly or chronically ill patients at the Delhi centre. (VN30, VN45)",
      "Treatment is allopathic (psychiatric medication plus therapy); the hospital doesn't use homeopathic medicines. ECT is used only as a last resort when other treatments haven't helped, and only on a psychiatrist's advice. (VN70, VN88)",
    ],
  },
  {
    id: "transport_unwilling",
    match: (t) => TRANSPORT.test(t),
    facts: [
      "The hospital has no ambulance of its own. A third-party ambulance service comes home with a doctor and nursing staff, and the family pays that service directly. (VN11, VN43, VN48, VN58, VN85, VN95)",
      `The ambulance service's number isn't listed here, so you can't give it out. The hospital team shares it: the family can call ${CLINIC_PHONE}.`,
      "It's common for a relative not to accept they need help. Most admissions are arranged by family. The team and a psychiatrist can talk the family through options, and family members who aren't convinced can visit and meet a psychiatrist first. (VN4, VN11, VN23)",
      "If anyone is in immediate danger (violence, threats to hurt themselves or others), contact emergency services (112) first.",
    ],
  },
];

// "and for a woman?", "what about delhi?", "aur?" — too short to carry a
// topic of its own, so it continues whatever practical question came before.
const FOLLOW_UP = /^(?:and|what about|how about|aur|or|also|for)\b|\?\s*$/i;

/**
 * The clinic topics a message is about. A short follow-up with no topic of
 * its own ("and for a woman?") inherits the topics of `recentText`, the
 * person's previous message.
 * @param {string} message
 * @param {string} [recentText]
 * @returns {typeof CLINIC_TOPICS}
 */
export function findClinicTopics(message, recentText = "") {
  if (!message) return [];
  const direct = CLINIC_TOPICS.filter((t) => t.match(message));
  if (direct.length || !recentText) return direct;
  const trimmed = message.trim();
  if (trimmed.split(/\s+/).length > 6 || !FOLLOW_UP.test(trimmed)) return [];
  return CLINIC_TOPICS.filter((t) => t.match(recentText));
}

/**
 * A system note with the facts for the given topics, or undefined when no
 * topic matched (the model then gets no clinic facts at all, and the system
 * prompt tells it to offer the phone number instead of guessing).
 * @param {typeof CLINIC_TOPICS} topics
 */
export function buildClinicFactsNote(topics) {
  if (!topics.length) return undefined;
  const lines = topics.flatMap((t) => t.facts.map((f) => `- ${f.replace(/\s*\(VN[\d, VN]+\)\s*$/, "")}`));
  return [
    "Clinic information. These are verified facts from Tulasi Health Care's front desk and are relevant to this message:",
    ...[...new Set(lines)],
    `Use these only if they actually answer what the person asked, and only as much as answers it. Don't dump the list. Say "about" or "approximately" for prices and mention that the team confirms the exact amount. Never state a price, timing, policy, or recovery time that isn't listed here. If the answer isn't here, say you're not sure and offer ${CLINIC_PHONE}.`,
  ].join("\n");
}
