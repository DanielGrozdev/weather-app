type LegendConfig = {
  label: string;
  min: string;
  max: string;
  gradient: string;
};

export const legendConfigMap: Record<string, LegendConfig> = {
  precipitation_new: {
    label: "Precipitation",
    min: "0 mm/h",
    max: "40 mm/h",
    gradient:
      "linear-gradient(to right, rgba(225,200,100,0) 0%, rgba(150,150,170,0.2) 20%, rgba(120,120,190,0.4) 40%, rgba(90,90,210,0.6) 60%, rgba(60,60,230,0.85) 80%, rgba(20,20,255,1) 100%)",
  },

  temp_new: {
    label: "Temperature",
    min: "-65 °C",
    max: "30 °C",
    gradient:
      "linear-gradient(to right, rgb(66, 21, 92), rgb(66, 21, 92), rgb(97, 32, 133), rgb(172, 52, 237), rgb(70, 30, 138), rgb(37, 99, 235), rgb(59, 130, 246), rgb(96, 165, 250), rgb(135, 206, 235), rgb(43, 130, 85), rgb(87, 138, 48), rgb(247, 216, 10), rgb(255, 189, 8), rgb(255, 148, 8), rgb(201, 73, 4), rgb(196, 46, 8), rgb(135, 23, 3), rgb(77, 15, 0), rgb(77, 15, 0))",
  },

  clouds_new: {
    label: "Clouds",
    min: "0 %",
    max: "100 %",
    gradient:
      "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(245,245,255,0.25) 20%, rgba(235,235,255,0.5) 40%, rgba(225,225,255,0.75) 60%, rgba(215,215,255,0.9) 80%, rgba(200,200,255,1) 100%)",
  },

  pressure_new: {
    label: "Pressure",
    min: "90000 Pa",
    max: "104000 Pa",
    gradient:
      "linear-gradient(to right, rgba(0,115,255,1) 0%, rgba(75,208,214,1) 25%, rgba(141,231,199,1) 50%, rgba(240,184,0,1) 70%, rgba(251,85,21,1) 85%, rgba(198,0,0,1) 100%)",
  },

  wind_new: {
    label: "Wind speed",
    min: "0 m/s",
    max: "29 m/s",
    gradient:
      "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(180,120,200,0.25) 15%, rgba(120,80,160,0.5) 30%, rgba(70,40,120,0.75) 55%, rgba(30,20,80,0.9) 80%, rgba(10,10,40,1) 100%)",
  },
};
