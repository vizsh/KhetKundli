import { fmtDay, SEASON_DAYS } from "@/lib/sim/calendar";
import { geo } from "@/lib/geo";
import { firstSprayWindow, SPRAYS } from "@/lib/sim/rules";
import type { PlotEvent, Season } from "@/lib/sim/types";
import { mrDay, mrNum } from "./farmer";

export type Intent = "spray-failed" | "when-spray" | "irrigation" | "harvest" | "blight" | "unknown";
export type Chip = { label: string; value: string; mr: string; sure: boolean };
export type Answer = { intent: Intent; chips: Chip[]; en: string; mr: string; sources: string[]; sourcesMr?: string[]; escalate: boolean };

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

const SPRAY = ["spray", "फवारणी", "फवारले", "औषध", "fawarni", "fawarani"];
const FAILED = ["fail", "didn't work", "did not work", "not work", "waste", "वाया", "काम केले नाही", "उपयोग झाला नाही", "उपयोग नाही", "why", "का "];
const WATER = ["water", "irrigat", "पाणी", "ठिबक", "drip"];
const HARVEST = ["harvest", "pick", "तोडणी", "sell", "विक्री", "विकू", "price", "भाव", "rate", "market", "बाजार", "mandi", "मंडी"];
const BLIGHT = ["blight", "तेल्या", "डाग", "spot", "disease", "रोग", "oily"];
const LAST = ["last", "मागच्या", "मागील", "previous", "मागे"];

export function classify(raw: string): { intent: Intent; chips: Chip[] } {
  const text = ` ${raw.toLowerCase()} `;
  const chips: Chip[] = [];
  let intent: Intent = "unknown";
  if (has(text, SPRAY) && (has(text, FAILED) || has(text, LAST))) intent = "spray-failed";
  else if (has(text, SPRAY)) intent = "when-spray";
  else if (has(text, WATER)) intent = "irrigation";
  else if (has(text, HARVEST)) intent = "harvest";
  else if (has(text, BLIGHT)) intent = "blight";
  if (intent !== "unknown") {
    chips.push({
      label: "Topic",
      value: { "spray-failed": "Spray that failed", "when-spray": "Next spray", irrigation: "Irrigation", harvest: "Harvest and price", blight: "Blight", unknown: "" }[intent],
      mr: { "spray-failed": "वाया गेलेली फवारणी", "when-spray": "पुढची फवारणी", irrigation: "पाणी", harvest: "तोडणी आणि भाव", blight: "तेल्या रोग", unknown: "" }[intent],
      sure: true,
    });
  }
  chips.push({ label: "Crop", value: "Pomegranate", mr: "डाळिंब", sure: has(text, ["pomegranate", "डाळिंब", "anar", "डाळींब"]) });
  chips.push({ label: "Plot", value: "Gat 214", mr: "गट २१४", sure: has(text, ["214", "२१४", "gat", "गट"]) });
  if (has(text, LAST)) chips.push({ label: "When", value: "Last time", mr: "मागच्या वेळी", sure: true });
  return { intent, chips };
}

const spraysOf = (s: Season, plot: number) => s.eventsByPlot[plot].filter((e): e is Extract<PlotEvent, { type: "spray" }> => e.type === "spray");

export function answer(s: Season, plot: number, day: number, raw: string): Answer {
  const { intent, chips } = classify(raw);
  const p = s.plots[plot];
  const village = geo.villages[p.village];
  const base = { intent, chips, escalate: false };

  if (intent === "spray-failed") {
    const failed = spraysOf(s, plot).filter((e) => e.day <= day && e.washedOff).at(-1);
    const next = spraysOf(s, plot).find((e) => e.day > day && !e.washedOff);
    const window = next?.day ?? firstSprayWindow(s.weather, day + 1);
    if (!failed) {
      return { ...base, sources: [], en: "Your record shows no washed-off spray this season. If spots are spreading, scan a leaf so I can check.", mr: "या हंगामात तुमची कोणतीही फवारणी पावसाने धुतली गेल्याची नोंद नाही. डाग पसरत असतील तर पानाचा फोटो स्कॅन करा." };
    }
    const rain = s.weather[failed.day].rainMm;
    const gap = Math.max(1, 19 - failed.hour);
    return {
      ...base,
      sources: [`Spray, ${fmtDay(failed.day)} ${String(failed.hour).padStart(2, "0")}:00`, `Rain ${rain.toFixed(0)} mm, ${fmtDay(failed.day)} evening`],
      sourcesMr: [`फवारणी, ${mrDay(failed.day)}`, `पाऊस ${mrNum(rain.toFixed(0))} मिमी, ${mrDay(failed.day)} संध्याकाळी`],
      en: `On ${fmtDay(failed.day)} you sprayed ${failed.product} at ${failed.hour}:00. About ${gap} hours later ${rain.toFixed(0)} mm of rain fell and washed it off before it could dry. Spray only in a dry morning window${window !== null && window !== undefined ? `: your next one is ${fmtDay(window)} at 06:00` : ""}.`,
      mr: `${mrDay(failed.day)} रोजी ${failed.hour >= 12 ? "दुपारी" : "सकाळी"} ${mrNum(failed.hour > 12 ? failed.hour - 12 : failed.hour)} वाजता फवारणी केली. सुमारे ${mrNum(gap)} तासांनी ${mrNum(rain.toFixed(0))} मिमी पाऊस पडला आणि औषध वाळण्याआधीच धुतले गेले. फवारणी फक्त कोरड्या सकाळी करा${window !== null && window !== undefined ? `: पुढची फवारणी ${mrDay(window)} रोजी सकाळी ${mrNum(6)} वाजता` : ""}.`,
    };
  }

  if (intent === "when-spray") {
    const next = spraysOf(s, plot).find((e) => e.day >= day && !e.washedOff);
    const window = next?.day ?? firstSprayWindow(s.weather, day + 1);
    const spec = next?.product.startsWith("Copper") ? SPRAYS.curative : SPRAYS.preventive;
    if (window === null || window === undefined) {
      return { ...base, sources: ["7-day forecast"], en: "No dry, calm morning in the next six days. Hold the spray; I will tell you when a window opens.", mr: "पुढील सहा दिवसांत कोरडी, शांत सकाळ नाही. फवारणी थांबवा; संधी मिळताच सांगेन." };
    }
    return {
      ...base,
      sources: ["Forecast for Phaltan", next ? `Advice on your record, ${fmtDay(next.day)}` : "Spray rules table"],
      en: `Spray on ${fmtDay(window)} at 06:00: ${spec.product}, ${spec.dose}. That morning is dry and calm.`,
      mr: `${mrDay(window)} रोजी सकाळी ${mrNum(6)} वाजता फवारणी करा: ${spec.mr}. ती सकाळ कोरडी आणि शांत आहे.`,
    };
  }

  if (intent === "irrigation") {
    const next = s.eventsByPlot[plot].find((e) => e.day >= day && (e.type === "irrigate" || e.type === "irrigate-skip"));
    if (next?.type === "irrigate-skip") {
      return { ...base, sources: [`Forecast, ${fmtDay(next.day + 1)}`], en: `Skip the ${fmtDay(next.day)} irrigation: ${s.weather[next.day + 1].rainMm.toFixed(0)} mm of rain is forecast the next day. You keep ${(next.litresSaved / 1000).toFixed(0)} kL in the ground.`, mr: `${mrDay(next.day)} रोजीचे पाणी देऊ नका: दुसऱ्या दिवशी ${mrNum(s.weather[next.day + 1].rainMm.toFixed(0))} मिमी पावसाचा अंदाज आहे. ${mrNum((next.litresSaved / 1000).toFixed(0))} हजार लिटर पाणी वाचेल.` };
    }
    if (next?.type === "irrigate") {
      return { ...base, sources: ["ET0 x crop stage", "Forecast"], en: `Irrigate on ${fmtDay(next.day)}: about ${(next.litres / 1000).toFixed(0)} kL by drip, worked out from evaporation and your crop's stage.`, mr: `${mrDay(next.day)} रोजी ठिबकने सुमारे ${mrNum((next.litres / 1000).toFixed(0))} हजार लिटर पाणी द्या; हे बाष्पीभवन आणि पिकाच्या अवस्थेवरून काढले आहे.` };
    }
  }

  if (intent === "harvest") {
    const first = p.harvestStart;
    const sale = Math.min(SEASON_DAYS - 1, first + 1);
    const ph = s.prices.phaltan[sale], pu = s.prices.pune[sale];
    const better = ph >= pu - 2 ? "Phaltan APMC" : "Pune";
    return {
      ...base,
      sources: ["Harvest Wave", "Mandi prices (simulated)"],
      en: `Your first picking is due ${fmtDay(first)}. Expected price that week: Phaltan ₹${ph}/kg, Pune ₹${pu}/kg before freight. ${better} looks better for you; open the harvest date below to compare.`,
      mr: `तुमची पहिली तोडणी ${mrDay(first)} रोजी आहे. त्या आठवड्यात अपेक्षित भाव: फलटण ₹${mrNum(ph)}/किलो, पुणे ₹${mrNum(pu)}/किलो (वाहतूक खर्चाआधी). ${better === "Pune" ? "पुणे" : "फलटण बाजार समिती"} तुमच्यासाठी चांगली दिसते.`,
    };
  }

  if (intent === "blight") {
    const risk = s.hexRisk[day][p.hex];
    const label = ["no blight reported", "blight on watch", "a blight warning", "a blight outbreak"][risk];
    const labelMr = ["तेल्याची नोंद नाही", "तेल्यावर लक्ष", "तेल्याचा इशारा", "तेल्याचा उद्रेक"][risk];
    return {
      ...base,
      sources: ["Pest Radar"],
      en: `Around ${village.name} there is ${label} today. Check leaves and fruit for oily, water-soaked spots; if you see any, scan the leaf and I will tell you what to spray and when.`,
      mr: `आज ${village.mr} परिसरात ${labelMr}. पाने आणि फळांवर तेलकट, पाणथळ डाग तपासा; दिसल्यास पानाचा फोटो स्कॅन करा, मी कोणते औषध आणि कधी फवारायचे ते सांगेन.`,
    };
  }

  return {
    ...base,
    escalate: true,
    sources: [],
    en: "I'm not sure I understood. I'll send your question and your plot record to the extension officer, who usually replies the same day.",
    mr: "मला प्रश्न नीट समजला नाही. तुमचा प्रश्न आणि शेताची नोंद कृषी सहाय्यकांना पाठवतो; ते सहसा त्याच दिवशी उत्तर देतात.",
  };
}

export const SAMPLE_QUESTIONS = [
  { en: "Why did my last spray fail?", mr: "मागच्या वेळी फवारणी का वाया गेली?" },
  { en: "When should I spray next?", mr: "पुढची फवारणी कधी करू?" },
  { en: "Should I irrigate today?", mr: "आज पाणी देऊ का?" },
  { en: "When do I pick, and where do I sell?", mr: "तोडणी कधी आणि विक्री कुठे करू?" },
];
