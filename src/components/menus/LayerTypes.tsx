import type { Dispatch, SetStateAction } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  mapType: string;
  setMapType: Dispatch<SetStateAction<string>>;
};

export default function LayerTypes({ mapType, setMapType }: Props) {
  return (
    <Tabs value={mapType} onValueChange={setMapType}>
      <TabsList>
        {types.map((type) => (
          <TabsTrigger
            key={type}
            value={type}
            className="capitalize data-[state=active]:text-accent! data-[state=active]:bg-primary!"
          >
            {type.split("_")[0]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

const types = [
  "clouds_new",
  "precipitation_new",
  "pressure_new",
  "wind_new",
  "temp_new",
];
