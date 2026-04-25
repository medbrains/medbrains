#!/usr/bin/env python3
"""Import India's complete district list into geo_districts table.

Uses the India Census/LGD mapping with all 770+ districts.
Generates a SQL migration file with INSERT statements.

Usage:
    python3 scripts/import_lgd_districts.py

Output:
    crates/medbrains-db/src/migrations/112_lgd_districts.sql
"""

import json
import uuid
import os

# State UUID mapping (must match migration 004_seed_geo.sql exactly)
STATE_UUIDS = {
    "AP": "b0000000-0000-0000-0000-000000000001",
    "AR": "b0000000-0000-0000-0000-000000000002",
    "AS": "b0000000-0000-0000-0000-000000000003",
    "BR": "b0000000-0000-0000-0000-000000000004",
    "CG": "b0000000-0000-0000-0000-000000000005",
    "GA": "b0000000-0000-0000-0000-000000000006",
    "GJ": "b0000000-0000-0000-0000-000000000007",
    "HR": "b0000000-0000-0000-0000-000000000008",
    "HP": "b0000000-0000-0000-0000-000000000009",
    "JH": "b0000000-0000-0000-0000-000000000010",
    "KA": "b0000000-0000-0000-0000-000000000011",
    "KL": "b0000000-0000-0000-0000-000000000012",
    "MP": "b0000000-0000-0000-0000-000000000013",
    "MH": "b0000000-0000-0000-0000-000000000014",
    "MN": "b0000000-0000-0000-0000-000000000015",
    "ML": "b0000000-0000-0000-0000-000000000016",
    "MZ": "b0000000-0000-0000-0000-000000000017",
    "NL": "b0000000-0000-0000-0000-000000000018",
    "OD": "b0000000-0000-0000-0000-000000000019",
    "PB": "b0000000-0000-0000-0000-000000000020",
    "RJ": "b0000000-0000-0000-0000-000000000021",
    "SK": "b0000000-0000-0000-0000-000000000022",
    "TN": "b0000000-0000-0000-0000-000000000023",
    "TS": "b0000000-0000-0000-0000-000000000024",
    "TR": "b0000000-0000-0000-0000-000000000025",
    "UP": "b0000000-0000-0000-0000-000000000026",
    "UK": "b0000000-0000-0000-0000-000000000027",
    "WB": "b0000000-0000-0000-0000-000000000028",
    "AN": "b0000000-0000-0000-0000-000000000029",
    "CH": "b0000000-0000-0000-0000-000000000030",
    "DN": "b0000000-0000-0000-0000-000000000031",
    "DL": "b0000000-0000-0000-0000-000000000032",
    "JK": "b0000000-0000-0000-0000-000000000033",
    "LA": "b0000000-0000-0000-0000-000000000034",
    "LD": "b0000000-0000-0000-0000-000000000035",
    "PY": "b0000000-0000-0000-0000-000000000036",
}

# Complete India district list by state (LGD Census 2021)
# Format: { state_code: [district_name, ...] }
DISTRICTS = {
    "AP": [
        "Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna",
        "Kurnool", "Nellore", "Prakasam", "Srikakulam",
        "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa",
        "Alluri Sitharama Raju", "Anakapalli", "Annamayya", "Bapatla",
        "Eluru", "Kakinada", "Konaseema", "Nandyal", "NTR",
        "Palnadu", "Parvathipuram Manyam", "Sri Sathya Sai",
        "Tirupati",
    ],
    "AR": [
        "Anjaw", "Changlang", "Dibang Valley", "East Kameng", "East Siang",
        "Kamle", "Kra Daadi", "Kurung Kumey", "Lepa Rada",
        "Lohit", "Longding", "Lower Dibang Valley", "Lower Siang",
        "Lower Subansiri", "Namsai", "Pakke Kessang", "Papum Pare",
        "Shi Yomi", "Siang", "Tawang", "Tirap", "Upper Siang",
        "Upper Subansiri", "West Kameng", "West Siang",
    ],
    "AS": [
        "Baksa", "Barpeta", "Biswanath", "Bongaigaon", "Cachar",
        "Charaideo", "Chirang", "Darrang", "Dhemaji", "Dhubri",
        "Dibrugarh", "Dima Hasao", "Goalpara", "Golaghat",
        "Hailakandi", "Hojai", "Jorhat", "Kamrup", "Kamrup Metropolitan",
        "Karbi Anglong", "Karimganj", "Kokrajhar", "Lakhimpur",
        "Majuli", "Morigaon", "Nagaon", "Nalbari", "Sivasagar",
        "Sonitpur", "South Salmara-Mankachar", "Tinsukia", "Udalguri",
        "West Karbi Anglong",
    ],
    "BR": [
        "Araria", "Arwal", "Aurangabad", "Banka", "Begusarai",
        "Bhagalpur", "Bhojpur", "Buxar", "Darbhanga", "East Champaran",
        "Gaya", "Gopalganj", "Jamui", "Jehanabad", "Kaimur",
        "Katihar", "Khagaria", "Kishanganj", "Lakhisarai", "Madhepura",
        "Madhubani", "Munger", "Muzaffarpur", "Nalanda", "Nawada",
        "Patna", "Purnia", "Rohtas", "Saharsa", "Samastipur",
        "Saran", "Sheikhpura", "Sheohar", "Sitamarhi", "Siwan",
        "Supaul", "Vaishali", "West Champaran",
    ],
    "CG": [
        "Balod", "Baloda Bazar", "Balrampur", "Bastar", "Bemetara",
        "Bijapur", "Bilaspur", "Dantewada", "Dhamtari", "Durg",
        "Gariaband", "Gaurela-Pendra-Marwahi", "Janjgir-Champa",
        "Jashpur", "Kanker", "Kabirdham", "Kondagaon", "Korba",
        "Koriya", "Mahasamund", "Mungeli", "Narayanpur", "Raigarh",
        "Raipur", "Rajnandgaon", "Sukma", "Surajpur", "Surguja",
        "Khairagarh-Chhuikhadan-Gandai", "Manendragarh-Chirmiri-Bharatpur",
        "Mohla-Manpur-Ambagarh Chowki", "Sarangarh-Bilaigarh", "Sakti",
    ],
    "GA": ["North Goa", "South Goa"],
    "GJ": [
        "Ahmedabad", "Amreli", "Anand", "Aravalli", "Banaskantha",
        "Bharuch", "Bhavnagar", "Botad", "Chhota Udaipur", "Dahod",
        "Dang", "Devbhoomi Dwarka", "Gandhinagar", "Gir Somnath",
        "Jamnagar", "Junagadh", "Kheda", "Kutch", "Mahisagar",
        "Mehsana", "Morbi", "Narmada", "Navsari", "Panchmahal",
        "Patan", "Porbandar", "Rajkot", "Sabarkantha", "Surat",
        "Surendranagar", "Tapi", "Vadodara", "Valsad",
    ],
    "HR": [
        "Ambala", "Bhiwani", "Charkhi Dadri", "Faridabad", "Fatehabad",
        "Gurugram", "Hisar", "Jhajjar", "Jind", "Kaithal",
        "Karnal", "Kurukshetra", "Mahendragarh", "Nuh", "Palwal",
        "Panchkula", "Panipat", "Rewari", "Rohtak", "Sirsa",
        "Sonipat", "Yamunanagar",
    ],
    "HP": [
        "Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kinnaur",
        "Kullu", "Lahaul and Spiti", "Mandi", "Shimla", "Sirmaur",
        "Solan", "Una",
    ],
    "JH": [
        "Bokaro", "Chatra", "Deoghar", "Dhanbad", "Dumka",
        "East Singhbhum", "Garhwa", "Giridih", "Godda", "Gumla",
        "Hazaribagh", "Jamtara", "Khunti", "Koderma", "Latehar",
        "Lohardaga", "Pakur", "Palamu", "Ramgarh", "Ranchi",
        "Sahibganj", "Saraikela-Kharsawan", "Simdega", "West Singhbhum",
    ],
    "KA": [
        "Bagalkot", "Bangalore Rural", "Bangalore Urban", "Belgaum",
        "Bellary", "Bidar", "Chamarajanagar", "Chikballapur",
        "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere",
        "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi",
        "Kodagu", "Kolar", "Koppal", "Mandya", "Mysore",
        "Raichur", "Ramanagara", "Shimoga", "Tumkur",
        "Udupi", "Uttara Kannada", "Vijayanagara", "Yadgir",
    ],
    "KL": [
        "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod",
        "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad",
        "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad",
    ],
    "MP": [
        "Agar Malwa", "Alirajpur", "Anuppur", "Ashoknagar", "Balaghat",
        "Barwani", "Betul", "Bhind", "Bhopal", "Burhanpur",
        "Chhatarpur", "Chhindwara", "Damoh", "Datia", "Dewas",
        "Dhar", "Dindori", "Guna", "Gwalior", "Harda",
        "Hoshangabad", "Indore", "Jabalpur", "Jhabua", "Katni",
        "Khandwa", "Khargone", "Mandla", "Mandsaur", "Morena",
        "Narsinghpur", "Neemuch", "Niwari", "Panna", "Raisen",
        "Rajgarh", "Ratlam", "Rewa", "Sagar", "Satna",
        "Sehore", "Seoni", "Shahdol", "Shajapur", "Sheopur",
        "Shivpuri", "Sidhi", "Singrauli", "Tikamgarh", "Ujjain",
        "Umaria", "Vidisha",
    ],
    "MH": [
        "Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed",
        "Bhandara", "Buldhana", "Chandrapur", "Dhule", "Gadchiroli",
        "Gondia", "Hingoli", "Jalgaon", "Jalna", "Kolhapur",
        "Latur", "Mumbai City", "Mumbai Suburban", "Nagpur", "Nanded",
        "Nandurbar", "Nashik", "Osmanabad", "Palghar", "Parbhani",
        "Pune", "Raigad", "Ratnagiri", "Sangli", "Satara",
        "Sindhudurg", "Solapur", "Thane", "Wardha", "Washim",
        "Yavatmal",
    ],
    "MN": [
        "Bishnupur", "Chandel", "Churachandpur", "Imphal East",
        "Imphal West", "Jiribam", "Kakching", "Kamjong", "Kangpokpi",
        "Noney", "Pherzawl", "Senapati", "Tamenglong", "Tengnoupal",
        "Thoubal", "Ukhrul",
    ],
    "ML": [
        "East Garo Hills", "East Jaintia Hills", "East Khasi Hills",
        "North Garo Hills", "Ri-Bhoi", "South Garo Hills",
        "South West Garo Hills", "South West Khasi Hills",
        "West Garo Hills", "West Jaintia Hills", "West Khasi Hills",
        "Eastern West Khasi Hills",
    ],
    "MZ": [
        "Aizawl", "Champhai", "Hnahthial", "Khawzawl", "Kolasib",
        "Lawngtlai", "Lunglei", "Mamit", "Saitual", "Saiha",
        "Serchhip",
    ],
    "NL": [
        "Chümoukedima", "Dimapur", "Kiphire", "Kohima", "Longleng",
        "Mokokchung", "Mon", "Niuland", "Noklak", "Peren",
        "Phek", "Shamator", "Tseminyü", "Tuensang", "Wokha",
        "Zunheboto",
    ],
    "OD": [
        "Angul", "Balangir", "Balasore", "Bargarh", "Bhadrak",
        "Boudh", "Cuttack", "Deogarh", "Dhenkanal", "Gajapati",
        "Ganjam", "Jagatsinghpur", "Jajpur", "Jharsuguda", "Kalahandi",
        "Kandhamal", "Kendrapara", "Kendujhar", "Khordha", "Koraput",
        "Malkangiri", "Mayurbhanj", "Nabarangpur", "Nayagarh", "Nuapada",
        "Puri", "Rayagada", "Sambalpur", "Sonepur", "Sundargarh",
    ],
    "PB": [
        "Amritsar", "Barnala", "Bathinda", "Faridkot", "Fatehgarh Sahib",
        "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar",
        "Kapurthala", "Ludhiana", "Malerkotla", "Mansa", "Moga",
        "Muktsar", "Nawanshahr", "Pathankot", "Patiala", "Rupnagar",
        "Sangrur", "SAS Nagar", "Tarn Taran",
    ],
    "RJ": [
        "Ajmer", "Alwar", "Banswara", "Baran", "Barmer",
        "Bharatpur", "Bhilwara", "Bikaner", "Bundi", "Chittorgarh",
        "Churu", "Dausa", "Dholpur", "Dungarpur", "Hanumangarh",
        "Jaipur", "Jaisalmer", "Jalore", "Jhalawar", "Jhunjhunu",
        "Jodhpur", "Karauli", "Kota", "Nagaur", "Pali",
        "Pratapgarh", "Rajsamand", "Sawai Madhopur", "Sikar",
        "Sirohi", "Sri Ganganagar", "Tonk", "Udaipur",
    ],
    "SK": ["East Sikkim", "North Sikkim", "South Sikkim", "West Sikkim", "Pakyong", "Soreng"],
    "TN": [
        "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
        "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram",
        "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
        "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
        "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi",
        "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli",
        "Tirunelveli", "Tirupathur", "Tiruppur", "Tiruvallur",
        "Tiruvannamalai", "Tiruvarur", "Vellore", "Viluppuram",
        "Virudhunagar",
    ],
    "TS": [
        "Adilabad", "Bhadradri Kothagudem", "Hyderabad", "Jagtial",
        "Jangaon", "Jayashankar Bhupalpally", "Jogulamba Gadwal",
        "Kamareddy", "Karimnagar", "Khammam", "Komaram Bheem Asifabad",
        "Mahabubabad", "Mahabubnagar", "Mancherial", "Medak",
        "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool", "Nalgonda",
        "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli", "Rajanna Sircilla",
        "Rangareddy", "Sangareddy", "Siddipet", "Suryapet",
        "Vikarabad", "Wanaparthy", "Warangal", "Yadadri Bhuvanagiri",
    ],
    "TR": [
        "Dhalai", "Gomati", "Khowai", "North Tripura",
        "Sepahijala", "South Tripura", "Unakoti", "West Tripura",
    ],
    "UP": [
        "Agra", "Aligarh", "Ambedkar Nagar", "Amethi", "Amroha",
        "Auraiya", "Ayodhya", "Azamgarh", "Baghpat", "Bahraich",
        "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly",
        "Basti", "Bhadohi", "Bijnor", "Budaun", "Bulandshahr",
        "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah",
        "Farrukhabad", "Fatehpur", "Firozabad", "Gautam Buddha Nagar",
        "Ghaziabad", "Ghazipur", "Gonda", "Gorakhpur", "Hamirpur",
        "Hapur", "Hardoi", "Hathras", "Jalaun", "Jaunpur",
        "Jhansi", "Kannauj", "Kanpur Dehat", "Kanpur Nagar",
        "Kasganj", "Kaushambi", "Kushinagar", "Lakhimpur Kheri",
        "Lalitpur", "Lucknow", "Maharajganj", "Mahoba", "Mainpuri",
        "Mathura", "Mau", "Meerut", "Mirzapur", "Moradabad",
        "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Prayagraj",
        "Rae Bareli", "Rampur", "Saharanpur", "Sambhal", "Sant Kabir Nagar",
        "Shahjahanpur", "Shamli", "Shrawasti", "Siddharthnagar",
        "Sitapur", "Sonbhadra", "Sultanpur", "Unnao", "Varanasi",
    ],
    "UK": [
        "Almora", "Bageshwar", "Chamoli", "Champawat", "Dehradun",
        "Haridwar", "Nainital", "Pauri Garhwal", "Pithoragarh",
        "Rudraprayag", "Tehri Garhwal", "Udham Singh Nagar", "Uttarkashi",
    ],
    "WB": [
        "Alipurduar", "Bankura", "Birbhum", "Cooch Behar", "Dakshin Dinajpur",
        "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Jhargram",
        "Kalimpong", "Kolkata", "Malda", "Murshidabad", "Nadia",
        "North 24 Parganas", "Paschim Bardhaman", "Paschim Medinipur",
        "Purba Bardhaman", "Purba Medinipur", "Purulia",
        "South 24 Parganas", "Uttar Dinajpur",
    ],
    # Union Territories
    "AN": ["Nicobar", "North and Middle Andaman", "South Andaman"],
    "CH": ["Chandigarh"],
    "DN": ["Dadra and Nagar Haveli", "Daman", "Diu"],
    "DL": [
        "Central Delhi", "East Delhi", "New Delhi", "North Delhi",
        "North East Delhi", "North West Delhi", "Shahdara",
        "South Delhi", "South East Delhi", "South West Delhi",
        "West Delhi",
    ],
    "JK": [
        "Anantnag", "Bandipora", "Baramulla", "Budgam", "Doda",
        "Ganderbal", "Jammu", "Kathua", "Kishtwar", "Kulgam",
        "Kupwara", "Poonch", "Pulwama", "Rajouri", "Ramban",
        "Reasi", "Samba", "Shopian", "Srinagar", "Udhampur",
    ],
    "LA": ["Kargil", "Leh"],
    "LD": ["Lakshadweep"],
    "PY": ["Karaikal", "Mahe", "Puducherry", "Yanam"],
}


def generate_uuid_for_district(state_code: str, district_name: str) -> str:
    """Generate a deterministic UUID for a district using namespace UUID5."""
    namespace = uuid.UUID("d0000000-0000-0000-0000-000000000000")
    return str(uuid.uuid5(namespace, f"{state_code}:{district_name}"))


def escape_sql(s: str) -> str:
    return s.replace("'", "''")


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(
        script_dir,
        "..",
        "crates",
        "medbrains-db",
        "src",
        "migrations",
        "112_lgd_districts.sql",
    )

    total = 0
    lines = [
        "-- 112: Complete India District Data (LGD Census)",
        "-- All 770+ districts across 36 states/UTs",
        "-- Generated by scripts/import_lgd_districts.py",
        "-- Idempotent: ON CONFLICT DO NOTHING",
        "",
    ]

    for state_code, districts in sorted(DISTRICTS.items()):
        state_uuid = STATE_UUIDS.get(state_code)
        if not state_uuid:
            print(f"WARNING: No UUID for state {state_code}, skipping")
            continue

        state_name = next(
            (
                name
                for code, name in [
                    ("AP", "Andhra Pradesh"), ("AR", "Arunachal Pradesh"),
                    ("AS", "Assam"), ("BR", "Bihar"), ("CG", "Chhattisgarh"),
                    ("GA", "Goa"), ("GJ", "Gujarat"), ("HR", "Haryana"),
                    ("HP", "Himachal Pradesh"), ("JH", "Jharkhand"),
                    ("KA", "Karnataka"), ("KL", "Kerala"), ("MP", "Madhya Pradesh"),
                    ("MH", "Maharashtra"), ("MN", "Manipur"), ("ML", "Meghalaya"),
                    ("MZ", "Mizoram"), ("NL", "Nagaland"), ("OD", "Odisha"),
                    ("PB", "Punjab"), ("RJ", "Rajasthan"), ("SK", "Sikkim"),
                    ("TN", "Tamil Nadu"), ("TS", "Telangana"), ("TR", "Tripura"),
                    ("UP", "Uttar Pradesh"), ("UK", "Uttarakhand"), ("WB", "West Bengal"),
                    ("AN", "Andaman and Nicobar"), ("CH", "Chandigarh"),
                    ("DN", "Dadra and Nagar Haveli"), ("DL", "Delhi"),
                    ("JK", "Jammu and Kashmir"), ("LA", "Ladakh"),
                    ("LD", "Lakshadweep"), ("PY", "Puducherry"),
                ]
                if code == state_code
            ),
            state_code,
        )

        lines.append(f"-- {state_name} ({len(districts)} districts)")
        for dist in districts:
            dist_uuid = generate_uuid_for_district(state_code, dist)
            dist_code = dist.upper().replace(" ", "_").replace("-", "_")[:10]
            lines.append(
                f"INSERT INTO geo_districts (id, state_id, code, name) "
                f"VALUES ('{dist_uuid}', '{state_uuid}', '{escape_sql(dist_code)}', "
                f"'{escape_sql(dist)}') ON CONFLICT DO NOTHING;"
            )
            total += 1
        lines.append("")

    output = "\n".join(lines) + "\n"

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        f.write(output)

    print(f"Generated {output_path}")
    print(f"Total districts: {total}")


if __name__ == "__main__":
    main()
