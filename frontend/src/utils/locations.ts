export interface GeoLocation {
  name: string;
  lat: number;
  lng: number;
  aliases?: string[];
  type?: "country" | "city" | "region";
}

// Approximate representative coordinates for map navigation, not event coordinates.
export const locations: GeoLocation[] = [
  // Southeast Asia
  { name: "Singapore", lat: 1.3521, lng: 103.8198, type: "country" },
  { name: "Malaysia", lat: 4.2105, lng: 101.9758, type: "country" },
  { name: "Indonesia", lat: -0.7893, lng: 113.9213, type: "country" },
  { name: "Thailand", lat: 15.87, lng: 100.9925, type: "country" },
  { name: "Vietnam", lat: 14.0583, lng: 108.2772, type: "country" },
  { name: "Philippines", lat: 12.8797, lng: 121.774, type: "country" },
  { name: "Myanmar", lat: 21.9162, lng: 95.956, type: "country", aliases: ["Burma"] },
  { name: "Cambodia", lat: 12.5657, lng: 104.991, type: "country" },
  { name: "Laos", lat: 19.8563, lng: 102.4955, type: "country" },
  { name: "Brunei", lat: 4.5353, lng: 114.7277, type: "country" },
  { name: "Timor-Leste", lat: -8.8742, lng: 125.7275, type: "country", aliases: ["East Timor"] },

  // East Asia
  { name: "China", lat: 35.8617, lng: 104.1954, type: "country", aliases: ["PRC"] },
  { name: "Japan", lat: 36.2048, lng: 138.2529, type: "country" },
  { name: "South Korea", lat: 35.9078, lng: 127.7669, type: "country" },
  { name: "North Korea", lat: 40.3399, lng: 127.5101, type: "country", aliases: ["DPRK"] },
  { name: "Taiwan", lat: 23.6978, lng: 120.9605, type: "country" },
  { name: "Mongolia", lat: 46.8625, lng: 103.8467, type: "country" },
  { name: "Hong Kong", lat: 22.3193, lng: 114.1694, type: "region" },

  // South Asia
  { name: "India", lat: 20.5937, lng: 78.9629, type: "country" },
  { name: "Pakistan", lat: 30.3753, lng: 69.3451, type: "country" },
  { name: "Bangladesh", lat: 23.685, lng: 90.3563, type: "country" },
  { name: "Sri Lanka", lat: 7.8731, lng: 80.7718, type: "country" },
  { name: "Nepal", lat: 28.3949, lng: 84.124, type: "country" },
  { name: "Bhutan", lat: 27.5142, lng: 90.4336, type: "country" },
  { name: "Maldives", lat: 3.2028, lng: 73.2207, type: "country" },
  { name: "Afghanistan", lat: 33.9391, lng: 67.71, type: "country" },

  // Middle East
  { name: "Israel", lat: 31.0461, lng: 34.8516, type: "country" },
  { name: "Palestine", lat: 31.9522, lng: 35.2332, type: "region", aliases: ["Palestinian territories"] },
  { name: "Gaza", lat: 31.3547, lng: 34.3088, type: "region", aliases: ["Gaza Strip"] },
  { name: "Iran", lat: 32.4279, lng: 53.688, type: "country" },
  { name: "Iraq", lat: 33.2232, lng: 43.6793, type: "country" },
  { name: "Saudi Arabia", lat: 23.8859, lng: 45.0792, type: "country" },
  { name: "United Arab Emirates", lat: 23.4241, lng: 53.8478, type: "country", aliases: ["UAE"] },
  { name: "Qatar", lat: 25.3548, lng: 51.1839, type: "country" },
  { name: "Kuwait", lat: 29.3117, lng: 47.4818, type: "country" },
  { name: "Bahrain", lat: 26.0667, lng: 50.5577, type: "country" },
  { name: "Oman", lat: 21.4735, lng: 55.9754, type: "country" },
  { name: "Yemen", lat: 15.5527, lng: 48.5164, type: "country" },
  { name: "Syria", lat: 34.8021, lng: 38.9968, type: "country" },
  { name: "Lebanon", lat: 33.8547, lng: 35.8623, type: "country" },
  { name: "Jordan", lat: 30.5852, lng: 36.2384, type: "country" },
  { name: "Turkey", lat: 38.9637, lng: 35.2433, type: "country", aliases: ["Türkiye", "Turkiye"] },

  // Europe
  { name: "Ukraine", lat: 48.3794, lng: 31.1656, type: "country" },
  { name: "Russia", lat: 61.524, lng: 105.3188, type: "country" },
  { name: "United Kingdom", lat: 55.3781, lng: -3.436, type: "country", aliases: ["UK", "U.K.", "Britain", "British"] },
  { name: "France", lat: 46.6034, lng: 1.8883, type: "country" },
  { name: "Germany", lat: 51.1657, lng: 10.4515, type: "country" },
  { name: "Italy", lat: 41.8719, lng: 12.5674, type: "country" },
  { name: "Spain", lat: 40.4637, lng: -3.7492, type: "country" },
  { name: "Portugal", lat: 39.3999, lng: -8.2245, type: "country" },
  { name: "Netherlands", lat: 52.1326, lng: 5.2913, type: "country" },
  { name: "Belgium", lat: 50.5039, lng: 4.4699, type: "country" },
  { name: "Switzerland", lat: 46.8182, lng: 8.2275, type: "country" },
  { name: "Austria", lat: 47.5162, lng: 14.5501, type: "country" },
  { name: "Poland", lat: 51.9194, lng: 19.1451, type: "country" },
  { name: "Czech Republic", lat: 49.8175, lng: 15.473, type: "country", aliases: ["Czechia"] },
  { name: "Slovakia", lat: 48.669, lng: 19.699, type: "country" },
  { name: "Hungary", lat: 47.1625, lng: 19.5033, type: "country" },
  { name: "Romania", lat: 45.9432, lng: 24.9668, type: "country" },
  { name: "Bulgaria", lat: 42.7339, lng: 25.4858, type: "country" },
  { name: "Greece", lat: 39.0742, lng: 21.8243, type: "country" },
  { name: "Serbia", lat: 44.0165, lng: 21.0059, type: "country" },
  { name: "Croatia", lat: 45.1, lng: 15.2, type: "country" },
  { name: "Bosnia and Herzegovina", lat: 43.9159, lng: 17.6791, type: "country" },
  { name: "Albania", lat: 41.1533, lng: 20.1683, type: "country" },
  { name: "Kosovo", lat: 42.6026, lng: 20.903, type: "region" },
  { name: "North Macedonia", lat: 41.6086, lng: 21.7453, type: "country" },
  { name: "Montenegro", lat: 42.7087, lng: 19.3744, type: "country" },
  { name: "Slovenia", lat: 46.1512, lng: 14.9955, type: "country" },
  { name: "Denmark", lat: 56.2639, lng: 9.5018, type: "country" },
  { name: "Sweden", lat: 60.1282, lng: 18.6435, type: "country" },
  { name: "Norway", lat: 60.472, lng: 8.4689, type: "country" },
  { name: "Finland", lat: 61.9241, lng: 25.7482, type: "country" },
  { name: "Iceland", lat: 64.9631, lng: -19.0208, type: "country" },
  { name: "Ireland", lat: 53.1424, lng: -7.6921, type: "country" },
  { name: "Estonia", lat: 58.5953, lng: 25.0136, type: "country" },
  { name: "Latvia", lat: 56.8796, lng: 24.6032, type: "country" },
  { name: "Lithuania", lat: 55.1694, lng: 23.8813, type: "country" },
  { name: "Belarus", lat: 53.7098, lng: 27.9534, type: "country" },
  { name: "Moldova", lat: 47.4116, lng: 28.3699, type: "country" },

  // North and Central America
  { name: "United States", lat: 39.8283, lng: -98.5795, type: "country", aliases: ["USA", "U.S.", "US", "America"] },
  { name: "Canada", lat: 56.1304, lng: -106.3468, type: "country" },
  { name: "Mexico", lat: 23.6345, lng: -102.5528, type: "country" },
  { name: "Cuba", lat: 21.5218, lng: -77.7812, type: "country" },
  { name: "Haiti", lat: 18.9712, lng: -72.2852, type: "country" },
  { name: "Dominican Republic", lat: 18.7357, lng: -70.1627, type: "country" },
  { name: "Jamaica", lat: 18.1096, lng: -77.2975, type: "country" },
  { name: "Panama", lat: 8.538, lng: -80.7821, type: "country" },
  { name: "Costa Rica", lat: 9.7489, lng: -83.7534, type: "country" },
  { name: "Guatemala", lat: 15.7835, lng: -90.2308, type: "country" },
  { name: "Honduras", lat: 15.2, lng: -86.2419, type: "country" },
  { name: "El Salvador", lat: 13.7942, lng: -88.8965, type: "country" },
  { name: "Nicaragua", lat: 12.8654, lng: -85.2072, type: "country" },

  // South America
  { name: "Brazil", lat: -14.235, lng: -51.9253, type: "country" },
  { name: "Argentina", lat: -38.4161, lng: -63.6167, type: "country" },
  { name: "Chile", lat: -35.6751, lng: -71.543, type: "country" },
  { name: "Colombia", lat: 4.5709, lng: -74.2973, type: "country" },
  { name: "Venezuela", lat: 6.4238, lng: -66.5897, type: "country" },
  { name: "Peru", lat: -9.19, lng: -75.0152, type: "country" },
  { name: "Ecuador", lat: -1.8312, lng: -78.1834, type: "country" },
  { name: "Bolivia", lat: -16.2902, lng: -63.5887, type: "country" },
  { name: "Paraguay", lat: -23.4425, lng: -58.4438, type: "country" },
  { name: "Uruguay", lat: -32.5228, lng: -55.7658, type: "country" },
  { name: "Guyana", lat: 4.8604, lng: -58.9302, type: "country" },
  { name: "Suriname", lat: 3.9193, lng: -56.0278, type: "country" },

  // Africa
  { name: "South Africa", lat: -30.5595, lng: 22.9375, type: "country" },
  { name: "Nigeria", lat: 9.082, lng: 8.6753, type: "country" },
  { name: "Egypt", lat: 26.8206, lng: 30.8025, type: "country" },
  { name: "Kenya", lat: -0.0236, lng: 37.9062, type: "country" },
  { name: "Ethiopia", lat: 9.145, lng: 40.4897, type: "country" },
  { name: "Sudan", lat: 12.8628, lng: 30.2176, type: "country" },
  { name: "South Sudan", lat: 6.877, lng: 31.307, type: "country" },
  { name: "Somalia", lat: 5.1521, lng: 46.1996, type: "country" },
  { name: "Libya", lat: 26.3351, lng: 17.2283, type: "country" },
  { name: "Tunisia", lat: 33.8869, lng: 9.5375, type: "country" },
  { name: "Algeria", lat: 28.0339, lng: 1.6596, type: "country" },
  { name: "Morocco", lat: 31.7917, lng: -7.0926, type: "country" },
  { name: "Ghana", lat: 7.9465, lng: -1.0232, type: "country" },
  { name: "Uganda", lat: 1.3733, lng: 32.2903, type: "country" },
  { name: "Tanzania", lat: -6.369, lng: 34.8888, type: "country" },
  { name: "Rwanda", lat: -1.9403, lng: 29.8739, type: "country" },
  { name: "Democratic Republic of the Congo", lat: -4.0383, lng: 21.7587, type: "country", aliases: ["DR Congo", "DRC"] },
  { name: "Republic of the Congo", lat: -0.228, lng: 15.8277, type: "country", aliases: ["Congo-Brazzaville"] },
  { name: "Cameroon", lat: 7.3697, lng: 12.3547, type: "country" },
  { name: "Senegal", lat: 14.4974, lng: -14.4524, type: "country" },
  { name: "Mali", lat: 17.5707, lng: -3.9962, type: "country" },
  { name: "Niger", lat: 17.6078, lng: 8.0817, type: "country" },
  { name: "Burkina Faso", lat: 12.2383, lng: -1.5616, type: "country" },
  { name: "Chad", lat: 15.4542, lng: 18.7322, type: "country" },
  { name: "Zimbabwe", lat: -19.0154, lng: 29.1549, type: "country" },
  { name: "Zambia", lat: -13.1339, lng: 27.8493, type: "country" },
  { name: "Mozambique", lat: -18.6657, lng: 35.5296, type: "country" },
  { name: "Angola", lat: -11.2027, lng: 17.8739, type: "country" },

  // Oceania
  { name: "Australia", lat: -25.2744, lng: 133.7751, type: "country" },
  { name: "New Zealand", lat: -40.9006, lng: 174.886, type: "country" },
  { name: "Papua New Guinea", lat: -6.3149, lng: 143.9555, type: "country" },
  { name: "Fiji", lat: -17.7134, lng: 178.065, type: "country" },
  { name: "Solomon Islands", lat: -9.6457, lng: 160.1562, type: "country" },

  // Strategic regions and hotspots
  { name: "South China Sea", lat: 12, lng: 114, type: "region" },
  { name: "Taiwan Strait", lat: 24, lng: 119.5, type: "region" },
  { name: "Strait of Hormuz", lat: 26.5, lng: 56.3, type: "region" },
  { name: "Red Sea", lat: 20, lng: 38, type: "region" },
  { name: "Black Sea", lat: 43, lng: 35, type: "region" },
  { name: "Suez Canal", lat: 30.5, lng: 32.3, type: "region" },
  { name: "Panama Canal", lat: 9.1, lng: -79.7, type: "region" },
  { name: "Crimea", lat: 45.3, lng: 34.4, type: "region" },
  { name: "Donbas", lat: 48, lng: 38, type: "region", aliases: ["Donbass"] },
  { name: "West Bank", lat: 31.9, lng: 35.2, type: "region" },
  { name: "Kashmir", lat: 34, lng: 76, type: "region" },
  { name: "Arctic", lat: 85, lng: 0, type: "region" },

  // Major cities
  { name: "Washington DC", lat: 38.9072, lng: -77.0369, type: "city", aliases: ["Washington D.C.", "Washington, DC"] },
  { name: "New York", lat: 40.7128, lng: -74.006, type: "city" },
  { name: "London", lat: 51.5074, lng: -0.1278, type: "city" },
  { name: "Paris", lat: 48.8566, lng: 2.3522, type: "city" },
  { name: "Berlin", lat: 52.52, lng: 13.405, type: "city" },
  { name: "Moscow", lat: 55.7558, lng: 37.6173, type: "city" },
  { name: "Kyiv", lat: 50.4501, lng: 30.5234, type: "city", aliases: ["Kiev"] },
  { name: "Beijing", lat: 39.9042, lng: 116.4074, type: "city" },
  { name: "Shanghai", lat: 31.2304, lng: 121.4737, type: "city" },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503, type: "city" },
  { name: "Seoul", lat: 37.5665, lng: 126.978, type: "city" },
  { name: "Pyongyang", lat: 39.0392, lng: 125.7625, type: "city" },
  { name: "Taipei", lat: 25.033, lng: 121.5654, type: "city" },
  { name: "Bangkok", lat: 13.7563, lng: 100.5018, type: "city" },
  { name: "Jakarta", lat: -6.2088, lng: 106.8456, type: "city" },
  { name: "Manila", lat: 14.5995, lng: 120.9842, type: "city" },
  { name: "Hanoi", lat: 21.0278, lng: 105.8342, type: "city" },
  { name: "Kuala Lumpur", lat: 3.139, lng: 101.6869, type: "city" },
  { name: "New Delhi", lat: 28.6139, lng: 77.209, type: "city" },
  { name: "Islamabad", lat: 33.6844, lng: 73.0479, type: "city" },
  { name: "Jerusalem", lat: 31.7683, lng: 35.2137, type: "city" },
  { name: "Tehran", lat: 35.6892, lng: 51.389, type: "city" },
  { name: "Riyadh", lat: 24.7136, lng: 46.6753, type: "city" },
  { name: "Dubai", lat: 25.2048, lng: 55.2708, type: "city" },
  { name: "Doha", lat: 25.2854, lng: 51.531, type: "city" },
  { name: "Ankara", lat: 39.9334, lng: 32.8597, type: "city" },
  { name: "Istanbul", lat: 41.0082, lng: 28.9784, type: "city" },
  { name: "Brussels", lat: 50.8503, lng: 4.3517, type: "city" },
  { name: "Geneva", lat: 46.2044, lng: 6.1432, type: "city" },
  { name: "Rome", lat: 41.9028, lng: 12.4964, type: "city" },
  { name: "Cairo", lat: 30.0444, lng: 31.2357, type: "city" },
  { name: "Nairobi", lat: -1.2921, lng: 36.8219, type: "city" },
  { name: "Johannesburg", lat: -26.2041, lng: 28.0473, type: "city" },
  { name: "Brasília", lat: -15.7975, lng: -47.8919, type: "city", aliases: ["Brasilia"] },
  { name: "Buenos Aires", lat: -34.6037, lng: -58.3816, type: "city" },
];

// Match whole words/phrases, so "US" does not match "Russia" or "status".
function matchesPhrase(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu");
  return regex.test(text);
}

export function findArticleLocations(title: string): GeoLocation[] {
  const matches = locations.filter((location) =>
    [location.name, ...(location.aliases ?? [])].some((name) =>
      matchesPhrase(title, name)
    )
  );

  const priority: Record<NonNullable<GeoLocation["type"]>, number> = {
    city: 3,
    region: 2,
    country: 1,
  };

  return matches.sort(
    (a, b) =>
      priority[b.type ?? "country"] - priority[a.type ?? "country"] ||
      b.name.length - a.name.length
  );
}

export function findArticleLocation(title: string): GeoLocation | null {
  return findArticleLocations(title)[0] ?? null;
}
