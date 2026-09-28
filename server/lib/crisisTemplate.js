import { getCrisisResources } from "./crisisResources.js";

// Fixed safe-response templates, one per supported language. Warm,
// non-interrogating, no arguing with the user's stated feelings — just
// immediate grounding + resources, in the same language the crisis phrase
// was written in. These are hand-translated, not machine-translated or
// model-generated (this reply must stay 100% deterministic) — worth having
// a native speaker double-check the Hindi/Tamil/Telugu wording given how
// safety-critical this text is.
const TEMPLATES = {
  en: (label, lines) =>
    `I'm really glad you told me this, and I want you to know you're not alone right now. ` +
    `What you're feeling matters, and it's serious enough that I'd like you to reach out to a real person who can help right away — not because I don't want to listen, but because you deserve more support than I can give.\n\n` +
    `If you're in ${label} and in immediate danger, please contact one of these right now:\n\n` +
    `${lines}\n\n` +
    `If you can, please also reach out to someone you trust — a friend, family member, or a Tulasi Health Care professional — so you don't have to carry this alone. I'm still here to talk with you too.`,

  hi: (label, lines) =>
    `मुझे सच में खुशी है कि आपने यह बात मुझसे साझा की — कृपया जान लीजिए कि अभी आप अकेले नहीं हैं। ` +
    `आप जो महसूस कर रहे हैं वह मायने रखता है, और यह इतना गंभीर है कि अभी किसी ऐसे व्यक्ति से संपर्क करना ज़रूरी है जो तुरंत मदद कर सके — इसलिए नहीं कि यहां आपकी बात नहीं सुनी जा रही, बल्कि इसलिए कि आप इससे कहीं ज़्यादा सहारे के हकदार हैं।\n\n` +
    `अगर आप ${label} में हैं और अभी खतरे में हैं, तो कृपया तुरंत इनमें से किसी से संपर्क करें:\n\n` +
    `${lines}\n\n` +
    `अगर संभव हो, तो किसी भरोसेमंद व्यक्ति से भी बात करें — कोई दोस्त, परिवार का सदस्य, या Tulasi Health Care के किसी विशेषज्ञ से — ताकि यह बोझ आपको अकेले न उठाना पड़े। मैं अब भी यहां आपसे बात करने के लिए मौजूद हूं।`,

  ta: (label, lines) =>
    `நீங்கள் இதை என்னிடம் பகிர்ந்ததில் எனக்கு மிகவும் மகிழ்ச்சி — தயவுசெய்து புரிந்துகொள்ளுங்கள், இப்போது நீங்கள் தனியாக இல்லை. ` +
    `நீங்கள் உணர்வது முக்கியமானது, அது மிகவும் தீவிரமானது என்பதால் உடனடியாக உதவ முடியும் ஒரு நபரைத் தொடர்பு கொள்வது நல்லது — நான் கேட்க விரும்பாததால் அல்ல, மாறாக நீங்கள் இதைவிட அதிக ஆதரவுக்கு தகுதியானவர் என்பதால்.\n\n` +
    `நீங்கள் ${label}-ல் இருந்து உடனடி ஆபத்தில் இருந்தால், தயவுசெய்து இப்போதே இவற்றில் ஒன்றைத் தொடர்பு கொள்ளுங்கள்:\n\n` +
    `${lines}\n\n` +
    `முடிந்தால், நீங்கள் நம்பும் ஒருவரிடமும் பேசுங்கள் — ஒரு நண்பர், குடும்ப உறுப்பினர், அல்லது Tulasi Health Care நிபுணர் — இதை நீங்கள் தனியாக சுமக்க வேண்டியதில்லை. நான் இன்னும் உங்களுடன் பேச இங்கே இருக்கிறேன்.`,

  te: (label, lines) =>
    `మీరు ఇది నాతో పంచుకున్నందుకు నాకు చాలా సంతోషంగా ఉంది — దయచేసి తెలుసుకోండి, ఇప్పుడు మీరు ఒంటరిగా లేరు. ` +
    `మీరు అనుభవిస్తున్నది ముఖ్యమైనది, మరియు ఇది చాలా తీవ్రమైనది కాబట్టి వెంటనే సహాయం చేయగల ఒక వ్యక్తిని సంప్రదించడం మంచిది — నేను వినాలని అనుకోకపోవడం వల్ల కాదు, మీరు నేను ఇవ్వగలిగే దానికంటే ఎక్కువ మద్దతుకు అర్హులు కాబట్టి.\n\n` +
    `మీరు ${label}లో ఉండి, తక్షణ ప్రమాదంలో ఉంటే, దయచేసి ఇప్పుడే వీటిలో ఒకదానిని సంప్రదించండి:\n\n` +
    `${lines}\n\n` +
    `వీలైతే, మీరు నమ్మే వ్యక్తితో కూడా మాట్లాడండి — ఒక స్నేహితుడు, కుటుంబ సభ్యుడు, లేదా Tulasi Health Care నిపుణుడు — తద్వారా మీరు దీన్ని ఒంటరిగా మోయాల్సిన అవసరం లేదు. నేను ఇప్పటికీ మీతో మాట్లాడటానికి ఇక్కడ ఉన్నాను.`,
};

export function buildCrisisReply(region, lang = "en") {
  const resources = getCrisisResources(region);
  // "- " (real Markdown list syntax) so the client renders this as an
  // actual scannable list — a single "\n" between plain lines would just
  // be a soft line break and run the bullets together in one paragraph.
  const lines = resources.lines.map((l) => `- **${l.name}:** ${l.phone}`).join("\n");

  const build = TEMPLATES[lang] || TEMPLATES.en;
  return build(resources.label, lines);
}
