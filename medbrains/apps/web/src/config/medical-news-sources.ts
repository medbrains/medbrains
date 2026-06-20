// Curated, free, reputable medical news + learning sources, grouped by the
// hospital role that gets the most value from them. Each group has a live RSS
// feed (streamed into the header ticker via a keyless RSS→JSON proxy) plus a
// hand-picked set of free magazines/journals as a reliable fallback + "browse"
// list. All sources are free to read (some ask for a free account).

export interface NewsSource {
  name: string;
  url: string;
}

export interface RoleNews {
  /** Short topic label shown as the ticker's leading chip. */
  topic: string;
  /** Live RSS feed for rolling headlines. */
  feedUrl: string;
  /** Free magazines / journals / learning hubs for this role. */
  sources: NewsSource[];
}

// Reusable feeds (public RSS, keyless).
const FEED_SCIENCEDAILY = "https://www.sciencedaily.com/rss/health_medicine.xml";
const FEED_MNT = "https://www.medicalnewstoday.com/rss";

const CLINICAL: RoleNews = {
  topic: "Clinical medicine",
  feedUrl: FEED_SCIENCEDAILY,
  sources: [
    { name: "The BMJ", url: "https://www.bmj.com/latest" },
    { name: "The Lancet", url: "https://www.thelancet.com" },
    { name: "Medscape", url: "https://www.medscape.com/news" },
    { name: "NEJM Journal Watch", url: "https://www.jwatch.org" },
    { name: "MedlinePlus", url: "https://medlineplus.gov" },
  ],
};

const SURGERY: RoleNews = {
  topic: "Surgery",
  feedUrl: FEED_SCIENCEDAILY,
  sources: [
    { name: "JAMA Surgery", url: "https://jamanetwork.com/journals/jamasurgery" },
    { name: "Annals of Surgery", url: "https://journals.lww.com/annalsofsurgery" },
    { name: "British Journal of Surgery", url: "https://academic.oup.com/bjs" },
    { name: "Medscape Surgery", url: "https://www.medscape.com/surgery" },
  ],
};

const NURSING: RoleNews = {
  topic: "Nursing",
  feedUrl: FEED_MNT,
  sources: [
    { name: "American Nurse Journal", url: "https://www.myamericannurse.com" },
    { name: "Nursing Times", url: "https://www.nursingtimes.net" },
    { name: "Minority Nurse", url: "https://minoritynurse.com" },
    { name: "Nurse.org News", url: "https://nurse.org/articles" },
  ],
};

const PHARMACY: RoleNews = {
  topic: "Pharmacy",
  feedUrl: FEED_MNT,
  sources: [
    { name: "Pharmacy Times", url: "https://www.pharmacytimes.com" },
    { name: "The Pharmaceutical Journal", url: "https://pharmaceutical-journal.com" },
    { name: "Drug Topics", url: "https://www.drugtopics.com" },
    {
      name: "WHO Essential Medicines",
      url: "https://www.who.int/groups/expert-committee-on-selection-and-use-of-essential-medicines",
    },
  ],
};

const LABORATORY: RoleNews = {
  topic: "Laboratory",
  feedUrl: FEED_SCIENCEDAILY,
  sources: [
    { name: "Medical Laboratory Observer", url: "https://www.mlo-online.com" },
    { name: "The Pathologist", url: "https://thepathologist.com" },
    { name: "Lab Medicine (OUP)", url: "https://academic.oup.com/labmed" },
    { name: "AACC / ADLM", url: "https://www.myadlm.org" },
  ],
};

const RADIOLOGY: RoleNews = {
  topic: "Radiology",
  feedUrl: FEED_SCIENCEDAILY,
  sources: [
    { name: "RSNA Radiology", url: "https://pubs.rsna.org/journal/radiology" },
    { name: "AuntMinnie", url: "https://www.auntminnie.com" },
    { name: "Applied Radiology", url: "https://www.appliedradiology.com" },
    { name: "AJR", url: "https://www.ajronline.org" },
  ],
};

const MANAGEMENT: RoleNews = {
  topic: "Health management",
  feedUrl: FEED_MNT,
  sources: [
    { name: "Modern Healthcare", url: "https://www.modernhealthcare.com" },
    { name: "Becker's Hospital Review", url: "https://www.beckershospitalreview.com" },
    { name: "Healthcare IT News", url: "https://www.healthcareitnews.com" },
    { name: "WHO News", url: "https://www.who.int/news" },
  ],
};

const DENTAL: RoleNews = {
  topic: "Dentistry",
  feedUrl: FEED_SCIENCEDAILY,
  sources: [
    { name: "Dental Tribune", url: "https://www.dental-tribune.com" },
    { name: "JADA", url: "https://jada.ada.org" },
    { name: "Dentistry Today", url: "https://www.dentistrytoday.com" },
  ],
};

// Medical college / students / faculty / continuing education.
const LEARNING: RoleNews = {
  topic: "Learning & education",
  feedUrl: FEED_SCIENCEDAILY,
  sources: [
    { name: "Osmosis Blog", url: "https://www.osmosis.org/blog" },
    { name: "Lecturio Magazine", url: "https://www.lecturio.com/magazine/" },
    { name: "AMBOSS Blog", url: "https://www.amboss.com/us/knowledge" },
    { name: "The BMJ — Students", url: "https://www.bmj.com/student" },
    { name: "PubMed", url: "https://pubmed.ncbi.nlm.nih.gov" },
    { name: "NPTEL (free courses)", url: "https://nptel.ac.in/course.html" },
  ],
};

const GENERAL: RoleNews = {
  topic: "Health headlines",
  feedUrl: FEED_SCIENCEDAILY,
  sources: [
    { name: "WHO News", url: "https://www.who.int/news" },
    { name: "MedlinePlus", url: "https://medlineplus.gov" },
    { name: "ScienceDaily — Health", url: "https://www.sciencedaily.com/news/health_medicine/" },
    { name: "Medical News Today", url: "https://www.medicalnewstoday.com" },
    { name: "Healthline", url: "https://www.healthline.com/health-news" },
  ],
};

// Role keyword → group. First match wins (checked against lowercased role).
const ROLE_MATCHERS: { keywords: string[]; news: RoleNews }[] = [
  { keywords: ["surgeon", "surgery", "ot_", "theatre"], news: SURGERY },
  { keywords: ["dentist", "dental"], news: DENTAL },
  { keywords: ["nurse", "nursing", "midwife"], news: NURSING },
  { keywords: ["pharm", "dispens"], news: PHARMACY },
  { keywords: ["lab", "patholog", "phlebot", "microbio"], news: LABORATORY },
  { keywords: ["radio", "imaging", "sonograph", "xray", "x_ray"], news: RADIOLOGY },
  {
    keywords: ["student", "faculty", "intern", "resident", "college", "trainee", "tutor"],
    news: LEARNING,
  },
  {
    keywords: [
      "admin",
      "manager",
      "director",
      "billing",
      "cashier",
      "account",
      "reception",
      "front_office",
      "registrar",
    ],
    news: MANAGEMENT,
  },
  {
    keywords: ["doctor", "physician", "consultant", "clinician", "medical_officer", "mo"],
    news: CLINICAL,
  },
];

/** Pick the most relevant free news/learning sources for a hospital role. */
export function newsForRole(role?: string | null): RoleNews {
  if (!role) return GENERAL;
  const value = role.toLowerCase();
  const match = ROLE_MATCHERS.find((entry) =>
    entry.keywords.some((keyword) => value.includes(keyword)),
  );
  return match?.news ?? GENERAL;
}
