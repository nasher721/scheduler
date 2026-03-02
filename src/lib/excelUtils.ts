/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { useScheduleStore } from "../store";

export const exportScheduleToExcel = () => {
  const { slots, startDate, providers } = useScheduleStore.getState();

  // We want to create a grid:
  // Rows: specific shift slots (Day 1, Day 2, Day 3, NMET, Night, Jeopardy)
  // Columns: Dates across the schedule

  // Group slots by date
  const slotsByDate: Record<string, typeof slots> = {};
  slots.forEach((s: any) => {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = [];
    slotsByDate[s.date].push(s);
  });

  const dates = Object.keys(slotsByDate).sort();

  // Build the Header Row
  const header = ["Shift Type", ...dates];

  // Build Rows
  // The types to extract in order:
  const rowTypes = [
    { type: "DAY", label: "Day 1", index: 0 },
    { type: "DAY", label: "Day 2", index: 1 },
    { type: "DAY", label: "Day 3 (Wkday Only)", index: 2 },
    { type: "NMET", label: "NMET", index: 0 },
    { type: "NIGHT", label: "Night", index: 0 },
    { type: "JEOPARDY", label: "Jeopardy", index: 0 },
  ];

  const wsData: any[][] = [header];

  rowTypes.forEach((rt) => {
    const row = [rt.label];
    dates.forEach((date) => {
      const typeSlots = slotsByDate[date].filter((s: any) => s.type === rt.type);
      const slot = typeSlots[rt.index];
      if (slot) {
        const p = providers.find((prov: any) => prov.id === slot.providerId);
        row.push(p ? p.name : "Unassigned");
      } else {
        row.push("N/A (Weekend)");
      }
    });
    wsData.push(row);
  });

  // Add Provider Target Stats
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
      p.unavailableDates.join(", "),
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
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
        const wb = XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!aoa || aoa.length === 0) throw new Error("Empty spreadsheet");

        const store = useScheduleStore.getState();
        const dates = aoa[0].slice(1); // the headers

        // This is a naive import that assumes the exact format exported above
        // We will just create or match existing providers and set their names

        const providers = [...store.providers];
        const getOrCreateProviderId = (name: string) => {
          if (!name || name === "Unassigned" || name.startsWith("N/A"))
            return null;
          let p = providers.find((prov) => prov.name === name);
          if (!p) {
            p = {
              id: crypto.randomUUID(),
              name,
              targetWeekDays: 0,
              targetWeekendDays: 0,
              targetWeekNights: 0,
              targetWeekendNights: 0,
              unavailableDates: [],
              preferredDates: [],
              skills: ["NEURO_CRITICAL"],
              maxConsecutiveNights: 2,
              minDaysOffAfterNight: 1,
            };
            providers.push(p);
          }
          return p.id;
        };

        const newSlots = [...store.slots]; // start with current structure

        // Note: Real world we would parse dynamically or define strictly.
        // For artifact viability, we will do a targeted best effort parse over the known row index

        const rowMapping = [
          { rowIndex: 1, type: "DAY", shiftIndex: 0 },
          { rowIndex: 2, type: "DAY", shiftIndex: 1 },
          { rowIndex: 3, type: "DAY", shiftIndex: 2 },
          { rowIndex: 4, type: "NMET", shiftIndex: 0 },
          { rowIndex: 5, type: "NIGHT", shiftIndex: 0 },
          { rowIndex: 6, type: "JEOPARDY", shiftIndex: 0 },
        ];

        rowMapping.forEach((mapping) => {
          const row = aoa[mapping.rowIndex];
          if (row) {
            dates.forEach((dateStr, colIdx) => {
              const cellValue = row[colIdx + 1];
              const providerId = getOrCreateProviderId(cellValue);

              // Find slot in newSlots that matches date, type, and index
              const typeSlots = newSlots.filter(
                (s) => s.date === dateStr && s.type === mapping.type,
              );
              const matchingSlot = typeSlots[mapping.shiftIndex];

              if (matchingSlot) {
                matchingSlot.providerId = providerId;
              }
            });
          }
        });

        // Update the global store directly
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
