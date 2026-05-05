import type { Dispatch, SetStateAction } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

type Props = {
  location: string;
  setLocation: Dispatch<SetStateAction<string>>;
};

export default function LocationDropdown({ location, setLocation }: Props) {
  return (
    <Select
      value={location}
      onValueChange={(value) => {
        setLocation(value);
      }}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="City" />
      </SelectTrigger>
      <SelectContent className="z-1001">
        <SelectGroup>
          {location === "custom" && (
            <SelectItem value="custom">Custom</SelectItem>
          )}

          {locations.map((city) => (
            <SelectItem value={city} key={city}>
              {city}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

const locations = [
  "New York City",
  "London",
  "Paris",
  "Tokyo",
  "Dubai",
  "Rome",
  "Barcelona",
  "Sydney",
  "Istanbul",
  "Singapore",
  "Varna",
];
