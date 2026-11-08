import type { UserRole } from "@/types/database.types";
import type { Locale } from "@/lib/i18n/config";

export const roleLabels: Record<Locale, Record<UserRole, string>> = {
  ar: {
    student: "طالب",
    owner: "مالك عقار",
    team: "فريق المعاينة",
    leader: "قائد الفريق",
    admin: "إدارة المنصة",
  },
  en: {
    student: "Student",
    owner: "Property owner",
    team: "Inspection team",
    leader: "Team leader",
    admin: "Platform admin",
  },
};

export const roleDescriptions: Record<Locale, Record<UserRole, string>> = {
  ar: {
    student: "بياناتك وترشيحات السكن والحجوزات هتظهر هنا مع المراحل الجاية.",
    owner: "وحداتك وطلبات المعاينة وحالتها هتظهر هنا مع المراحل الجاية.",
    team: "زيارات المعاينة والتقييمات المطلوبة منك هتظهر هنا مع المراحل الجاية.",
    leader: "الوحدات المنتظرة الاعتماد والقرارات هتظهر هنا مع المراحل الجاية.",
    admin: "إدارة المستخدمين والإعدادات والمتابعة هتظهر هنا مع المراحل الجاية.",
  },
  en: {
    student: "Your details, housing recommendations, and bookings will appear here in the next phases.",
    owner: "Your units, inspection requests, and their status will appear here in the next phases.",
    team: "Inspection visits and evaluations assigned to you will appear here in the next phases.",
    leader: "Units waiting for approval and decisions will appear here in the next phases.",
    admin: "User management, settings, and monitoring will appear here in the next phases.",
  },
};
