"""~60 fictional patients. Phones 9000000001.. (the 90000 0xxxx fake range)."""
import random, datetime as dt, api, state
random.seed(42)
TODAY = dt.date(2026, 10, 25)
# (first, last, gender, age, region-language, blood)
P = """Anjali Deshmukh F 34 mr
Ramesh Yadav M 58 hi
Selvi Murugan F 46 ta
Arun Krishnan M 29 ml
Gurpreet Singh M 52 pa
Harpreet Kaur F 47 pa
Bhavna Shah F 38 gu
Jignesh Parmar M 61 gu
Sourav Ghosh M 44 bn
Moumita Das F 26 bn
Tenzin Dorjee M 33 en
Lalremruati Sailo F 41 en
Bikash Gogoi M 37 as
Pranjal Bora M 9 as
Sunita Mahato F 55 hi
Debashish Mohanty M 63 or
Srinivas Rao M 72 te
Padmavathi Naidu F 68 te
Manjunath Gowda M 49 kn
Shwetha Hegde F 31 kn
Ayesha Siddiqui F 27 ur
Imran Qureshi M 39 ur
Joseph Fernandes M 66 en
Maria D'Souza F 59 en
Vinod Nair M 81 ml
Thankamma Varghese F 88 ml
Kamala Devi F 76 ta
Muthu Kumar M 3 ta
Kavin Raj M 1 ta
Saanvi Agarwal F 6 hi
Ishaan Chauhan M 12 hi
Riya Saxena F 16 hi
Om Prakash Tiwari M 90 hi
Geeta Rawat F 64 hi
Nitin Patil M 42 mr
Ashwini Jadhav F 29 mr
Farhan Ansari M 23 hi
Zoya Mirza F 19 ur
Dinesh Choudhary M 51 hi
Meenakshi Sundaram F 57 ta
Rajesh Pandey M 47 hi
Priyanka Chatterjee F 35 bn
Abhishek Mishra M 31 hi
Nandini Iyer F 28 ta
Harish Shetty M 54 kn
Lata Mangeshkar-Joshi F 70 mr
Yash Thakur M 14 hi
Ananya Sen F 8 bn
Chandrakant Bhosale M 67 mr
Rukhsana Begum F 45 ur
Prakash Jha M 38 hi
Sarita Kumari F 24 hi
Venkatesh Iyer M 60 ta
Revathi Ramesh F 33 ta
Mohan Lal Sharma M 79 hi
Pushpa Rani F 62 te
Aryan Kapoor M 5 hi
Fathima Beevi F 50 ml
Rohit Bansal M 36 hi
Kiran Bedi-Rao F 43 kn
Test Probe M 36 hi""".splitlines()
LANG = {"hi":"hi","ta":"ta","mr":"mr","ml":"ml","pa":"pa","gu":"gu","bn":"bn","as":"as","or":"or","te":"te","kn":"kn","ur":"ur","en":"en"}
CITY = {"hi":("Lucknow","Uttar Pradesh"),"ta":("Chennai","Tamil Nadu"),"mr":("Pune","Maharashtra"),"ml":("Kochi","Kerala"),
 "pa":("Ludhiana","Punjab"),"gu":("Ahmedabad","Gujarat"),"bn":("Kolkata","West Bengal"),"as":("Guwahati","Assam"),
 "or":("Bhubaneswar","Odisha"),"te":("Hyderabad","Telangana"),"kn":("Bengaluru","Karnataka"),"ur":("Hyderabad","Telangana"),"en":("Goa","Goa")}
BLOOD = ["o_positive"]*5+["b_positive"]*4+["a_positive"]*3+["ab_positive","o_negative","a_negative","b_negative"]
ALLERGIES = {2:("drug","Penicillin","Urticarial rash","moderate"), 7:("drug","Sulfonamides","Rash","mild"),
 12:("food","Peanut","Lip swelling","severe"), 17:("drug","Aspirin","Bronchospasm","severe"),
 24:("drug","Ibuprofen","Gastritis","mild"), 30:("environmental","Dust mite","Rhinitis","mild"),
 33:("drug","Penicillin","Anaphylaxis","life_threatening"), 40:("contrast_dye","Iodinated contrast","Hives","moderate"),
 45:("food","Shellfish","Urticaria","moderate"), 52:("drug","Codeine","Nausea and vomiting","mild"),
 56:("latex","Latex","Contact dermatitis","mild"), 58:("drug","Metformin","GI intolerance","mild")}
CATS = {5:("insurance","insurance"),9:("insurance","insurance"),16:("pmjay","government_scheme"),18:("insurance","insurance"),
 22:("cghs","government_scheme"),25:("insurance","insurance"),35:("corporate","corporate"),41:("insurance","insurance"),
 49:("insurance","insurance"),53:("insurance","insurance"),26:("vip","self_pay")}

def rows():
    for i, line in enumerate(P, 1):
        *name, g, age, lang = line.split()
        first, last = name[0], " ".join(name[1:])
        if first == "Test":   # line 61 keeps the 9000099999 phone the first G2DEMO run used for it
            first, last, phone = "Sameer", "Kulkarni", "9000099999"
        else:
            phone = f"90000{i:05d}"
        dob = TODAY.replace(year=TODAY.year - int(age)) - dt.timedelta(days=random.randint(10, 300))
        yield i, dict(first_name=first, last_name=last, gender="male" if g == "M" else "female", phone=phone,
                      date_of_birth=dob.isoformat(), preferred_language=LANG[lang], blood_group=random.choice(BLOOD)), lang

def run():
    api.login()
    done = state.bucket("patients")
    for i, body, lang in rows():
        if body["phone"] in done: continue
        city, st = CITY[lang]
        body["address"] = {"line1": f"{random.randint(1,240)}, Demo Street {i}", "city": city, "state": st,
                           "country": "India", "pincode": f"{random.randint(110,855)}000"}
        cat = CATS.get(i, ("general", "self_pay"))
        body["category"], body["financial_class"] = cat
        body["registration_source"] = random.choice(["walk_in"]*4 + ["phone", "referral", "online_portal"])
        if body["registration_source"] == "referral":
            body["referred_by_name"], body["referred_by_facility"] = "Dr. P. Raman (fictional GP)", "Sunrise Clinic"
        body["contact"] = {"preferred_method": "sms", "whatsapp_opt_in": False, "email_opt_in": False}
        if i % 4 == 0:
            body["abha_number"] = f"99-0000-{i:04d}-{(i*7)%10000:04d}"   # dummy: "99" prefix, never a real ABHA
        if int((dt.date.today()-dt.date.fromisoformat(body["date_of_birth"])).days/365.25) < 18:
            body["guardian_name"], body["guardian_relation"] = f"Guardian of {body['first_name']}", "parent"
        found = api.get(f"/patients?search={body['phone']}")["patients"]
        if found:
            pid = found[0]["id"]
            if found[0]["first_name"] != body["first_name"]:
                upd = {k: v for k, v in body.items() if k not in ("contact", "abha_number")}
                api.try_(api.put, f"/patients/{pid}", upd)
        else:
            try:
                pid = api.post("/patients", body)["id"]
            except api.ApiError as e:
                print("patient", i, e); body.pop("abha_number", None); pid = api.post("/patients", body)["id"]
        done[body["phone"]] = pid
        if i in ALLERGIES:
            t, n, r, s = ALLERGIES[i]
            api.try_(api.post, f"/patients/{pid}/allergies", dict(allergy_type=t, allergen_name=n, reaction=r, severity=s))
        state.save()
    print("patients:", len(done))
if __name__ == "__main__": run()
