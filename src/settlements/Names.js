const GIVEN = ["Aldric", "Bren", "Cora", "Dessa", "Edrin", "Fenna", "Garrik", "Hale", "Isolde", "Jorun", "Kessa", "Lorn", "Maren", "Nils", "Odessa", "Pavel", "Quill", "Rhea", "Soren", "Tamsin", "Ulric", "Vesna", "Wyn", "Yara", "Zeb", "Anselm", "Brisa", "Corvin", "Dara", "Eskil", "Greta", "Halvar", "Ilsa", "Joss", "Kira", "Lukas", "Mira", "Nora", "Osric", "Petra", "Rurik", "Sasha", "Thom", "Una", "Viktor", "Wren", "Ysolde", "Marek", "Hanna", "Tobias"];
const FAMILY = ["Ashdown", "Brack", "Cole", "Dray", "Emmer", "Fallow", "Garrow", "Holt", "Iven", "Kest", "Lund", "Marsh", "Nettle", "Orrin", "Pike", "Quarry", "Rook", "Stave", "Thorn", "Voss", "Weld", "Yarrow", "Cinder", "Dunmore", "Flint"];
export const SETTLEMENT_NAMES = ["Ashhaven", "Cinderfall", "Dunmere", "Greywater", "Harrow's Rest", "Ironbrook", "Kestrel Hollow", "Larkspur", "Mossgate", "Northwatch", "Oakreach", "Pale Ford", "Quarrystead", "Redfurrow", "Stonehelm", "Thornwick", "Underhill", "Vesper Cross", "Wolfsrun", "Yewdale"];

export function personName(random) {
  return `${GIVEN[Math.floor(random() * GIVEN.length)]} ${FAMILY[Math.floor(random() * FAMILY.length)]}`;
}
export function placeName(random, taken = []) {
  const free = SETTLEMENT_NAMES.filter(name => !taken.includes(name));
  const pool = free.length ? free : SETTLEMENT_NAMES;
  return pool[Math.floor(random() * pool.length)];
}
