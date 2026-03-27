export type ShiftType = "day" | "night" | "consult" | "jeopardy" | "recovery" | "amet" | "nmet" | string;

export function getShiftColorClasses(shiftType: ShiftType): string {
  const normalized = shiftType.toLowerCase();

  if (normalized === "day" || normalized === "wk_day" || normalized === "weekday") {
    return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-100 dark:border-blue-700";
  }
  if (normalized === "night" || normalized === "nights" || normalized === "wk_night" || normalized === "weeknight") {
    return "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-100 dark:border-indigo-700";
  }
  if (normalized === "consult" || normalized === "consults") {
    return "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900 dark:text-teal-100 dark:border-teal-700";
  }
  if (normalized === "jeopardy") {
    return "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-700";
  }
  if (normalized === "recovery") {
    return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-700";
  }
  if (normalized === "amet") {
    return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-100 dark:border-purple-700";
  }
  if (normalized === "nmet") {
    return "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900 dark:text-rose-100 dark:border-rose-700";
  }

  return "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700";
}
