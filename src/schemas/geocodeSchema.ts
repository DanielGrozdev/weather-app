import { z } from "zod";

const LocalNamesSchema = z
  .object({
    ascii: z.string().optional(),
    feature_name: z.string().optional(),
  })
  .catchall(z.string());

const LocationSchema = z.object({
  name: z.string(),
  local_names: LocalNamesSchema.optional(),
  lat: z.number(),
  lon: z.number(),
  country: z.string(),
  state: z.string().optional(),
});

// ✅ fix
export const GeocodeSchema = z.array(LocationSchema);
