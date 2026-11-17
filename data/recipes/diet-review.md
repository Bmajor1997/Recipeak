# Diet options: items that need a person to check

Made from the audit in `apps/mobile/tests/dietAudit.test.ts` (rules in `apps/mobile/src/recipes/diets.ts`, hand decisions in `apps/mobile/src/recipes/dietReview.json`).
Until an item here is checked, the app shows **neither** an "Already …" label **nor** a "Make it …" option for that diet.
To settle one, add a decision for it to `dietReview.json` (`fits`, `option` or `none`, with the reason).

## Totals

Options shown before: 3037 (every diet on every recipe). After: 821.

| Diet          | Already fits | Option | Can't be adapted | Needs review |
| ------------- | ------------ | ------ | ---------------- | ------------ |
| vegetarian    | 294          | 76     | 95               | 0            |
| vegan         | 149          | 136    | 110              | 70           |
| gluten-free   | 321          | 132    | 0                | 12           |
| dairy-free    | 336          | 104    | 9                | 16           |
| nut-free      | 421          | 17     | 21               | 6            |
| low-carb      | 23           | 109    | 333              | 0            |
| non-alcoholic | 0            | 247    | 0                | 0            |

## Rules used

- Decided from each recipe's ingredients and garnish, never its name alone. An ingredient line's "X or Y" counts as fitting when Y is a real substitute ("butter or oil").
- An option is offered only when something must change. It is not offered when what breaks the diet is the heart of the dish: named in the title ("Beef Pho", "Cheese Omelet") or marked by hand in `dietReview.json` (ceviche, piña colada, fesenjan…).
- Low-carb (your choice): already low-carb with no grains, bread, pasta, rice, potatoes, corn, beans, sugar, syrup, juice or sweet liqueur. Offered when the carbs are sugar, a sauce thickener, a coating or a side; not when a starch or batter is the dish, or a liqueur or juice carries a drink.
- Nut-free (your choice): peanuts, tree nuts and coconut all count.
- Gluten: distilled spirits (whisky, vodka) and ginger beer count as gluten-free; beer, soy sauce, malt vinegar and wheat products don't.
- Non-alcoholic: offered only for alcoholic drinks (every drink in the collection is alcoholic).
- Labels and options are recipe checks, not allergy guarantees: they don't cover cross-contact.

## Vegan (70)

- **Adonis**: check "fino sherry", "sweet vermouth"
- **Americano**: check "sweet vermouth"
- **Aperol Spritz**: check "dry prosecco, well chilled"
- **Bamboo**: check "fino or amontillado sherry", "dry vermouth"
- **Barracuda**: check "Prosecco, chilled"
- **Bellini**: check "prosecco"
- **Betsy Ross**: check "ruby port"
- **Bijou**: check "sweet vermouth"
- **Bitter Giuseppe**: check "sweet vermouth"
- **Black Velvet**: check "Guinness or stout", "Champagne"
- **Blackthorn**: check "sweet vermouth"
- **Blood and Sand**: check "sweet vermouth"
- **Bloodhound**: check "dry vermouth", "sweet vermouth"
- **Bobby Burns**: check "sweet vermouth"
- **Boulevardier**: check "sweet vermouth"
- **Brooklyn**: check "dry vermouth"
- **Champagne Cocktail**: check "Champagne"
- **Chicago Cocktail**: check "Champagne"
- **Chrysanthemum**: check "dry vermouth"
- **Corpse Reviver No. 2**: check "Lillet Blanc"
- **Death in the Afternoon**: check "cold Champagne"
- **Derby**: check "sweet vermouth"
- **Dry Gin Martini**: check "dry vermouth"
- **Dry Manhattan**: check "dry vermouth"
- **Dubliner**: check "sweet vermouth"
- **El Presidente**: check "blanc vermouth"
- **Fanciulli**: check "sweet vermouth"
- **French 75**: check "Champagne"
- **Fried Spring Rolls**: check "spring roll wrappers"
- **Greenpoint**: check "sweet vermouth"
- **Hanky Panky**: check "sweet vermouth"
- **Hugo Spritz**: check "prosecco"
- **Income Tax**: check "sweet vermouth", "dry vermouth"
- **Jabberwock**: check "manzanilla or fino sherry", "Lillet Blanc"
- **Kir**: check "dry white wine (traditionally Bourgogne Aligoté), well chilled"
- **Kir Royale**: check "Champagne"
- **La Louisiane**: check "sweet vermouth"
- **La Perla**: check "manzanilla sherry"
- **Left Hand**: check "sweet vermouth"
- **London Calling**: check "fino sherry"
- **Lucien Gaudin**: check "dry vermouth"
- **Man O' War**: check "sweet vermouth"
- **Manhattan**: check "sweet vermouth"
- **Martinez**: check "sweet vermouth"
- **Mezcal Negroni**: check "sweet vermouth"
- **Mimosa**: check "Champagne or sparkling wine"
- **Negroni**: check "sweet vermouth (such as Carpano Antica or Cocchi di Torino)"
- **New York Sour**: check "dry red wine"
- **Old Pal**: check "dry vermouth"
- **Passion Fruit Martini**: check "prosecco, on the side"
- **Perfect Manhattan**: check "sweet vermouth", "dry vermouth"
- **Poet's Dream**: check "dry vermouth"
- **Queen Elizabeth**: check "sweet vermouth"
- **Remember the Maine**: check "sweet vermouth"
- **Rob Roy**: check "sweet vermouth"
- **Saratoga**: check "sweet vermouth"
- **Scofflaw**: check "dry vermouth"
- **Seelbach**: check "Champagne"
- **Shamrock**: check "dry vermouth"
- **Sherry Cobbler**: check "amontillado sherry"
- **Sherry Sangaree**: check "oloroso sherry"
- **Spaghett**: check "light lager (such as Miller High Life), ice-cold"
- **St-Germain Cocktail**: check "dry sparkling wine, chilled"
- **The Chancellor**: check "ruby port", "dry vermouth"
- **Tipperary**: check "sweet vermouth"
- **Trident**: check "fino sherry"
- **Tuxedo No. 2**: check "dry vermouth"
- **Vesper**: check "Lillet Blanc"
- **Vieux Carré**: check "sweet vermouth"
- **Zaza**: check "Dubonnet Rouge"

## Gluten-free (12)

- **Bloody Caesar**: check "Worcestershire sauce"
- **Bloody Mary**: check "Worcestershire sauce"
- **Brazilian Feijoada**: check "smoked sausage (linguiça), sliced"
- **Chicken Yassa**: check "stock cube"
- **Egusi Soup**: check "bouillon cubes"
- **Idli Sambar**: check "sambar powder"
- **Jambalaya**: check "andouille sausage, sliced"
- **Loaded Beef Nachos**: check "taco seasoning"
- **Mudslide**: check "chocolate syrup, for the glass"
- **Nigerian Goat Meat Pepper Soup**: check "stock cubes"
- **Nigerian Suya**: check "bouillon cube, crushed"
- **Thieboudienne**: check "bouillon cubes"

## Dairy-free (16)

- **Armenian Dolma**: the steps serve it with garlic yogurt, which isn't in the ingredient list
- **BLT Sandwich**: check "sandwich bread, toasted"
- **Beef Empanadas**: check "empanada dough rounds"
- **Bigos (Polish Hunter's Stew)**: check "rye bread or boiled potatoes, to serve"
- **Caldo Verde (Portuguese Kale Soup)**: check "black pepper and crusty cornbread (broa), to serve"
- **Choripán**: check "crusty rolls"
- **Katsudon**: check "panko breadcrumbs"
- **Lebanese Kibbeh**: the steps serve it with yogurt, which isn't in the ingredient list
- **Mole Poblano**: check "bread, torn", "Mexican chocolate"
- **Pork Banh Mi**: check "Vietnamese baguettes or soft French rolls"
- **Pork Katsu**: check "panko breadcrumbs"
- **Pork Schnitzel**: check "fine dry breadcrumbs"
- **Pulled Pork Sandwich**: check "soft buns"
- **Sauerbraten**: check "gingersnap cookies, crushed"
- **Sri Lankan Kottu Roti**: check "paratha or roti, cut into thin strips"
- **Turkey Club Sandwich**: check "sandwich bread, toasted"

## Nut-free (6)

- **Alabama Slammer**: check "amaretto"
- **Amaretto Sour**: check "amaretto"
- **French Connection**: check "amaretto"
- **Godfather**: check "amaretto"
- **Idli Sambar**: the steps serve it with coconut chutney, which isn't in the ingredient list
- **Pink Squirrel**: check "crème de noyaux"
