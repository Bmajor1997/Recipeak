// Made by scripts/make_wall_photos.py from data/curated-photos. Do not edit by hand; run the script.

/** How many hand-picked cover photos the app has. */
export const CURATED_COUNT = 305;

/** One photo on the wall: the dish it shows, and the bundled picture. */
export type WallPhoto = { name: string; kind: "meal" | "cocktail"; source: number };

/** The two rows of photos on the Home screen's moving photo wall. */
export const WALL_ROWS: WallPhoto[][] = [
  [
    { name: "Ramen", kind: "meal", source: require("../../assets/wall/ramen.jpg") },
    { name: "Aperol Spritz", kind: "cocktail", source: require("../../assets/wall/aperol-spritz.jpg") },
    { name: "Chicken tikka masala", kind: "meal", source: require("../../assets/wall/chicken-tikka-masala.jpg") },
    { name: "Cosmopolitan", kind: "cocktail", source: require("../../assets/wall/cosmopolitan.jpg") },
    { name: "Pepperoni pizza", kind: "meal", source: require("../../assets/wall/pepperoni-pizza.jpg") },
    { name: "Mojito", kind: "cocktail", source: require("../../assets/wall/mojito.jpg") },
    { name: "Pho", kind: "meal", source: require("../../assets/wall/pho.jpg") },
    { name: "Negroni", kind: "cocktail", source: require("../../assets/wall/negroni.jpg") },
  ],
  [
    { name: "Old Fashioned", kind: "cocktail", source: require("../../assets/wall/old-fashioned.jpg") },
    { name: "Paella", kind: "meal", source: require("../../assets/wall/paella.jpg") },
    { name: "Margarita", kind: "cocktail", source: require("../../assets/wall/margarita.jpg") },
    { name: "Fish tacos", kind: "meal", source: require("../../assets/wall/fish-tacos.jpg") },
    { name: "Espresso Martini", kind: "cocktail", source: require("../../assets/wall/espresso-martini.jpg") },
    { name: "Lasagna", kind: "meal", source: require("../../assets/wall/lasagna.jpg") },
    { name: "Blue Hawaii", kind: "cocktail", source: require("../../assets/wall/blue-hawaii.jpg") },
    { name: "Shrimp scampi", kind: "meal", source: require("../../assets/wall/shrimp-scampi-pasta.jpg") },
  ],
];
