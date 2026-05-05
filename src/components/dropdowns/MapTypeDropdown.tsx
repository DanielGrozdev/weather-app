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
  mapType: string;
  setMapType: Dispatch<SetStateAction<string>>;
};

export default function MapTypeDropdown({ mapType, setMapType }: Props) {
  return (
    <Select
      value={mapType}
      onValueChange={(value) => {
        setMapType(value);
      }}
    >
      <SelectTrigger className="w-[180px] capitalize">
        <SelectValue placeholder="City" />
      </SelectTrigger>
      <SelectContent className="z-1001">
        <SelectGroup>
          {types.map((type) => (
            <SelectItem value={type} key={type} className="capitalize">
              {type.split("_")[0]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

const types = [
  "clouds_new",
  "precipitation_new",
  "pressure_new",
  "wind_new",
  "temp_new",
];
