import type { Locale } from "@/lib/i18n/config";

export type LocalizedText = { ar: string; en: string };

export type UnitGender = "male" | "female";

export type AmenityKey = "wifi" | "ac" | "laundry" | "gas" | "elevator" | "desk" | "security";

export type SampleUnit = {
  id: string;
  name: LocalizedText;
  area: LocalizedText;
  address: LocalizedText;
  description: LocalizedText;
  price: number;
  gender: UnitGender;
  rating: number;
  reviews: number;
  availableBeds: number;
  totalBeds: number;
  roomType: "shared" | "private";
  roomTypeLabel: LocalizedText;
  distance: LocalizedText;
  amenities: AmenityKey[];
  tags: LocalizedText[];
  owner: LocalizedText;
  ownerResponse: number;
  matchScore?: number;
  instant: boolean;
  inspection: boolean;
  imageTone: "mint" | "sand" | "rose" | "sky" | "olive" | "clay" | "teal" | "amber";
};

export const sampleUnits: SampleUnit[] = [
  {
    id: "nile-palms",
    name: { ar: "سكن النخيل الجامعي", en: "Nile Palms Student Home" },
    area: { ar: "الدقي، 7 دقائق لمترو الدقي ومحطة الجامعة", en: "Dokki, 7 minutes to Dokki metro and campus" },
    address: {
      ar: "شارع مصدق الرئيسي، الدقي، الجيزة. الدور الثالث، عمارة هادئة بها بوابات إلكترونية وحراسة.",
      en: "Main Mossadak Street, Dokki, Giza. Third floor, a quiet building with electronic gates and security.",
    },
    description: {
      ar: "غرفة ثنائية مفروشة بالكامل بمكتب دراسة لكل طالبة، دولاب واسع وخزنة شخصية. الشقة هادئة ومجهزة للمذاكرة الجماعية، وقريبة من المترو والخدمات.",
      en: "A fully furnished twin room with a study desk for each student, a large wardrobe and a private safe. The flat is quiet, study-friendly and close to the metro and everyday services.",
    },
    price: 2900,
    gender: "female",
    rating: 4.9,
    reviews: 18,
    availableBeds: 2,
    totalBeds: 4,
    roomType: "shared",
    roomTypeLabel: { ar: "سرير في غرفة ثنائية", en: "Bed in a twin room" },
    distance: { ar: "7 دقائق سيراً للجامعة", en: "7 min walk to campus" },
    amenities: ["wifi", "ac", "desk", "laundry", "security"],
    tags: [
      { ar: "فايبر", en: "Fibre" },
      { ar: "مكيف", en: "A/C" },
      { ar: "مكتب", en: "Desk" },
    ],
    owner: { ar: "منى الشريف", en: "Mona El Sherif" },
    ownerResponse: 96,
    matchScore: 96,
    instant: true,
    inspection: true,
    imageTone: "mint",
  },
  {
    id: "central-students",
    name: { ar: "عمارة الطلبة المركزية", en: "Central Student House" },
    area: { ar: "بين السرايات، 3 دقائق سيراً لباب تجارة", en: "Bein El Sarayat, 3 min walk to Commerce gate" },
    address: {
      ar: "شارع بين السرايات، الجيزة. الدور الثاني، مدخل مستقل وقريب من كليات الجامعة.",
      en: "Bein El Sarayat Street, Giza. Second floor with a private entrance, close to the university faculties.",
    },
    description: {
      ar: "سرير في غرفة ثلاثية واسعة بتهوية ممتازة، مع إنترنت وغاز طبيعي ومطبخ مشترك مجهز. مناسبة للطلاب اللي بيحبوا أجواء جامعية هادئة.",
      en: "A bed in a spacious triple room with excellent ventilation, internet, natural gas and a equipped shared kitchen. Great for students who want a calm campus atmosphere.",
    },
    price: 2100,
    gender: "male",
    rating: 4.7,
    reviews: 24,
    availableBeds: 1,
    totalBeds: 3,
    roomType: "shared",
    roomTypeLabel: { ar: "سرير في غرفة ثلاثية", en: "Bed in a triple room" },
    distance: { ar: "3 دقائق سيراً للجامعة", en: "3 min walk to campus" },
    amenities: ["wifi", "gas", "desk", "laundry"],
    tags: [
      { ar: "إنترنت", en: "Internet" },
      { ar: "غاز", en: "Gas" },
    ],
    owner: { ar: "حسام الدين فاروق", en: "Hossam Farouk" },
    ownerResponse: 91,
    matchScore: 91,
    instant: true,
    inspection: true,
    imageTone: "sand",
  },
  {
    id: "mohandessin-studio",
    name: { ar: "استوديو المهندسين الهادئ", en: "Quiet Mohandessin Studio" },
    area: { ar: "المهندسين، شارع مصدق، خط مباشر للجامعة", en: "Mohandessin, Mossadak Street, direct line to campus" },
    address: {
      ar: "شارع مصدق، المهندسين. استوديو مستقل بحمام ومطبخ خاص، في عمارة بها أمن على مدار الساعة.",
      en: "Mossadak Street, Mohandessin. A private studio with its own bathroom and kitchen in a 24/7 secured building.",
    },
    description: {
      ar: "غرفة خاصة مستقلة بالكامل بحمام ومطبخ، مناسبة لطالب واحد بيحب الخصوصية والهدوء. الإنترنت سريع والتكييف راكب.",
      en: "A fully private room with its own bathroom and kitchen, ideal for one student who values privacy and quiet. Fast internet and air conditioning included.",
    },
    price: 4500,
    gender: "male",
    rating: 5,
    reviews: 12,
    availableBeds: 1,
    totalBeds: 1,
    roomType: "private",
    roomTypeLabel: { ar: "غرفة خاصة مستقلة", en: "Private studio room" },
    distance: { ar: "12 دقيقة للجامعة", en: "12 min to campus" },
    amenities: ["wifi", "ac", "laundry", "security", "desk"],
    tags: [
      { ar: "أمن 24/7", en: "24/7 security" },
      { ar: "خصوصية", en: "Private" },
    ],
    owner: { ar: "أحمد محمد عبد القادر", en: "Ahmed Mohamed Abdelkader" },
    ownerResponse: 98,
    matchScore: 94,
    instant: true,
    inspection: true,
    imageTone: "rose",
  },
  {
    id: "fardous",
    name: { ar: "سكن الفردوس الحديث", en: "Modern Fardous Home" },
    area: { ar: "فيصل، 4 دقائق لمحطة مترو فيصل", en: "Faisal, 4 minutes to Faisal metro" },
    address: {
      ar: "شارع الملك فيصل، الجيزة. الدور الأول، مدخل هادئ وقريب من المترو والأسواق.",
      en: "King Faisal Street, Giza. First floor with a quiet entrance, close to the metro and shops.",
    },
    description: {
      ar: "سرير بغرفة ثلاثية مجهزة، شامل فواتير الكهرباء والمياه والإنترنت. غسالة وأسانسير ومطبخ مشترك.",
      en: "A bed in a furnished triple room, with electricity, water and internet included. Washing machine, elevator and shared kitchen.",
    },
    price: 1850,
    gender: "male",
    rating: 4.6,
    reviews: 31,
    availableBeds: 2,
    totalBeds: 4,
    roomType: "shared",
    roomTypeLabel: { ar: "سرير في غرفة ثلاثية", en: "Bed in a triple room" },
    distance: { ar: "4 دقائق للمترو", en: "4 min to the metro" },
    amenities: ["wifi", "laundry", "elevator", "gas"],
    tags: [
      { ar: "إنترنت سريع", en: "Fast internet" },
      { ar: "غسالة", en: "Laundry" },
      { ar: "أسانسير", en: "Elevator" },
    ],
    owner: { ar: "وائل الشريف", en: "Wael El Sherif" },
    ownerResponse: 88,
    matchScore: 88,
    instant: false,
    inspection: true,
    imageTone: "sky",
  },
  {
    id: "dokki-residence",
    name: { ar: "ريزيدنس الدقي الفندقي", en: "Dokki Residence" },
    area: { ar: "الدقي، قرب ميدان المساحة والنيل", en: "Dokki, near Mesaha Square and the Nile" },
    address: {
      ar: "شارع المساحة، الدقي. الدور الخامس، حمام ماستر خاص وخدمة نظافة أسبوعية.",
      en: "El Mesaha Street, Dokki. Fifth floor, private en-suite bathroom and weekly cleaning.",
    },
    description: {
      ar: "سرير في غرفة مزدوجة مع حمام ماستر خاص، وخدمة نظافة أسبوعية. العمارة بها حراسة ومصعد وإنترنت سريع.",
      en: "A bed in a twin room with a private en-suite bathroom and weekly cleaning. The building has security, an elevator and fast internet.",
    },
    price: 3600,
    gender: "male",
    rating: 4.8,
    reviews: 27,
    availableBeds: 1,
    totalBeds: 2,
    roomType: "shared",
    roomTypeLabel: { ar: "سرير في غرفة مزدوجة", en: "Bed in a twin room" },
    distance: { ar: "9 دقائق للجامعة", en: "9 min to campus" },
    amenities: ["wifi", "ac", "security", "elevator"],
    tags: [
      { ar: "حمام ماستر", en: "En-suite" },
      { ar: "حراسة", en: "Security" },
      { ar: "نظافة", en: "Cleaning" },
    ],
    owner: { ar: "طارق سامي", en: "Tarek Samy" },
    ownerResponse: 94,
    matchScore: 90,
    instant: true,
    inspection: true,
    imageTone: "olive",
  },
  {
    id: "amal",
    name: { ar: "شقة الأمل الجامعية", en: "Amal Student Flat" },
    area: { ar: "العجوزة، كورنيش النيل قرب كوبري الجلاء", en: "Agouza, Nile corniche near Galaa Bridge" },
    address: {
      ar: "كورنيش النيل، العجوزة. الدور الرابع، إطلالة هادئة ومطبخ مجهز.",
      en: "Nile Corniche, Agouza. Fourth floor with a quiet view and a fully equipped kitchen.",
    },
    description: {
      ar: "سرير في غرفة ثنائية مع إطلالة هادئة ومطبخ مجهز. السكن مخصص للطالبات فقط، مع قواعد هدوء ومرافق كاملة.",
      en: "A bed in a twin room with a quiet view and a equipped kitchen. Female students only, with quiet hours and full facilities.",
    },
    price: 3100,
    gender: "female",
    rating: 4.8,
    reviews: 19,
    availableBeds: 1,
    totalBeds: 2,
    roomType: "shared",
    roomTypeLabel: { ar: "سرير في غرفة ثنائية", en: "Bed in a twin room" },
    distance: { ar: "10 دقائق للجامعة", en: "10 min to campus" },
    amenities: ["wifi", "ac", "laundry", "desk"],
    tags: [
      { ar: "إطلالة هادئة", en: "Quiet view" },
      { ar: "مطبخ مجهز", en: "Equipped kitchen" },
    ],
    owner: { ar: "سارة محمود", en: "Sara Mahmoud" },
    ownerResponse: 97,
    matchScore: 93,
    instant: true,
    inspection: true,
    imageTone: "clay",
  },
  {
    id: "yasmine",
    name: { ar: "سكن الياسمين للطالبات", en: "Yasmine Female Home" },
    area: { ar: "الحي الأول، التجمع الخامس قرب الجامعة الألمانية", en: "First Settlement, near the German University" },
    address: {
      ar: "الحي الأول، التجمع الخامس. كمبوند هادئ بحديقة وحراسة نسائية.",
      en: "First Settlement, Fifth Settlement. A quiet compound with a garden and female security.",
    },
    description: {
      ar: "غرفة فردية أو مزدوجة في فيلا هادئة، مع حراسة نسائية وخدمة نظافة. مناسبة لطالبات الجامعات الدولية في التجمع.",
      en: "A single or twin room in a quiet villa with female security and cleaning. Ideal for students at international universities in the Fifth Settlement.",
    },
    price: 5200,
    gender: "female",
    rating: 4.9,
    reviews: 21,
    availableBeds: 3,
    totalBeds: 6,
    roomType: "private",
    roomTypeLabel: { ar: "غرف فردية ومزدوجة", en: "Single and twin rooms" },
    distance: { ar: "8 دقائق للجامعة", en: "8 min to campus" },
    amenities: ["wifi", "ac", "laundry", "security", "elevator"],
    tags: [
      { ar: "حراسة نسائية", en: "Female security" },
      { ar: "هادئ", en: "Quiet" },
    ],
    owner: { ar: "د. منى عبد الرحمن", en: "Dr. Mona Abdelrahman" },
    ownerResponse: 99,
    matchScore: 89,
    instant: false,
    inspection: true,
    imageTone: "amber",
  },
  {
    id: "tagamoa-villa",
    name: { ar: "فيلا النرجس - التجمع الخامس", en: "Narges Villa - Fifth Settlement" },
    area: { ar: "التجمع الخامس، باص الجامعة يمر أمام البوابة", en: "Fifth Settlement, campus bus stops at the gate" },
    address: {
      ar: "الحي الخامس، التجمع الخامس. فيلا مستقلة بحديقة وباص الجامعة يمر أمام البوابة.",
      en: "Fifth district, Fifth Settlement. A detached villa with a garden and a campus bus at the gate.",
    },
    description: {
      ar: "غرف مفروشة في فيلا هادئة، مع مطبخ مشترك وحديقة. قريبة من الجامعة الألمانية والأمريكية.",
      en: "Furnished rooms in a quiet villa with a shared kitchen and garden. Close to the German and American universities.",
    },
    price: 4800,
    gender: "female",
    rating: 4.7,
    reviews: 16,
    availableBeds: 2,
    totalBeds: 5,
    roomType: "shared",
    roomTypeLabel: { ar: "سرير في غرفة مزدوجة", en: "Bed in a twin room" },
    distance: { ar: "باص الجامعة أمام البوابة", en: "Campus bus at the gate" },
    amenities: ["wifi", "ac", "laundry", "security"],
    tags: [
      { ar: "فيلا", en: "Villa" },
      { ar: "حديقة", en: "Garden" },
    ],
    owner: { ar: "أمل حسن", en: "Amal Hassan" },
    ownerResponse: 93,
    matchScore: 87,
    instant: true,
    inspection: true,
    imageTone: "teal",
  },
];

export function getSampleUnit(id: string) {
  return sampleUnits.find((unit) => unit.id === id);
}

export function localize(text: LocalizedText, locale: Locale) {
  return text[locale];
}

export const amenityLabels: Record<AmenityKey, LocalizedText> = {
  wifi: { ar: "إنترنت فائق السرعة", en: "High-speed internet" },
  ac: { ar: "تكييف", en: "Air conditioning" },
  laundry: { ar: "غسالة ملابس", en: "Washing machine" },
  gas: { ar: "غاز طبيعي", en: "Natural gas" },
  elevator: { ar: "مصعد", en: "Elevator" },
  desk: { ar: "مكتب دراسة", en: "Study desk" },
  security: { ar: "حراسة 24/7", en: "24/7 security" },
};
