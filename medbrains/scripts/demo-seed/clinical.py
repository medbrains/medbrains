"""Department case-mix: complaint, ICD-11 code/title, Rx lines, lab tests, vitals profile."""
# Rx line: (drug code, dosage, frequency, duration, instructions)
T = {
 "GEN-MEDICINE": [
  ("Fever with chills for 4 days", "1A07", "Typhoid fever", [("AZI500","500 mg","OD","7 days","After food"),("PCM500","500 mg","TDS","5 days","SOS if temp >100F")], ["WIDAL","CBC","CRP"], "fever"),
  ("High BP on home monitor, headache", "BA00", "Essential hypertension", [("AMLO5","5 mg","OD","30 days","Morning"),("TELMI40","40 mg","OD","30 days","")], ["CREAT","K","NA"], "htn"),
  ("Increased thirst and frequent urination", "5A11", "Type 2 diabetes mellitus", [("MET500","500 mg","BD","30 days","With meals")], ["GLUF","HBA1C","CREAT"], "normal"),
  ("Burning epigastric pain after meals", "DA42", "Gastritis", [("PAN40","40 mg","OD","14 days","Before breakfast"),("ONDA4","4 mg","SOS","3 days","For nausea")], [], "normal"),
  ("Fever, body ache, rash", "1D20", "Dengue without warning signs", [("PCM500","500 mg","QID","5 days","Avoid NSAIDs"),("ORS","1 sachet","TDS","3 days","In 1 L water")], ["DENGUE","PLT","CBC"], "fever"),
  ("Fatigue, weight gain, cold intolerance", "5A00", "Hypothyroidism", [], ["TSH"], "normal"),
  ("Breathlessness and wheeze at night", "CA23", "Asthma", [("SALB100","2 puffs","SOS","30 days","Rinse mouth after use")], [], "resp"),
 ],
 "PAED": [
  ("Loose stools and vomiting since yesterday", "1A40.Z", "Infectious gastroenteritis or colitis", [("ORS","1 sachet","after each stool","3 days","Small sips")], [], "child"),
  ("Cough, cold and mild fever", "CA00", "Acute nasopharyngitis", [("PCM500","250 mg","TDS","3 days","Weight-based syrup equivalent")], [], "child"),
  ("Ear pain and fever", "AB00", "Acute otitis media", [("AMXCL","5 mL","BD","5 days","After food")], ["CBC"], "child"),
  ("Pallor and poor appetite", "3A00", "Iron deficiency anaemia", [("IFA","1 tablet","OD","30 days","After lunch")], ["HB","CBC"], "child"),
 ],
 "ORTHO": [
  ("Knee pain on climbing stairs", "FA01", "Osteoarthritis of knee", [("DICLO50","50 mg","BD","5 days","After food"),("PAN40","40 mg","OD","5 days","Before breakfast")], [], "normal"),
  ("Low back pain after lifting", "ME84.2", "Low back pain", [("DICLO50","50 mg","BD","5 days","After food")], [], "normal"),
  ("Fall on outstretched hand, wrist swelling", "NC32", "Fracture of forearm", [("TRAM50","50 mg","BD","3 days","Do not drive"),("PCM500","500 mg","TDS","5 days","")], [], "normal"),
 ],
 "CARDIO": [
  ("Chest tightness on exertion", "BA40.Z", "Angina pectoris", [("ATOR10","10 mg","HS","30 days","At bedtime"),("AMLO5","5 mg","OD","30 days","")], ["TROPI","LIPID"], "htn"),
  ("Swelling of feet and breathlessness", "BD10", "Congestive heart failure", [("TELMI40","40 mg","OD","30 days","Monitor BP at home")], ["CREAT","K","NA"], "resp"),
  ("Routine BP and lipid review", "BA00", "Essential hypertension", [("TELMI40","40 mg","OD","30 days",""),("ATOR10","10 mg","HS","30 days","")], ["LIPID"], "htn"),
 ],
 "OBGYN": [
  ("Missed periods, routine antenatal check", "GA20", "Amenorrhoea", [("IFA","1 tablet","OD","30 days","After lunch")], ["HB","URM"], "normal"),
  ("Burning micturition", "GC08", "Urinary tract infection, site not specified", [("PCM500","500 mg","SOS","3 days","")], ["URM"], "normal"),
  ("Irregular cycles and acne", "5A80.1", "Polycystic ovary syndrome", [("MET500","500 mg","BD","60 days","With meals")], ["GLUF","TSH"], "normal"),
 ],
 "ENT": [
  ("Ear pain and discharge", "AB00", "Acute otitis media", [("AZI500","500 mg","OD","3 days","After food")], [], "normal"),
  ("Sore throat and pain on swallowing", "CA03", "Acute tonsillitis", [("AZI500","500 mg","OD","3 days",""),("PCM500","500 mg","TDS","3 days","")], [], "fever"),
  ("Sneezing and blocked nose every morning", "CA08.0", "Allergic rhinitis", [("CETI10","10 mg","HS","10 days","May cause drowsiness")], [], "normal"),
  ("Facial pain and nasal discharge", "CA01", "Acute rhinosinusitis", [("CETI10","10 mg","HS","7 days","")], [], "normal"),
 ],
 "SURG": [
  ("Swelling in the groin on coughing", "DD51", "Inguinal hernia", [], ["CBC"], "normal"),
  ("Pain right lower abdomen", "DB10", "Acute appendicitis", [("ONDA4","4 mg","SOS","1 day","")], ["CBC","CRP"], "fever"),
 ],
}
PENICILLINS = {"AMOX500", "AMXCL"}
NSAIDS = {"DICLO50"}
def vitals(profile, rnd, age):
    v = dict(temperature=round(rnd.uniform(36.5, 37.3), 1), pulse=rnd.randint(68, 92), systolic_bp=rnd.randint(110, 134),
             diastolic_bp=rnd.randint(70, 86), respiratory_rate=rnd.randint(14, 18), spo2=rnd.randint(96, 99))
    if profile == "fever": v.update(temperature=round(rnd.uniform(38.2, 39.6), 1), pulse=rnd.randint(96, 118))
    if profile == "htn": v.update(systolic_bp=rnd.randint(148, 176), diastolic_bp=rnd.randint(92, 108))
    if profile == "resp": v.update(spo2=rnd.randint(89, 94), respiratory_rate=rnd.randint(22, 28), pulse=rnd.randint(98, 112))
    if profile == "child" or age < 14:
        v.update(pulse=rnd.randint(90, 130), systolic_bp=rnd.randint(90, 108), diastolic_bp=rnd.randint(55, 70),
                 respiratory_rate=rnd.randint(20, 30))
        if profile == "child" and rnd.random() < 0.5: v["temperature"] = round(rnd.uniform(38.0, 39.0), 1)
    w = 3.5 + age * 2.6 if age < 14 else rnd.uniform(48, 92)
    v["weight_kg"] = round(w, 1)
    v["height_cm"] = round(55 + age * 7.5 if age < 14 else rnd.uniform(150, 182))
    return v
