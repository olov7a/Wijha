import type { Locale } from "@/lib/i18n/config";
import type { ErrorCode } from "@/lib/errors";

/**
 * User-facing copy for the stable action error codes. Keeping the map here (and
 * not inside the dictionary) means a new backend code cannot silently ship an
 * empty message: the fallback is explicit.
 */
const messages: Record<Locale, Record<ErrorCode, string>> = {
  ar: {
    UNAUTHENTICATED: "لازم تسجّل الدخول الأول.",
    FORBIDDEN: "مالكش صلاحية تعمل الإجراء ده.",
    INVALID_INPUT: "راجع البيانات المدخلة.",
    NOT_FOUND: "العنصر المطلوب مش موجود أو اتحذف.",
    CONFLICT: "فيه تعارض مع بيانات موجودة. حدّث الصفحة وحاول تاني.",
    INVALID_STATE: "الحالة الحالية ما بتسمحش بالإجراء ده.",
    BED_UNAVAILABLE: "السرير ده اتحجز. اختار سرير تاني.",
    UNIT_NOT_APPROVED: "الوحدة دي لسه ما اتعتمدتش للحجز.",
    PROFILE_INCOMPLETE: "كمّل بياناتك الشخصية الأول قبل الحجز.",
    ACTIVE_BOOKINGS: "فيه حجوزات نشطة مرتبطة، ما ينفعش الحذف.",
    HAS_UPCOMING_VISITS: "فيه زيارات قادمة مرتبطة، ما ينفعش الحذف.",
    RESTORE_CONFLICT: "ما ينفعش الاسترجاع لأن فيه تعارض مع بيانات حالية.",
    UNEXPECTED: "حصل خطأ غير متوقع. حاول تاني.",
  },
  en: {
    UNAUTHENTICATED: "Sign in first.",
    FORBIDDEN: "You don't have permission to do this.",
    INVALID_INPUT: "Check the submitted data.",
    NOT_FOUND: "That item doesn't exist or was deleted.",
    CONFLICT: "This conflicts with existing data. Refresh and try again.",
    INVALID_STATE: "The current state doesn't allow this action.",
    BED_UNAVAILABLE: "That bed was just taken. Pick another one.",
    UNIT_NOT_APPROVED: "This unit is not approved for booking yet.",
    PROFILE_INCOMPLETE: "Complete your profile before booking.",
    ACTIVE_BOOKINGS: "Active bookings are linked to this item, so it can't be deleted.",
    HAS_UPCOMING_VISITS: "Upcoming visits are linked to this item, so it can't be deleted.",
    RESTORE_CONFLICT: "This can't be restored because it conflicts with current data.",
    UNEXPECTED: "Something went wrong. Try again.",
  },
};

export function actionErrorMessage(locale: Locale, code: ErrorCode): string {
  return messages[locale][code] ?? messages[locale].UNEXPECTED;
}
