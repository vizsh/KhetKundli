import type { Rng } from "./rng";
import type { Farmer } from "./types";

// Synthetic names, common in Satara district. Demonstration data only.
const WOMEN: [string, string][] = [
  ["Sunita", "सुनीता"], ["Rekha", "रेखा"], ["Mangal", "मंगल"], ["Sangita", "संगीता"],
  ["Shobha", "शोभा"], ["Lata", "लता"], ["Ujwala", "उज्ज्वला"], ["Anita", "अनिता"], ["Savita", "सविता"],
];
const MEN: [string, string][] = [
  ["Ramesh", "रमेश"], ["Suresh", "सुरेश"], ["Dattatray", "दत्तात्रय"], ["Vitthal", "विठ्ठल"],
  ["Shankar", "शंकर"], ["Balasaheb", "बाळासाहेब"], ["Rajendra", "राजेंद्र"], ["Ganesh", "गणेश"],
  ["Prakash", "प्रकाश"], ["Sandip", "संदीप"], ["Nitin", "नितीन"], ["Vijay", "विजय"],
  ["Ashok", "अशोक"], ["Dilip", "दिलीप"], ["Mahadev", "महादेव"], ["Tukaram", "तुकाराम"],
];
const SURNAMES: [string, string][] = [
  ["Jadhav", "जाधव"], ["Pawar", "पवार"], ["Bhosale", "भोसले"], ["Shinde", "शिंदे"], ["Kadam", "कदम"],
  ["Gaikwad", "गायकवाड"], ["Mane", "माने"], ["Jagtap", "जगताप"], ["Kale", "काळे"], ["Ghadge", "घाडगे"],
  ["Bhoite", "भोईटे"], ["Nimbalkar", "निंबाळकर"], ["Ranaware", "रणवरे"], ["Kakade", "काकडे"],
  ["Sonawane", "सोनवणे"], ["Chavan", "चव्हाण"], ["Salunkhe", "साळुंखे"], ["More", "मोरे"],
  ["Thorat", "थोरात"], ["Deshmukh", "देशमुख"],
];

export function makeFarmer(rng: Rng): Farmer {
  const woman = rng.chance(0.34);
  const [first, firstMr] = rng.pick(woman ? WOMEN : MEN);
  const [last, lastMr] = rng.pick(SURNAMES);
  return { name: `${first} ${last}`, mr: `${firstMr} ${lastMr}`, woman, usesApp: rng.chance(0.7) };
}

export const HERO_FARMER: Farmer = { name: "Sunita Jadhav", mr: "सुनीता जाधव", woman: true, usesApp: true };
