export type BookingBed = {
  id: string;
  label: string;
  price: number;
  status: "available" | "held" | "booked";
};

export type BookingRoom = {
  id: string;
  name: string;
  beds: BookingBed[];
};
