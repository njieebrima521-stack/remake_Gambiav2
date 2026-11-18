import { rpc } from "./db";
import type { MaterialTypeId } from "../material-types";
import type { PickupLocation } from "./locations";

export interface StreamInput {
  materialType: MaterialTypeId;
  bags: number;
}

export interface BookingInput {
  streams: StreamInput[];
  date: string; // yyyy-mm-dd
  slot: string;
  location: PickupLocation;
  notes: string;
  /** Confirmed scan attached to the booking, if any. */
  scanId: string | null;
  /** Resident confirmed the materials are physically separated (required when more than one stream). */
  separationConfirmed: boolean;
  clientRequestId: string;
}

export interface BookedStream {
  ref: string;
  materialType: MaterialTypeId;
  assignmentStatus: "unmatched" | "offered" | "assigned";
  institution: string | null;
  collector: string | null;
}

export interface BookingResult {
  bookingId: string;
  streams: BookedStream[];
}

type Row = {
  booking_id: string;
  ref: string;
  material_type: MaterialTypeId;
  assignment_status: BookedStream["assignmentStatus"];
  institution_name: string | null;
  collector_name: string | null;
};

/** One parent booking with one pickup per separated material stream; each stream is routed on the server. */
export async function bookPickupStreams(input: BookingInput): Promise<BookingResult> {
  const data = await rpc<Row[]>("book_pickup_streams", {
    _streams: input.streams.map((s) => ({ material_type: s.materialType, bags: s.bags })),
    _date: input.date,
    _slot: input.slot,
    _address: input.location.address,
    _area: input.location.area,
    _lat: input.location.lat,
    _lng: input.location.lng,
    _location_source: input.location.source,
    _notes: input.notes,
    _scan_id: input.scanId,
    _separation_confirmed: input.separationConfirmed,
    _client_request_id: input.clientRequestId,
  });
  return {
    bookingId: data[0]?.booking_id ?? "",
    streams: data.map((r) => ({
      ref: r.ref,
      materialType: r.material_type,
      assignmentStatus: r.assignment_status,
      institution: r.institution_name,
      collector: r.collector_name,
    })),
  };
}
