/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useScheduleStore, Provider, ShiftSlot } from "../store";
import { parseISO, format } from "date-fns";

// Columns in MASTER excel:
// 0: Month
// 1: G20
// 2: H22
// 3: Akron
// 4: Nights
// 5: Consults
// 6: AMET
// 7: Jeopardy
// 8: Recovery
// 9: Vacations

const COLUMN_HEADERS = [
  "Month / Date",
  "G20",
  "H22",
  "Akron",
  "Nights",
  "Consults",
  "AMET / NMET",
  "Jeopardy",
  "Recovery",
  "Vacations",
];

// Mapping our specific slot IDs or types to standard column indexes
const slotToColumnMap: Record<string, number> = {
  "DAY-G20": 1,
  "DAY-H22": 2,
  "DAY-Akron": 3,
  "NIGHT-Main Campus": 4, // or NIGHT-0
  "NIGHT-0": 4,
  "CONSULTS-Main Campus": 5,
  "CONSULTS-0": 5,
  "NMET-Main Campus": 6,
  "NMET-0": 6,
  "JEOPARDY-Main Campus": 7,
  "JEOPARDY-0": 7,
  "RECOVERY-Main Campus": 8,
  "RECOVERY-0": 8,
  "VACATION-Any": 9,
  "VACATION-0": 9,
};

export const exportScheduleToExcel = () => {
  const { slots, startDate, providers } = useScheduleStore.getState();

  // Group slots by date
  const slotsByDate: Record<string, typeof slots> = {};
  slots.forEach((s: any) => {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = [];
    slotsByDate[s.date].push(s);
  });

  const dates = Object.keys(slotsByDate).sort();

  const wsData: any[][] = [COLUMN_HEADERS];

  dates.forEach((date) => {
    const row = new Array(COLUMN_HEADERS.length).fill(null);
    const dateObj = parseISO(date);

    // Check if it's the 1st of the month to inject a month header row
    if (dateObj.getDate() === 1 || date === dates[0]) {
      const monthRow = new Array(COLUMN_HEADERS.length).fill(format(dateObj, "MMMM"));
      wsData.push(monthRow);
    }

    // First column is the Date itself
    row[0] = dateObj; // Excel can format dates

    const daySlots = slotsByDate[date];
    daySlots.forEach((slot: ShiftSlot) => {
      // Find the right column
      let colKey = `${slot.type}-${slot.location}`;
      if (!slotToColumnMap[colKey]) {
        // Fallback for generic slots
        colKey = `${slot.type}-0`;
      }

      const colIdx = slotToColumnMap[colKey];

      if (colIdx !== undefined) {
        if (slot.providerId) {
          const p = providers.find((prov: Provider) => prov.id === slot.providerId);
          row[colIdx] = p ? p.name : "";
        }
      }
    });

    wsData.push(row);
  });

  // Add Provider Target Stats at the bottom
  wsData.push([]);
  wsData.push(["Provider Stats"]);
  wsData.push([
    "Name",
    "Week Days",
    "Weekend Days",
    "Week Nights",
    "Weekend Nights",
    "Unavailable",
  ]);

  providers.forEach((p: any) => {
    wsData.push([
      p.name,
      p.targetWeekDays,
      p.targetWeekendDays,
      p.targetWeekNights,
      p.targetWeekendNights,
      (p.timeOffRequests || []).map((r: any) => r.date).join(", "),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Format the Date column (A)
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  for (let R = 1; R <= range.e.r; ++R) {
    const cellRef = XLSX.utils.encode_cell({ c: 0, r: R });
    if (ws[cellRef] && ws[cellRef].t === 'd') {
      ws[cellRef].z = "mm/dd/yyyy";
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "NICU Schedule");

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const data = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(data, `NICU_Schedule_${startDate}.xlsx`);
};

export const importScheduleFromExcel = (file: File) => {
  return new Promise<void>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: "yyyy-mm-dd" }) as any[][];

        if (!aoa || aoa.length === 0) throw new Error("Empty spreadsheet");

        const store = useScheduleStore.getState();
        const providers = [...store.providers];

        const getOrCreateProviderId = (name: string | undefined | null) => {
          if (!name || typeof name !== "string") return null;
          const cleanName = name.trim();
          if (!cleanName || cleanName === "Unassigned" || cleanName.startsWith("N/A") || cleanName === "Open") {
            return null;
          }

          let p = providers.find((prov) => prov.name === cleanName);
          if (!p) {
            const newProvider: Provider = {
              id: crypto.randomUUID(),
              name: cleanName,
              targetWeekDays: 0,
              targetWeekendDays: 0,
              targetWeekNights: 0,
              targetWeekendNights: 0,
              timeOffRequests: [],
              preferredDates: [],
              skills: ["NEURO_CRITICAL"],
              maxConsecutiveNights: 2,
              minDaysOffAfterNight: 1,
            };
            p = newProvider;
            providers.push(p);
          }
          return p.id;
        };

        const newSlots = [...store.slots];

        // Search for rows that look like dates and map columns
        // Master format has Month on Row 0, actual dates starting later
        for (let rowIndex = 0; rowIndex < aoa.length; rowIndex++) {
          const row = aoa[rowIndex];
          if (!row || !row[0]) continue;

          let dateStr: string | null = null;

          // Try to parse the first column as a date
          try {
            const potentialDate = new Date(row[0]);
            if (!isNaN(potentialDate.getTime())) {
              // Make sure it wasn't just parsing a month string like "January"
              if (row[0].length > 8) {
                dateStr = format(potentialDate, "yyyy-MM-dd");
              }
            }
          } catch {
            // not a valid date, likely just the Month row or header row
          }

          // Special case: Sometimes dates are exported as pure strings YYYY-MM-DD
          if (!dateStr && typeof row[0] === 'string' && row[0].match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateStr = row[0];
          }

          if (dateStr) {
            // It's a valid date row. Map columns back to slots
            // Col 1: G20
            // Col 2: H22
            // Col 3: Akron
            // Col 4: Nights
            // Col 5: Consults
            // Col 6: AMET
            // Col 7: Jeopardy
            // Col 8: Recovery
            // Col 9: Vacations

            const assignments = [
              { col: 1, type: "DAY", loc: "G20" },
              { col: 2, type: "DAY", loc: "H22" },
              { col: 3, type: "DAY", loc: "Akron" },
              { col: 4, type: "NIGHT", loc: "Main Campus" },
              { col: 5, type: "CONSULTS", loc: "Main Campus" },
              { col: 6, type: "NMET", loc: "Main Campus" },
              { col: 7, type: "JEOPARDY", loc: "Main Campus" },
              { col: 8, type: "RECOVERY", loc: "Main Campus" },
              { col: 9, type: "VACATION", loc: "Any" },
            ];

            assignments.forEach(assign => {
              const cellVal = row[assign.col];
              if (cellVal) {
                // Handle split shifts like "Bates & Hassett"
                const providerNames = cellVal.toString().split("&").map((s: string) => s.trim());

                providerNames.forEach((name: string) => {
                  const providerId = getOrCreateProviderId(name);
                  if (providerId) {
                    // Find matching slot for this date/type/location
                    const matchingSlot = newSlots.find(
                      (s) => s.date === dateStr && s.type === assign.type && (s.location === assign.loc || s.location.includes(assign.loc))
                    );

                    if (matchingSlot) {
                      matchingSlot.providerId = providerId;
                    }
                  }
                });
              }
            });
          }
        }

        useScheduleStore.setState({ providers, slots: newSlots });
        resolve();
      } catch (err) {
        console.error(err);
        reject(err);
      }
    };

    reader.readAsBinaryString(file);
  });
};
