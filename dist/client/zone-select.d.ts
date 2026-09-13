/**
 * Time-zone picker shared by the settings card and the composer chip: a select
 * of common zones (plus the browser's own), with an escape hatch for any other
 * IANA name. Choosing a zone the schedule is NOT quoted in is the common case —
 * DeepSeek publishes peak hours in Beijing time, so a Moscow user needs the
 * conversion spelled out, which is why every option shows its live UTC offset.
 */
import type { ReactElement } from 'react';
export interface ZoneSelectProps {
    /** Current IANA zone. */
    value: string;
    /** Commit a new zone. */
    onChange: (zone: string) => void;
    /** Render read-only (memory-mode connections). */
    disabled?: boolean;
    /** Instant used for the offset column. */
    now: Date;
    /** Include the surrounding label row (the card wants it, the chip does not). */
    withLabel?: boolean;
}
/**
 * Render the picker.
 * @param props - current zone, commit callback, and render options.
 * @returns the control.
 */
export declare function ZoneSelect(props: ZoneSelectProps): ReactElement;
