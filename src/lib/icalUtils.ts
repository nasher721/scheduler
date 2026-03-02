import { EventAttributes, createEvents } from "ics";
import { saveAs } from "file-saver";
import { parseISO } from "date-fns";
import { Provider, ShiftSlot } from "../store";

export const generateProviderICal = (provider: Provider, slots: ShiftSlot[]) => {
    const providerSlots = slots.filter((s) => s.providerId === provider.id);

    if (providerSlots.length === 0) {
        alert("No shifts assigned to this provider.");
        return;
    }

    const events: EventAttributes[] = providerSlots.map((slot) => {
        const date = parseISO(slot.date);
        const startObj = [date.getFullYear(), date.getMonth() + 1, date.getDate()];

        let title = "";
        let startParams: [number, number, number, number, number] = [...startObj, 8, 0] as [number, number, number, number, number];
        let endParams: [number, number, number, number, number] = [...startObj, 17, 0] as [number, number, number, number, number];

        if (slot.type === "DAY") {
            title = `Neuro ICU - Day Shift (${slot.requiredSkill})`;
            startParams = [...startObj, 7, 0] as [number, number, number, number, number];
            endParams = [...startObj, 19, 0] as [number, number, number, number, number];
        } else if (slot.type === "NIGHT") {
            title = `Neuro ICU - Night Shift (${slot.requiredSkill})`;
            startParams = [...startObj, 19, 0] as [number, number, number, number, number];

            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);
            const endObj = [endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate()];
            endParams = [...endObj, 7, 0] as [number, number, number, number, number];
        } else {
            title = `Neuro ICU - ${slot.type} (${slot.requiredSkill})`;
            // Defaults for NMET/JEOPARDY or other
            startParams = [...startObj, 8, 0] as [number, number, number, number, number];
            endParams = [...startObj, 17, 0] as [number, number, number, number, number];
        }

        return {
            title,
            start: startParams,
            end: endParams,
            description: `Shift ID: ${slot.id}`,
        };
    });

    const { error, value } = createEvents(events);

    if (error || !value) {
        console.error(error);
        alert("Failed to generate calendar file.");
        return;
    }

    const blob = new Blob([value], { type: "text/calendar;charset=utf-8" });
    saveAs(blob, `${provider.name.replace(/\s+/g, "_")}_schedule.ics`);
};
