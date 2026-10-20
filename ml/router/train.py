"""Train KhetKundli's question router on this machine.

A character n-gram TF-IDF + multinomial logistic regression over farmer questions in English,
Marathi (Devanagari) and Marathi typed in Latin letters. Character n-grams cope with spelling
variants, missing matras and code-mixing better than word features, and the model is small enough
to run in the browser or a serverless route with no Python at runtime: the vocabulary, idf
weights and coefficients are exported to JSON and re-implemented in TypeScript
(web/src/lib/agent/router.ts), which reproduces scikit-learn's `char_wb` analyser exactly.

Data: questions are generated from hand-written templates and slot values (below). Evaluation is
split by template, so test questions use phrasings the model never saw in training. That measures
generalisation to new phrasings of the same intents, not to real farmers; the pilot will relabel
real questions from the Ask log.

    python ml/router/train.py        (from the repository root)
"""
from __future__ import annotations

import json
import random
import re
from collections import Counter
from pathlib import Path

import urllib.request

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "web" / "src" / "data" / "router-model.json"
REPORT = ROOT / "docs" / "data" / "router-eval.json"
rng = random.Random(20261020)

SLOTS = {
    "{when}": ["today", "tomorrow", "this week", "now", "on Friday", "after the rain"],
    "{when_mr}": ["आज", "उद्या", "या आठवड्यात", "आत्ता", "शुक्रवारी", "पावसानंतर"],
    "{when_rm}": ["aaj", "udya", "ya aathvadyat", "aatta", "shukravari", "pavsanantar"],
    "{market}": ["Pune", "Phaltan", "Vashi", "Mumbai", "the APMC", "the mandi"],
    "{market_mr}": ["पुणे", "फलटण", "वाशी", "मुंबई", "बाजार समिती", "मंडी"],
    "{market_rm}": ["pune", "phaltan", "vashi", "mumbai", "bazar samiti", "mandi"],
    "{crop}": ["pomegranate", "anar", "my crop", "the orchard", "my plot", "bhagwa"],
    "{crop_mr}": ["डाळिंब", "बाग", "पीक", "शेत", "भगवा"],
    "{crop_rm}": ["dalimb", "baag", "pik", "shet", "bhagwa"],
}

# intent -> list of (template family id, template). One family = one phrasing pattern.
T: dict[str, list[str]] = {
    "spray_failed": [
        "why did my last spray fail", "my spray did not work", "the spray got washed off by rain",
        "rain came after I sprayed, was it wasted", "why is the spray not working on {crop}",
        "I sprayed copper but spots are still there", "did the evening rain wash my spray",
        "spray was waste, why", "last time medicine did not work",
        "मागच्या वेळी फवारणी का वाया गेली", "फवारणी केली पण उपयोग झाला नाही", "पावसाने औषध धुतले का",
        "फवारणीनंतर पाऊस आला, फवारणी वाया गेली का", "औषध फवारले तरी डाग कमी झाले नाहीत", "माझी फवारणी फेल का झाली",
        "magchya veli fawarni ka vaya geli", "fawarni keli pan upyog zala nahi", "pavsane aushadh dhutle ka",
        "spray kela pan kaam nahi kela", "aushadh marla pan dag tasech aahet",
    ],
    "next_spray": [
        "when should I spray next", "when can I spray {when}", "what should I spray on {crop}",
        "which medicine for blight and how much", "is {when} good for spraying", "best time to spray copper",
        "how much copper per litre", "give me the spray schedule", "should I spray before the rain",
        "पुढची फवारणी कधी करू", "{when_mr} फवारणी करू का", "तेल्यासाठी कोणते औषध फवारू", "किती ग्रॅम औषध प्रति लिटर",
        "फवारणीसाठी योग्य वेळ कोणती", "बोर्डो मिश्रण कधी मारू", "कॉपर कधी फवारू",
        "pudhchi fawarni kadhi karu", "{when_rm} fawarni karu ka", "telya sathi konte aushadh",
        "kiti gram aushadh per litre", "bordo kadhi marayche",
    ],
    "irrigation": [
        "should I irrigate {when}", "how much water to give", "when to give water to {crop}",
        "should I run the drip {when}", "rain is coming, should I still water", "how many litres per plant",
        "is my irrigation too much", "water schedule for fruit development",
        "{when_mr} पाणी देऊ का", "किती पाणी द्यायचे", "ठिबक किती वेळ चालवू", "पाऊस येणार आहे, पाणी देऊ का",
        "बागेला पाणी कधी द्यायचे", "पाणी कमी पडते आहे का",
        "{when_rm} paani deu ka", "kiti paani dyayche", "thibak kiti vel chalvu", "paus yenar aahe paani deu ka",
        "bagela paani kadhi dyayche",
    ],
    "harvest_market": [
        "when do I pick and where do I sell", "what is the price in {market} {when}", "should I sell in {market}",
        "when is my harvest", "which market gives a better rate", "will prices fall next week",
        "when will my fruit be ready", "is it better to wait or pick now", "what rate for grade A",
        "तोडणी कधी करू आणि विक्री कुठे करू", "{market_mr} मध्ये भाव किती आहे", "{market_mr} ला विकू का",
        "माझी तोडणी कधी आहे", "कोणत्या बाजारात चांगला भाव मिळेल", "पुढच्या आठवड्यात भाव पडतील का", "फळ कधी तयार होईल",
        "todni kadhi karu ani vikri kuthe", "{market_rm} madhye bhav kiti", "{market_rm} la viku ka",
        "majhi todni kadhi aahe", "bhav padtil ka", "konta bazar changla",
    ],
    "blight_risk": [
        "is there blight near me", "I see oily spots on leaves", "black spots on fruit, what is it",
        "is telya spreading in my village", "is my {crop} at risk of blight", "how is the disease around",
        "leaves have water soaked spots", "cracks with dark spots on fruit", "will blight come to my plot",
        "माझ्या शेताजवळ तेल्या आहे का", "पानांवर तेलकट डाग आहेत", "फळावर काळे डाग आले", "गावात तेल्या पसरतोय का",
        "माझ्या बागेला रोगाचा धोका आहे का", "पानांवर पाणथळ डाग दिसतात", "फळ तडकले आणि डाग आहेत",
        "majhya shetajaval telya aahe ka", "panavar telkat dag aahet", "falavar kale dag", "gavat telya pasartoy ka",
        "bagela rogacha dhoka aahe ka",
    ],
    "sale_slip": [
        "the agent cut too much commission", "check my patti", "is my sale slip correct",
        "why is hamali so high", "the adatya charged extra", "deductions on my slip look wrong",
        "how much commission is allowed", "net amount is less than expected",
        "अडत्याने जास्त कमिशन कापले", "माझी पट्टी तपासा", "पट्टी बरोबर आहे का", "हमाली जास्त लावली", "कपात चुकीची वाटते",
        "किती अडत कापायला पाहिजे", "हातात कमी पैसे आले",
        "adatyane jast commission kaapla", "majhi patti tapasa", "patti barobar aahe ka", "hamali jast lavli",
        "kapat chukichi vatte",
    ],
    "transport": [
        "is there a truck going to {market}", "how do I book transport", "when does the pooled run leave",
        "can I share a vehicle with neighbours", "how much freight per crate", "my crates need a pickup {when}",
        "book space for 40 crates", "what time does the vehicle come",
        "{market_mr} ला गाडी जाते का", "वाहतूक कशी बुक करू", "गाडी किती वाजता निघते", "शेजाऱ्यांसोबत गाडी शेअर करू का",
        "प्रति कॅरेट भाडे किती", "४० कॅरेटसाठी जागा हवी",
        "{market_rm} la gaadi jate ka", "vahtuk kashi book karu", "gaadi kiti vajta nighte", "bhada kiti per crate",
    ],
    "weather": [
        "will it rain {when}", "what is the weather forecast", "how much rain this week", "is a storm coming",
        "how hot will it be {when}", "is the wind strong today", "rain forecast for Phaltan",
        "{when_mr} पाऊस पडेल का", "हवामानाचा अंदाज काय आहे", "या आठवड्यात किती पाऊस", "वादळ येणार आहे का",
        "आज वारा जोरात आहे का", "फलटणला पावसाचा अंदाज",
        "{when_rm} paus padel ka", "havamanacha andaj kay", "ya aathvadyat kiti paus", "vadal yenar aahe ka",
    ],
    "export": [
        "can I export my fruit", "how many days before harvest must I stop copper", "residue rules for Europe",
        "is my lot export ready", "what is the pre harvest interval", "how to register on AnarNet",
        "निर्यातीसाठी फळ चालेल का", "तोडणीपूर्वी किती दिवस फवारणी थांबवायची", "युरोपसाठी अवशेषाचे नियम",
        "माझा लॉट निर्यातीसाठी तयार आहे का", "अनारनेट नोंदणी कशी करायची",
        "niryatisathi fal chalel ka", "todnipurvi kiti divas fawarni thambvaychi", "anarnet nondani kashi",
    ],
    "other": [
        "how do I get a crop loan", "what subsidy is there for drip", "my cow is sick", "onion seed price",
        "how to apply for PM Kisan", "who is the sarpanch", "what fertiliser for sugarcane", "tractor on rent",
        "insurance claim for hail damage", "my phone is not working",
        "पीक कर्ज कसे मिळेल", "ठिबकसाठी अनुदान आहे का", "गाय आजारी आहे", "कांद्याचे बियाणे किती रुपये",
        "पीएम किसानचा अर्ज कसा करायचा", "उसासाठी कोणते खत", "ट्रॅक्टर भाड्याने मिळेल का", "गारपीट विमा दावा",
        "pik karj kase milel", "thibak anudan aahe ka", "gaay aajari aahe", "kanda biyane kiti",
        "pm kisan arj kasa", "usasathi konte khat",
    ],
}

PREFIX = ["", "", "", "sir ", "please ", "bhau ", "दादा ", "साहेब ", "hello ", "नमस्कार ", "mala sanga ", "मला सांगा "]
SUFFIX = ["", "", "", "?", " ?", " please", " sir", " साहेब", " ना", " lavkar sanga", " लवकर सांगा", "??"]


def fill(t: str) -> str:
    for k, vals in SLOTS.items():
        while k in t:
            t = t.replace(k, rng.choice(vals), 1)
    return t


def noise(t: str) -> str:
    """Spelling noise farmers' typing and speech-to-text produce: dropped letters, doubled letters, no spaces."""
    r = rng.random()
    if r < 0.15 and len(t) > 8:
        i = rng.randrange(1, len(t) - 1)
        t = t[:i] + t[i + 1:]
    elif r < 0.25 and len(t) > 8:
        i = rng.randrange(1, len(t) - 1)
        t = t[:i] + t[i] + t[i:]
    elif r < 0.30:
        t = t.replace(" ", "", 1)
    return t


def make(template: str, n: int) -> list[str]:
    return [noise(rng.choice(PREFIX) + fill(template) + rng.choice(SUFFIX)) for _ in range(n)]


EMBED_MODEL = "nomic-embed-text"
EMBED_PREFIX = "classification: "


def embed(texts: list[str]) -> np.ndarray:
    """Sentence embeddings from the local Ollama server (nomic-embed-text, 768-d), L2-normalised."""
    out = []
    for i in range(0, len(texts), 128):
        body = json.dumps({"model": EMBED_MODEL, "input": [EMBED_PREFIX + t for t in texts[i:i + 128]]}).encode()
        req = urllib.request.Request("http://localhost:11434/api/embed", body, {"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=300) as r:
            out.extend(json.load(r)["embeddings"])
    e = np.array(out, dtype=np.float32)
    return e / np.linalg.norm(e, axis=1, keepdims=True)


def main() -> None:
    rows = []  # (text, intent, family)
    for intent, temps in T.items():
        for fam, t in enumerate(temps):
            for text in make(t, 14):
                rows.append((text, intent, f"{intent}/{fam}"))
    # Hold out roughly one template in five per intent: test phrasings are never seen in training.
    held = set()
    for intent, temps in T.items():
        fams = list(range(len(temps)))
        rng.shuffle(fams)
        held.update(f"{intent}/{f}" for f in fams[: max(2, len(fams) // 5)])
    train = [r for r in rows if r[2] not in held]
    test = [r for r in rows if r[2] in held]

    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4), lowercase=True, sublinear_tf=True, min_df=2)
    Xtr = vec.fit_transform([r[0] for r in train])
    ytr = [r[1] for r in train]
    clf = LogisticRegression(C=8.0, max_iter=3000)
    clf.fit(Xtr, ytr)
    Xte = vec.transform([r[0] for r in test])
    yte = [r[1] for r in test]
    pred = clf.predict(Xte)
    acc = float(np.mean([a == b for a, b in zip(pred, yte)]))
    report = classification_report(yte, pred, output_dict=True, zero_division=0)
    print(classification_report(yte, pred, zero_division=0))
    print(f"held-out template accuracy: {acc:.3f} on {len(test)} questions from {len(held)} unseen templates")

    # Second router: logistic regression on local sentence embeddings, then the two averaged.
    Etr, Ete = embed([r[0] for r in train]), embed([r[0] for r in test])
    eclf = LogisticRegression(C=4.0, max_iter=3000).fit(Etr, ytr)
    epred = eclf.predict(Ete)
    eacc = float(np.mean([a == b for a, b in zip(epred, yte)]))
    pe = eclf.predict_proba(Ete)
    pc = clf.predict_proba(Xte)
    both = [clf.classes_[i] for i in (pe + pc).argmax(axis=1)]
    bacc = float(np.mean([a == b for a, b in zip(both, yte)]))
    print(f"embedding router: {eacc:.3f} · ensemble: {bacc:.3f} on unseen templates")
    ens_report = classification_report(yte, both, output_dict=True, zero_division=0)

    # Refit on everything for the shipped model.
    X = vec.fit_transform([r[0] for r in rows])
    clf.fit(X, [r[1] for r in rows])
    vocab = vec.vocabulary_
    # Prune features with negligible weight in every class to keep the JSON small.
    keep = np.arange(len(vocab))  # every feature: the L2 norm needs them all to match scikit-learn
    inv = {i: g for g, i in vocab.items()}
    model = {
        "kind": "tfidf-char_wb-logreg",
        "ngram": [2, 4],
        "sublinearTf": True,
        "classes": list(clf.classes_),
        "features": [inv[i] for i in keep],
        "idf": [round(float(vec.idf_[i]), 5) for i in keep],
        "coef": [[round(float(c), 4) for c in clf.coef_[k, keep]] for k in range(len(clf.classes_))],
        "intercept": [round(float(b), 4) for b in clf.intercept_],
        "trainedOn": len(rows),
        "heldOutAccuracy": round(acc, 4),
        "note": "Trained locally on template-generated questions (English, Marathi, Marathi in Latin letters); evaluated on unseen templates.",
    }
    OUT.write_text(json.dumps(model, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    E = embed([r[0] for r in rows])
    eclf.fit(E, [r[1] for r in rows])
    assert list(eclf.classes_) == list(clf.classes_)
    (ROOT / "web" / "src" / "data" / "router-embed.json").write_text(json.dumps({
        "kind": "nomic-embed-logreg", "model": EMBED_MODEL, "prefix": EMBED_PREFIX, "classes": list(eclf.classes_),
        "coef": [[round(float(c), 5) for c in row] for row in eclf.coef_], "intercept": [round(float(b), 5) for b in eclf.intercept_],
        "heldOutAccuracy": round(eacc, 4), "ensembleHeldOutAccuracy": round(bacc, 4),
    }), encoding="utf-8")
    labels = list(clf.classes_)
    REPORT.write_text(json.dumps({
        "charNgramHeldOutAccuracy": round(acc, 4),
        "embeddingHeldOutAccuracy": round(eacc, 4),
        "ensembleHeldOutAccuracy": round(bacc, 4),
        "ensemblePerClass": {k: {m: round(v, 3) for m, v in ens_report[k].items()} for k in labels if k in ens_report},
        "heldOutAccuracy": round(acc, 4),
        "testQuestions": len(test),
        "unseenTemplates": len(held),
        "trainQuestions": len(train),
        "features": len(keep),
        "perClass": {k: {m: round(v, 3) for m, v in report[k].items()} for k in labels if k in report},
        "labels": labels,
        "confusion": confusion_matrix(yte, both, labels=labels).tolist(),
        "samples": [{"text": t, "intent": i} for t, i, _ in rng.sample(test, 12)],
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB, {len(keep)} features)")
    # Parity fixtures for the TypeScript port.
    fx = [(t, clf.predict_proba(vec.transform([t]))[0].tolist()) for t, _, _ in rng.sample(rows, 25)]
    (ROOT / "web" / "scripts" / "router-fixtures.json").write_text(json.dumps([{"text": t, "proba": [round(p, 5) for p in pr]} for t, pr in fx], ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
