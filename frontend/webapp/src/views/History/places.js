/** @format */
// The New York / Pennsylvania places of the 1820s, in the order Vogel's Early
// Mormon Documents arranges them. Unknown metadata.place values collect under
// "Other" at the end of the archive.
export const JSNY_PLACES = [
  { key: "palmyra-manchester", title: "Palmyra & Manchester, New York", blurb: "The Smith farm, the neighbours, the hills, and the Grandin press." },
  { key: "colesville-bainbridge", title: "Colesville & South Bainbridge, New York", blurb: "The Stowell and Knight circles, and the 1826 Bainbridge court record." },
  { key: "harmony", title: "Harmony, Pennsylvania", blurb: "The Hale family, and the bulk of the translation." },
  { key: "fayette", title: "Fayette, New York", blurb: "The Whitmer farm, the close of the translation, and April 1830." },
];

export const placeOrder = (key) => {
  const i = JSNY_PLACES.findIndex((p) => p.key === key);
  return i === -1 ? JSNY_PLACES.length : i;
};

export const getPlace = (key) => JSNY_PLACES.find((p) => p.key === key) || null;
