export interface DateRange {
  start: string;
  end: string;
}

// Local-timezone YYYY-MM-DD (not toISOString, which is UTC and can be a day off).
export function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function thisMonthRange(): DateRange {
  const now = new Date();
  return {
    start: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}
