import { useEffect, useMemo, useState } from "react";
import "./app.css";

/* ======================
   Dex tabs
====================== */
const DEXES = [
  { key: "national", label: "National" },
  { key: "kanto", label: "Kanto" },
  { key: "original-johto", label: "Johto" },
  { key: "hoenn", label: "Hoenn" },
  { key: "original-sinnoh", label: "Sinnoh" },
  { key: "original-unova", label: "Unova" },
  { key: "kalos-central", label: "Kalos" },
  { key: "updated-alola", label: "Alola" },
  { key: "galar", label: "Galar" },
  { key: "paldea", label: "Paldea" },
];

const pad3 = (n) => String(n).padStart(3, "0");
const CURRENT_GEN = 9;

/* ✅ more laptop-friendly icons */
const TYPE_ICON = {
  normal: "⬜",
  fire: "🔥",
  water: "💧",
  grass: "🌿",
  electric: "⚡",
  ice: "❄️",
  fighting: "🥊",
  poison: "☠️",
  ground: "⛰️",
  flying: "🕊️", // was 🪽 (not supported on some laptops)
  psychic: "🔮",
  bug: "🐞",
  rock: "🗿",   // was 🪨 (not supported on some laptops)
  ghost: "👻",
  dragon: "🐉",
  dark: "🌑",
  steel: "⚙️",
  fairy: "🧚",
};

const catIcon = (cat) =>
  cat === "physical" ? "⚔️" : cat === "special" ? "✨" : "⭕";

function titleCaseSlug(v) {
  if (!v) return "";
  return v
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function genderRateToText(rate) {
  if (rate === -1) return "Genderless";
  const female = (rate / 8) * 100;
  const male = 100 - female;
  return `${male.toFixed(1)}% ♂ / ${female.toFixed(1)}% ♀`;
}

function statColorClass(value) {
  if (value < 60) return "low";
  if (value < 100) return "mid";
  return "high";
}

function statPercent(value) {
  const pct = Math.round((value / 180) * 100);
  return Math.max(0, Math.min(100, pct));
}

/* ======================
   Theme (dark/light)
====================== */
function getInitialTheme() {
  const saved = localStorage.getItem("pdx-theme");
  if (saved === "light" || saved === "dark") return saved;
  return "dark";
}

/* ======================
   Version -> generation sorting cache (dex entry dropdown)
====================== */
const versionGenCache = new Map();
function genSlugToNumber(genSlug) {
  const roman = (genSlug || "").replace("generation-", "");
  const map = {
    i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9,
  };
  return map[roman] ?? 999;
}

async function getVersionGenNumber(versionName) {
  if (versionGenCache.has(versionName)) return versionGenCache.get(versionName);
  try {
    const vRes = await fetch(`https://pokeapi.co/api/v2/version/${versionName}`);
    const vData = await vRes.json();
    const vgName = vData?.version_group?.name;

    if (!vgName) {
      const fallback = { genNum: 999, versionGroup: "" };
      versionGenCache.set(versionName, fallback);
      return fallback;
    }

    const vgRes = await fetch(`https://pokeapi.co/api/v2/version-group/${vgName}`);
    const vgData = await vgRes.json();
    const genSlug = vgData?.generation?.name;
    const genNum = genSlugToNumber(genSlug);

    const meta = { genNum, versionGroup: vgName };
    versionGenCache.set(versionName, meta);
    return meta;
  } catch {
    const fallback = { genNum: 999, versionGroup: "" };
    versionGenCache.set(versionName, fallback);
    return fallback;
  }
}

/* ======================
   Version-group -> generation (for movepool filter)
====================== */
const versionGroupGenCache = new Map(); // versionGroupName -> genNum
async function getVersionGroupGenNumber(vgName) {
  if (!vgName) return 999;
  if (versionGroupGenCache.has(vgName)) return versionGroupGenCache.get(vgName);
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/version-group/${vgName}`);
    if (!res.ok) {
      versionGroupGenCache.set(vgName, 999);
      return 999;
    }
    const data = await res.json();
    const genSlug = data?.generation?.name;
    const genNum = genSlugToNumber(genSlug);
    versionGroupGenCache.set(vgName, genNum);
    return genNum;
  } catch {
    versionGroupGenCache.set(vgName, 999);
    return 999;
  }
}

/* ======================
   Evolution helpers
====================== */
function formatEvolutionDetail(d) {
  if (!d) return "";
  const parts = [];
  const trigger = d.trigger?.name;

  if (d.min_level != null) parts.push(`Level ${d.min_level}`);
  if (d.min_happiness != null) parts.push(`Friendship ${d.min_happiness}+`);
  if (d.min_affection != null) parts.push(`Affection ${d.min_affection}+`);
  if (d.min_beauty != null) parts.push(`Beauty ${d.min_beauty}+`);
  if (d.time_of_day) parts.push(`Time: ${titleCaseSlug(d.time_of_day)}`);
  if (d.location?.name) parts.push(`At ${titleCaseSlug(d.location.name)}`);
  if (d.known_move?.name) parts.push(`Knows ${titleCaseSlug(d.known_move.name)}`);
  if (d.known_move_type?.name) parts.push(`Knows a ${titleCaseSlug(d.known_move_type.name)} move`);
  if (d.held_item?.name) parts.push(`Hold ${titleCaseSlug(d.held_item.name)}`);
  if (d.party_species?.name) parts.push(`Party: ${titleCaseSlug(d.party_species.name)}`);
  if (d.party_type?.name) parts.push(`Party Type: ${titleCaseSlug(d.party_type.name)}`);
  if (d.trade_species?.name) parts.push(`Trade for ${titleCaseSlug(d.trade_species.name)}`);
  if (d.needs_overworld_rain) parts.push(`Overworld Rain`);
  if (d.turn_upside_down) parts.push(`Turn device upside down`);
  if (d.gender != null) parts.push(d.gender === 1 ? "Female" : d.gender === 2 ? "Male" : "");
  if (d.relative_physical_stats != null) {
    if (d.relative_physical_stats === 1) parts.push("Atk > Def");
    if (d.relative_physical_stats === 0) parts.push("Atk = Def");
    if (d.relative_physical_stats === -1) parts.push("Atk < Def");
  }
  if (d.item?.name) parts.push(`Use ${titleCaseSlug(d.item.name)}`);

  if (parts.length === 0 && trigger) {
    if (trigger === "trade") return "Trade";
    if (trigger === "use-item") return "Use Item";
    if (trigger === "level-up") return "Level Up";
    return titleCaseSlug(trigger);
  }

  return parts.filter(Boolean).join(" • ");
}

function collectEvolutionNodes(chainRoot) {
  const nodes = [];
  const edges = [];

  function walk(node) {
    const from = node?.species?.name || "";
    if (from && !nodes.includes(from)) nodes.push(from);

    for (const child of node.evolves_to || []) {
      const to = child?.species?.name || "";
      const how =
        (child.evolution_details || [])
          .map(formatEvolutionDetail)
          .filter(Boolean)
          .join(" / ") || "—";

      if (to && !nodes.includes(to)) nodes.push(to);
      edges.push({ from, to, how });
      walk(child);
    }
  }

  walk(chainRoot);
  return { nodes, edges };
}

/* ======================
   Variants / Forms grouping
====================== */
function isRegionalVariant(pokemonName) {
  return (
    pokemonName.includes("-alola") ||
    pokemonName.includes("-galar") ||
    pokemonName.includes("-hisui") ||
    pokemonName.includes("-paldea")
  );
}
function isMega(pokemonName) {
  return pokemonName.includes("-mega");
}
function isGmax(pokemonName) {
  return pokemonName.includes("-gmax");
}

function prettyLabel(baseName, pokemonName) {
  if (pokemonName === baseName) return "Base";

  let tail = pokemonName.startsWith(baseName + "-")
    ? pokemonName.slice(baseName.length + 1)
    : pokemonName;

  if (tail === "gmax") return "Gigantamax";
  if (tail === "mega") return "Mega";
  tail = tail.replace("mega-x", "Mega X").replace("mega-y", "Mega Y");

  return titleCaseSlug(tail);
}

/* ======================
   Regional auto-display for a Dex tab
====================== */
function regionSuffixForDex(dexKey) {
  if (dexKey.includes("alola")) return "alola";
  if (dexKey === "galar") return "galar";
  if (dexKey === "paldea") return "paldea";
  return null;
}

/* ======================
   Data caches
====================== */
const pokemonCache = new Map();
const pokemonExistsCache = new Map();
const speciesDefaultPokemonCache = new Map();
const spriteCache = new Map();

// Move caches
const moveCache = new Map();     // moveName -> move json
const moveMiniCache = new Map(); // moveName -> {type, dmgClass}

async function fetchJsonOrNull(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function pokemonExists(pokemonName) {
  if (pokemonExistsCache.has(pokemonName)) return pokemonExistsCache.get(pokemonName);
  const data = await fetchJsonOrNull(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
  const ok = !!data;
  pokemonExistsCache.set(pokemonName, ok);
  if (ok && !pokemonCache.has(pokemonName)) pokemonCache.set(pokemonName, data);
  return ok;
}

async function getDefaultPokemonNameFromSpecies(speciesName) {
  if (speciesDefaultPokemonCache.has(speciesName))
    return speciesDefaultPokemonCache.get(speciesName);

  const sData = await fetchJsonOrNull(`https://pokeapi.co/api/v2/pokemon-species/${speciesName}`);
  const def = sData?.varieties?.find((v) => v.is_default)?.pokemon?.name || speciesName;

  speciesDefaultPokemonCache.set(speciesName, def);
  return def;
}

async function getPokemonDataSmart(speciesName, dexKey) {
  const suffix = regionSuffixForDex(dexKey);
  const defaultPokemon = await getDefaultPokemonNameFromSpecies(speciesName);

  if (suffix) {
    const candidate = `${defaultPokemon}-${suffix}`;
    const ok = await pokemonExists(candidate);
    if (ok) return pokemonCache.get(candidate);
  }

  if (await pokemonExists(defaultPokemon)) return pokemonCache.get(defaultPokemon);
  if (await pokemonExists(speciesName)) return pokemonCache.get(speciesName);

  return null;
}

async function getSpriteForPokemonName(pokemonName, shiny) {
  const key = `${pokemonName}::${shiny ? "shiny" : "normal"}`;
  if (spriteCache.has(key)) return spriteCache.get(key);

  const data =
    pokemonCache.get(pokemonName) ||
    (await fetchJsonOrNull(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`));
  if (data) pokemonCache.set(pokemonName, data);

  const s =
    (shiny ? data?.sprites?.front_shiny : data?.sprites?.front_default) ||
    data?.sprites?.front_default ||
    "";

  spriteCache.set(key, s);
  return s;
}

// mini move fetch (type + category) for icons
async function getMoveMini(moveName) {
  if (moveMiniCache.has(moveName)) return moveMiniCache.get(moveName);

  const data =
    moveCache.get(moveName) ||
    (await fetchJsonOrNull(`https://pokeapi.co/api/v2/move/${moveName}`));

  if (data) {
    moveCache.set(moveName, data);
    const mini = {
      type: data?.type?.name || "unknown",
      dmgClass: data?.damage_class?.name || "status",
    };
    moveMiniCache.set(moveName, mini);
    return mini;
  }

  const mini = { type: "unknown", dmgClass: "status" };
  moveMiniCache.set(moveName, mini);
  return mini;
}

/* ======================
   Type chart data (Gen 6+)
====================== */
const TYPES = [
  "normal","fire","water","grass","electric","ice","fighting","poison","ground","flying",
  "psychic","bug","rock","ghost","dragon","dark","steel","fairy",
];

// multipliers: attackType -> defendType -> multiplier
// (Standard modern chart; includes Fairy)
const TYPE_CHART = {
  normal:   { rock:0.5, ghost:0, steel:0.5 },
  fire:     { fire:0.5, water:0.5, grass:2, ice:2, bug:2, rock:0.5, dragon:0.5, steel:2 },
  water:    { fire:2, water:0.5, grass:0.5, ground:2, rock:2, dragon:0.5 },
  grass:    { fire:0.5, water:2, grass:0.5, poison:0.5, ground:2, flying:0.5, bug:0.5, rock:2, dragon:0.5, steel:0.5 },
  electric: { water:2, grass:0.5, electric:0.5, ground:0, flying:2, dragon:0.5 },
  ice:      { fire:0.5, water:0.5, grass:2, ground:2, flying:2, dragon:2, steel:0.5, ice:0.5 },
  fighting: { normal:2, ice:2, rock:2, dark:2, steel:2, poison:0.5, flying:0.5, psychic:0.5, bug:0.5, ghost:0, fairy:0.5 },
  poison:   { grass:2, fairy:2, poison:0.5, ground:0.5, rock:0.5, ghost:0.5, steel:0 },
  ground:   { fire:2, electric:2, poison:2, rock:2, steel:2, grass:0.5, bug:0.5, flying:0 },
  flying:   { grass:2, fighting:2, bug:2, electric:0.5, rock:0.5, steel:0.5 },
  psychic:  { fighting:2, poison:2, psychic:0.5, steel:0.5, dark:0 },
  bug:      { grass:2, psychic:2, dark:2, fire:0.5, fighting:0.5, poison:0.5, flying:0.5, ghost:0.5, steel:0.5, fairy:0.5 },
  rock:     { fire:2, ice:2, flying:2, bug:2, fighting:0.5, ground:0.5, steel:0.5 },
  ghost:    { psychic:2, ghost:2, dark:0.5, normal:0 },
  dragon:   { dragon:2, steel:0.5, fairy:0 },
  dark:     { psychic:2, ghost:2, fighting:0.5, dark:0.5, fairy:0.5 },
  steel:    { ice:2, rock:2, fairy:2, fire:0.5, water:0.5, electric:0.5, steel:0.5 },
  fairy:    { fighting:2, dragon:2, dark:2, fire:0.5, poison:0.5, steel:0.5 },
};

function typeEffect(atk, def1, def2) {
  const row = TYPE_CHART[atk] || {};
  const m1 = row[def1] ?? 1;
  const m2 = def2 ? (row[def2] ?? 1) : 1;
  return m1 * m2;
}

/* ======================
   App
====================== */
export default function App() {
  const [theme, setTheme] = useState(getInitialTheme);

  const [uiZoom, setUiZoom] = useState(() => {
    const saved = localStorage.getItem("pdx-zoom");
    return saved ? Number(saved) : 115;
  });

  const [selectedDex, setSelectedDex] = useState("national");
  const [dexEntries, setDexEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [shiny, setShiny] = useState(false);

  const [openSpecies, setOpenSpecies] = useState(null);

  // ✅ move type-color toggle
  const [moveColorMode, setMoveColorMode] = useState(() => {
    const saved = localStorage.getItem("pdx-moveColor");
    return saved === "1";
  });

  // ✅ type chart toggle
  const [showTypeChart, setShowTypeChart] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("light", theme === "light");
    localStorage.setItem("pdx-theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("pdx-zoom", String(uiZoom));
  }, [uiZoom]);

  useEffect(() => {
    document.body.classList.toggle("moveColorOn", moveColorMode);
    localStorage.setItem("pdx-moveColor", moveColorMode ? "1" : "0");
  }, [moveColorMode]);

  useEffect(() => {
    let alive = true;
    setDexEntries([]);
    setLoading(true);

    async function load() {
      try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokedex/${selectedDex}`);
        const data = await res.json();

        const list = data.pokemon_entries
          .map((e) => ({
            species: e.pokemon_species.name,
            entryNumber: e.entry_number,
            dex: selectedDex,
          }))
          .sort((a, b) => a.entryNumber - b.entryNumber);

        if (!alive) return;
        setDexEntries(list);
      } catch (err) {
        console.error(err);
        if (!alive) return;
        setDexEntries([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [selectedDex]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dexEntries;
    return dexEntries.filter((p) => p.species.includes(q) || String(p.entryNumber) === q);
  }, [dexEntries, query]);

  const clampZoom = (z) => Math.max(70, Math.min(200, z));
  const bumpZoom = (delta) => setUiZoom((z) => clampZoom(z + delta));

  return (
    <div className="wrap">
      <header className="topbar">
        <div className="title">⚪️🔴 GAMERS Pokédex</div>

        <input
          className="search"
          placeholder="Search (name or #)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <label className="toggle">
          <input type="checkbox" checked={shiny} onChange={(e) => setShiny(e.target.checked)} />
          <span>Shiny</span>
        </label>

        <div className="zoomCtl" title="Zoom (Dex only)">
          <button className="zoomBtn" onClick={() => bumpZoom(-5)}>-</button>
          <input
            className="zoomInput"
            value={uiZoom}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^\d]/g, "");
              const n = raw ? Number(raw) : 0;
              setUiZoom(clampZoom(n));
            }}
          />
          <button className="zoomBtn" onClick={() => bumpZoom(5)}>+</button>
          <span className="small">%</span>
        </div>

        <button
          className={"themeBtn " + (moveColorMode ? "activeBtn" : "")}
          onClick={() => setMoveColorMode((v) => !v)}
          title="Toggle move name color by move type"
        >
          Move Colors
        </button>

        <button
          className={"themeBtn " + (showTypeChart ? "activeBtn" : "")}
          onClick={() => setShowTypeChart((v) => !v)}
          title="Toggle Type Chart"
        >
          Type Chart
        </button>

        <button
          className="themeBtn"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          title="Toggle light/dark"
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </header>

      {/* ✅ zoom affects ONLY this area */}
      <div className="dexZoomArea" style={{ zoom: uiZoom / 100 }}>
        <div className="tabs">
          {DEXES.map((d) => (
            <button
              key={d.key}
              className={"tab " + (selectedDex === d.key ? "active" : "")}
              onClick={() => setSelectedDex(d.key)}
            >
              {d.label}
            </button>
          ))}
        </div>

        <main className="main">
          {loading ? (
            <div className="status">Loading dex…</div>
          ) : (
            <div className="grid">
              {filtered.map((p) => (
                <PokemonCard
                  key={`${p.dex}-${p.entryNumber}-${p.species}`}
                  species={p.species}
                  entryNumber={p.entryNumber}
                  dexKey={selectedDex}
                  shiny={shiny}
                  onOpen={() => setOpenSpecies(p.species)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {openSpecies && (
        <DetailsModal
          speciesName={openSpecies}
          dexKey={selectedDex}
          shiny={shiny}
          onClose={() => setOpenSpecies(null)}
          onOpenSpecies={(s) => setOpenSpecies(s)}
        />
      )}

      {showTypeChart && (
        <TypeChartCard onClose={() => setShowTypeChart(false)} />
      )}
    </div>
  );
}

/* ======================
   Grid Card
====================== */
function PokemonCard({ species, entryNumber, dexKey, shiny, onOpen }) {
  const [sprite, setSprite] = useState("");
  const [primaryType, setPrimaryType] = useState("unknown");
  const [displayName, setDisplayName] = useState(species);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const pData = await getPokemonDataSmart(species, dexKey);

      if (!pData) {
        if (!cancelled) {
          setSprite("");
          setPrimaryType("unknown");
          setDisplayName(species);
        }
        return;
      }

      const pName = pData.name || species;
      const s = await getSpriteForPokemonName(pName, shiny);

      const types = (pData.types || []).slice().sort((a, b) => a.slot - b.slot);
      const pType = types[0]?.type?.name || "unknown";

      if (!cancelled) {
        setSprite(s);
        setPrimaryType(pType);
        setDisplayName(pName);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [species, dexKey, shiny]);

  return (
    <article className={`card clickable typeFrame type-${primaryType}`} onClick={onOpen}>
      <div className="num">#{pad3(entryNumber)}</div>
      <div className="name">{titleCaseSlug(displayName)}</div>
      {sprite ? (
        <img className="sprite" src={sprite} alt={displayName} />
      ) : (
        <div className="sprite ph" />
      )}
    </article>
  );
}

/* ======================
   Details Modal
====================== */
function DetailsModal({ speciesName, dexKey, shiny, onClose, onOpenSpecies }) {
  const [loading, setLoading] = useState(true);

  const [species, setSpecies] = useState(null);
  const [pokemon, setPokemon] = useState(null);

  const [entryMap, setEntryMap] = useState({});
  const [entryVersion, setEntryVersion] = useState("");
  const [orderedVersions, setOrderedVersions] = useState([]);

  const [vfLoading, setVfLoading] = useState(true);
  const [variantOptions, setVariantOptions] = useState([]);
  const [megaOptions, setMegaOptions] = useState([]);
  const [gmaxOptions, setGmaxOptions] = useState([]);
  const [otherFormOptions, setOtherFormOptions] = useState([]);

  const [selectedVariant, setSelectedVariant] = useState(speciesName);
  const [selectedForm, setSelectedForm] = useState("");

  const [evoLoading, setEvoLoading] = useState(true);
  const [evoNodes, setEvoNodes] = useState([]);
  const [evoEdges, setEvoEdges] = useState([]);
  const [evoSprites, setEvoSprites] = useState({});

  const displayPokemonName = selectedForm || selectedVariant;

  // Movepool state
  const [movesOpen, setMovesOpen] = useState(false); // ✅ default minimized
  const [moveGen, setMoveGen] = useState("all");
  const [moveSearch, setMoveSearch] = useState("");
  const [movesReady, setMovesReady] = useState(false);
  const [movesByMethod, setMovesByMethod] = useState({
    "level-up": [],
    "machine": [],
    "tutor": [],
    "egg": [],
    "other": [],
  });

  // Move popup
  const [movePopupOpen, setMovePopupOpen] = useState(false);
  const [selectedMove, setSelectedMove] = useState("");
  const [moveDetails, setMoveDetails] = useState(null);
  const [moveDetailsLoading, setMoveDetailsLoading] = useState(false);

  const pokemonMinGen = useMemo(() => {
    const g = species?.generation?.name;
    const n = genSlugToNumber(g);
    if (!Number.isFinite(n) || n === 999) return 1;
    return n;
  }, [species?.generation?.name]);

  const genOptions = useMemo(() => {
    const arr = [];
    for (let g = pokemonMinGen; g <= CURRENT_GEN; g++) arr.push(g);
    return arr;
  }, [pokemonMinGen]);

  useEffect(() => {
    let alive = true;

    setLoading(true);
    setSpecies(null);
    setPokemon(null);

    setEntryMap({});
    setEntryVersion("");
    setOrderedVersions([]);

    setVfLoading(true);
    setVariantOptions([]);
    setMegaOptions([]);
    setGmaxOptions([]);
    setOtherFormOptions([]);
    setSelectedVariant(speciesName);
    setSelectedForm("");

    setEvoLoading(true);
    setEvoNodes([]);
    setEvoEdges([]);
    setEvoSprites({});

    // reset moves
    setMovesOpen(false);
    setMoveGen("all");
    setMoveSearch("");
    setMovesReady(false);
    setMovesByMethod({
      "level-up": [],
      "machine": [],
      "tutor": [],
      "egg": [],
      "other": [],
    });

    setMovePopupOpen(false);
    setSelectedMove("");
    setMoveDetails(null);
    setMoveDetailsLoading(false);

    async function load() {
      try {
        const sData = await fetchJsonOrNull(`https://pokeapi.co/api/v2/pokemon-species/${speciesName}`);
        if (!sData) throw new Error("species not found");

        const baseName = sData.varieties?.find((v) => v.is_default)?.pokemon?.name || speciesName;

        if (!alive) return;
        setSpecies(sData);

        // Entries
        const map = {};
        for (const x of sData.flavor_text_entries || []) {
          if (x.language?.name !== "en") continue;
          const v = x.version?.name;
          if (!v) continue;
          map[v] = x.flavor_text.replace(/\f|\n/g, " ").trim();
        }

        const versions = Object.keys(map);
        const metas = await Promise.all(
          versions.map(async (v) => {
            const meta = await getVersionGenNumber(v);
            return { v, genNum: meta.genNum, vg: meta.versionGroup };
          })
        );
        metas.sort((a, b) => {
          if (a.genNum !== b.genNum) return a.genNum - b.genNum;
          if (a.vg !== b.vg) return a.vg.localeCompare(b.vg);
          return a.v.localeCompare(b.v);
        });
        const sortedVersions = metas.map((m) => m.v);
        const defaultV = sortedVersions[sortedVersions.length - 1] || "";

        if (!alive) return;
        setEntryMap(map);
        setOrderedVersions(sortedVersions);
        setEntryVersion(defaultV);

        const basePoke = await fetchJsonOrNull(`https://pokeapi.co/api/v2/pokemon/${baseName}`);
        if (basePoke) pokemonCache.set(baseName, basePoke);

        // Variant/form lists
        (async () => {
          try {
            const varieties = (sData.varieties || []).map((v) => v.pokemon?.name).filter(Boolean);

            const variants = [];
            const megas = [];
            const gmax = [];
            const others = [];

            for (const pnm of varieties) {
              const label = prettyLabel(baseName, pnm);
              if (pnm === baseName || isRegionalVariant(pnm)) variants.push({ label, pokemonName: pnm });
              else if (isMega(pnm)) megas.push({ label, pokemonName: pnm });
              else if (isGmax(pnm)) gmax.push({ label, pokemonName: pnm });
              else others.push({ label, pokemonName: pnm });
            }

            const formNames = (basePoke?.forms || []).map((f) => f.name).filter(Boolean);
            for (const fn of formNames) {
              const exists =
                variants.some((x) => x.pokemonName === fn) ||
                megas.some((x) => x.pokemonName === fn) ||
                gmax.some((x) => x.pokemonName === fn) ||
                others.some((x) => x.pokemonName === fn);
              if (!exists) others.push({ label: prettyLabel(baseName, fn), pokemonName: fn });
            }

            if (!variants.some((o) => o.pokemonName === baseName)) {
              variants.unshift({ label: "Base", pokemonName: baseName });
            }

            variants.sort((a, b) => {
              if (a.pokemonName === baseName && b.pokemonName !== baseName) return -1;
              if (b.pokemonName === baseName && a.pokemonName !== baseName) return 1;
              const ar = isRegionalVariant(a.pokemonName);
              const br = isRegionalVariant(b.pokemonName);
              if (ar !== br) return ar ? 1 : -1;
              return a.label.localeCompare(b.label);
            });

            megas.sort((a, b) => a.label.localeCompare(b.label));
            gmax.sort((a, b) => a.label.localeCompare(b.label));
            others.sort((a, b) => a.label.localeCompare(b.label));

            if (!alive) return;
            setVariantOptions(variants);
            setMegaOptions(megas);
            setGmaxOptions(gmax);
            setOtherFormOptions(others);

            const suffix = regionSuffixForDex(dexKey);
            let defaultVariant = baseName;
            if (suffix) {
              const cand = `${baseName}-${suffix}`;
              if (await pokemonExists(cand)) defaultVariant = cand;
            }

            setSelectedVariant(defaultVariant);
            setSelectedForm("");
            setVfLoading(false);
          } catch {
            if (!alive) return;
            setVfLoading(false);
          }
        })();

        // Evolution chain
        (async () => {
          try {
            const evoUrl = sData.evolution_chain?.url;
            if (!evoUrl) {
              if (!alive) return;
              setEvoLoading(false);
              return;
            }

            const evoData = await fetchJsonOrNull(evoUrl);
            const chain = evoData?.chain;
            if (!chain) throw new Error("no chain");

            const { nodes, edges } = collectEvolutionNodes(chain);

            const pairs = await Promise.all(nodes.map(async (nm) => [nm, await getSpriteForName(nm)]));
            const spriteMap = Object.fromEntries(pairs);

            if (!alive) return;
            setEvoNodes(nodes);
            setEvoEdges(edges);
            setEvoSprites(spriteMap);
            setEvoLoading(false);
          } catch {
            if (!alive) return;
            setEvoLoading(false);
          }
        })();

        if (!alive) return;
        setPokemon(basePoke);
      } catch (err) {
        console.error(err);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => { alive = false; };
  }, [speciesName, dexKey]);

  // Load displayed pokemon when variant/form changes
  useEffect(() => {
    let alive = true;

    async function loadDisplayed() {
      const data = await fetchJsonOrNull(`https://pokeapi.co/api/v2/pokemon/${displayPokemonName}`);
      if (!alive) return;

      if (data) {
        pokemonCache.set(displayPokemonName, data);
        setPokemon(data);

        // reset moves
        setMovesReady(false);
        setMovesByMethod({
          "level-up": [],
          "machine": [],
          "tutor": [],
          "egg": [],
          "other": [],
        });

        // close move popup
        setMovePopupOpen(false);
        setSelectedMove("");
        setMoveDetails(null);
        setMoveDetailsLoading(false);
      }
    }

    if (displayPokemonName) loadDisplayed();
    return () => { alive = false; };
  }, [displayPokemonName]);

  async function getSpriteForName(speciesNm) {
    const def = await getDefaultPokemonNameFromSpecies(speciesNm);
    const ok = await pokemonExists(def);
    if (!ok) return "";
    return getSpriteForPokemonName(def, false);
  }

  // Build move list
  useEffect(() => {
    let alive = true;

    async function buildMoves() {
      if (!pokemon?.moves) return;

      setMovesReady(false);

      const genWanted = moveGen === "all" ? null : Number(moveGen);
      const q = moveSearch.trim().toLowerCase();

      const out = {
        "level-up": [],
        "machine": [],
        "tutor": [],
        "egg": [],
        "other": [],
      };

      for (const m of pokemon.moves) {
        const moveName = m?.move?.name;
        if (!moveName) continue;
        if (q && !moveName.includes(q)) continue;

        const details = m.version_group_details || [];
        let matching = [];

        if (!genWanted) {
          matching = details;
        } else {
          const withGen = await Promise.all(
            details.map(async (d) => {
              const vg = d.version_group?.name;
              const genNum = await getVersionGroupGenNumber(vg);
              return { ...d, __genNum: genNum };
            })
          );
          matching = withGen.filter((d) => d.__genNum === genWanted);
        }

        if (matching.length === 0) continue;

        // pick best (prefer earliest level-up)
        let best = matching[0];
        for (const d of matching) {
          if (d.move_learn_method?.name === "level-up") {
            if (best.move_learn_method?.name !== "level-up") best = d;
            else if ((d.level_learned_at ?? 999) < (best.level_learned_at ?? 999)) best = d;
          }
        }

        const method = best.move_learn_method?.name || "other";
        const bucket =
          method === "level-up" ? "level-up" :
          method === "machine" ? "machine" :
          method === "tutor" ? "tutor" :
          method === "egg" ? "egg" : "other";

        // prefetch mini info for icons
        getMoveMini(moveName);

        out[bucket].push({
          name: moveName,
          level: best.level_learned_at ?? null,
          vg: best.version_group?.name || "",
        });
      }

      out["level-up"].sort((a, b) => {
        const la = a.level ?? 999;
        const lb = b.level ?? 999;
        if (la !== lb) return la - lb;
        return a.name.localeCompare(b.name);
      });
      out["machine"].sort((a, b) => a.name.localeCompare(b.name));
      out["tutor"].sort((a, b) => a.name.localeCompare(b.name));
      out["egg"].sort((a, b) => a.name.localeCompare(b.name));
      out["other"].sort((a, b) => a.name.localeCompare(b.name));

      if (!alive) return;
      setMovesByMethod(out);
      setMovesReady(true);
    }

    buildMoves();
    return () => { alive = false; };
  }, [pokemon?.name, pokemon?.moves, moveGen, moveSearch]);

  // Load move details for popup
  useEffect(() => {
    let alive = true;

    async function loadMove() {
      if (!selectedMove) return;

      setMoveDetailsLoading(true);

      if (moveCache.has(selectedMove)) {
        setMoveDetails(moveCache.get(selectedMove));
        setMoveDetailsLoading(false);
        return;
      }

      const data = await fetchJsonOrNull(`https://pokeapi.co/api/v2/move/${selectedMove}`);
      if (!alive) return;

      if (data) {
        moveCache.set(selectedMove, data);
        setMoveDetails(data);
      } else {
        setMoveDetails(null);
      }

      setMoveDetailsLoading(false);
    }

    loadMove();
    return () => { alive = false; };
  }, [selectedMove]);

  if (loading) {
    return (
      <div className="modalBack" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modalHead">
            <div className="modalTitle">Loading…</div>
            <button className="x" onClick={onClose}>×</button>
          </div>
          <div className="modalBody">Fetching data…</div>
        </div>
      </div>
    );
  }

  if (!pokemon || !species) return null;

  const typesSorted = (pokemon.types || []).slice().sort((a, b) => a.slot - b.slot);
  const primaryType = typesSorted[0]?.type?.name || "unknown";

  const sprite =
    (shiny ? pokemon.sprites.front_shiny : pokemon.sprites.front_default) ||
    pokemon.sprites.front_default ||
    "";

  const genus =
    (species.genera || [])
      .find((g) => g.language?.name === "en")
      ?.genus || "";

  const eggGroups = (species.egg_groups || []).map((e) => titleCaseSlug(e.name)).join(", ");
  const growthRate = titleCaseSlug(species.growth_rate?.name || "");

  const baseTotal = (pokemon.stats || []).reduce((sum, s) => sum + (s.base_stat || 0), 0);
  const evTotal = (pokemon.stats || []).reduce((sum, s) => sum + (s.effort || 0), 0);

  return (
    <div className="modalBack" onClick={onClose}>
      <div className={`modal modalType type-${primaryType}`} onClick={(e) => e.stopPropagation()}>
        <div className="modalHead">
          <div className="modalTitle">
            {titleCaseSlug(pokemon.name)} <span className="small">#{pad3(pokemon.id)}</span>
          </div>
          <button className="x" onClick={onClose}>×</button>
        </div>

        <div className="modalBody">
          <div className="row">
            <img className="spriteBig" src={sprite} alt={pokemon.name} />
            <div className="col">
              <div className="badges">
                {typesSorted.map((t) => (
                  <span key={t.type.name} className={`badge typeBadge type-${t.type.name}`}>
                    <span className="ti">{TYPE_ICON[t.type.name] || "❔"}</span>
                    {titleCaseSlug(t.type.name)}
                  </span>
                ))}
              </div>

              {/* Variant / Form split */}
              <div className="vfWrap">
                <div className="vfRow">
                  <div className="vfLabel">Variant:</div>
                  {vfLoading ? (
                    <div className="small">Loading…</div>
                  ) : (
                    <select
                      className="entrySelect vfSelect"
                      value={selectedVariant}
                      onChange={(e) => {
                        setSelectedVariant(e.target.value);
                        setSelectedForm("");
                      }}
                    >
                      {variantOptions.map((o) => (
                        <option key={o.pokemonName} value={o.pokemonName}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="vfRow">
                  <div className="vfLabel">Form:</div>
                  {vfLoading ? (
                    <div className="small">Loading…</div>
                  ) : (megaOptions.length + gmaxOptions.length + otherFormOptions.length) === 0 ? (
                    <div className="small">None</div>
                  ) : (
                    <select
                      className="entrySelect vfSelect"
                      value={selectedForm}
                      onChange={(e) => setSelectedForm(e.target.value)}
                    >
                      <option value="">(No form)</option>

                      {megaOptions.length > 0 && (
                        <optgroup label="Mega">
                          {megaOptions.map((o) => (
                            <option key={o.pokemonName} value={o.pokemonName}>
                              {o.label}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {gmaxOptions.length > 0 && (
                        <optgroup label="Gigantamax">
                          {gmaxOptions.map((o) => (
                            <option key={o.pokemonName} value={o.pokemonName}>
                              {o.label}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {otherFormOptions.length > 0 && (
                        <optgroup label="Other Forms">
                          {otherFormOptions.map((o) => (
                            <option key={o.pokemonName} value={o.pokemonName}>
                              {o.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  )}
                </div>

                {selectedForm && (
                  <button className="vfClear" onClick={() => setSelectedForm("")}>
                    Clear Form
                  </button>
                )}
              </div>

              <div className="kv">
                {genus ? <div><span className="k">Category:</span> {genus}</div> : null}
                <div><span className="k">Height:</span> {(pokemon.height / 10).toFixed(1)} m</div>
                <div><span className="k">Weight:</span> {(pokemon.weight / 10).toFixed(1)} kg</div>
                <div><span className="k">Base EXP:</span> {pokemon.base_experience}</div>
                <div><span className="k">Gender:</span> {genderRateToText(species.gender_rate)}</div>
                <div><span className="k">Egg Groups:</span> {eggGroups || "—"}</div>
                <div><span className="k">Base Happiness:</span> {species.base_happiness}</div>
                <div><span className="k">Capture Rate:</span> {species.capture_rate}</div>
                <div><span className="k">Growth Rate:</span> {growthRate || "—"}</div>
                <div><span className="k">First Appeared:</span> Gen {pokemonMinGen}</div>
              </div>
            </div>
          </div>

          {/* Moves */}
          <div className="panel">
            <div className="panelTitle dexEntryHeader">
              <span>Moves</span>
              <div className="moveTools">
                <button
                  className="miniToggleBtn"
                  onClick={() => setMovesOpen((v) => !v)}
                  title={movesOpen ? "Minimize movepool" : "Expand movepool"}
                >
                  {movesOpen ? "−" : "+"}
                </button>

                <select
                  className="entrySelect"
                  value={moveGen}
                  onChange={(e) => setMoveGen(e.target.value)}
                  title="Filter by generation"
                  disabled={!movesOpen}
                >
                  <option value="all">All Gens</option>
                  {genOptions.map((g) => (
                    <option key={g} value={String(g)}>Gen {g}</option>
                  ))}
                </select>

                <input
                  className="search"
                  style={{ maxWidth: "260px" }}
                  placeholder="Search moves…"
                  value={moveSearch}
                  onChange={(e) => setMoveSearch(e.target.value)}
                  disabled={!movesOpen}
                />
              </div>
            </div>

            {!movesOpen ? (
              <div className="panelText small">Movepool is minimized. Click + to open.</div>
            ) : !movesReady ? (
              <div className="panelText">Building movepool…</div>
            ) : (
              <MovesList
                movesByMethod={movesByMethod}
                onPickMove={(m) => {
                  setSelectedMove(m);
                  setMovePopupOpen(true);
                }}
              />
            )}
          </div>

          {/* Evolution */}
          <div className="panel">
            <div className="panelTitle">Evolution</div>

            {evoLoading ? (
              <div className="panelText">Loading evolution chain…</div>
            ) : evoNodes.length <= 1 ? (
              <div className="panelText">{titleCaseSlug(speciesName)} does not evolve.</div>
            ) : (
              <div className="evoBar">
                {evoNodes.map((nm, idx) => {
                  const prev = evoNodes[idx - 1];
                  const edge = prev ? evoEdges.find((e) => e.from === prev && e.to === nm) : null;

                  return (
                    <div key={nm} className="evoBarItem">
                      {idx !== 0 ? (
                        <div className="evoBetween">
                          <div className="evoBetweenArrow">→</div>
                          <div className="evoBetweenHow">{edge?.how || ""}</div>
                        </div>
                      ) : null}

                      <button
                        className={"evoSquare " + (nm === speciesName ? "current" : "")}
                        onClick={() => onOpenSpecies(nm)}
                        title="Open Pokémon"
                      >
                        <img className="evoSquareSprite" src={evoSprites[nm] || ""} alt={nm} />
                        <div className="evoSquareName cap">{titleCaseSlug(nm)}</div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dex Entry */}
          <div className="panel">
            <div className="panelTitle dexEntryHeader">
              <span>Dex Entry</span>
              {orderedVersions.length > 0 && (
                <select
                  className="entrySelect"
                  value={entryVersion}
                  onChange={(e) => setEntryVersion(e.target.value)}
                >
                  {orderedVersions.map((v) => (
                    <option key={v} value={v}>
                      {titleCaseSlug(v)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="panelText">{entryMap[entryVersion] || "No English entry found."}</div>
          </div>

          {/* Abilities */}
          <div className="panel">
            <div className="panelTitle">Abilities</div>
            <ul className="list">
              {pokemon.abilities.map((a) => (
                <li key={a.ability.name}>
                  <span className="cap">{titleCaseSlug(a.ability.name)}</span>
                  {a.is_hidden && <span className="small"> (Hidden)</span>}
                </li>
              ))}
            </ul>
          </div>

          {/* Stats */}
          <div className="panel">
            <div className="panelTitle statsHeader">
              <span>Stats</span>
              <span className="statsTotals">
                Total: <b>{baseTotal}</b> &nbsp;|&nbsp; EV Yield: <b>{evTotal}</b>
              </span>
            </div>

            <div className="stats">
              {pokemon.stats.map((s) => {
                const v = s.base_stat;
                const ev = s.effort;
                const pct = statPercent(v);
                const cls = statColorClass(v);

                return (
                  <div key={s.stat.name} className="statRow2">
                    <div className="statName cap" title={titleCaseSlug(s.stat.name)}>
                      {titleCaseSlug(s.stat.name)}
                    </div>

                    <div className="statBar">
                      <div className={`statFill ${cls}`} style={{ width: `${pct}%` }} />
                    </div>

                    <div className="statVal">
                      {v}
                      <div className="evMini">EV +{ev}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="panelMini">
              <div className="panelMiniTitle">EV Yield (summary)</div>
              <div className="panelMiniText">
                {pokemon.stats
                  .filter((s) => (s.effort || 0) > 0)
                  .map((s) => `${titleCaseSlug(s.stat.name)} +${s.effort}`)
                  .join(", ") || "None"}
              </div>
            </div>
          </div>

          {/* Move Popup */}
          {movePopupOpen && (
            <MovePopup
              moveName={selectedMove}
              loading={moveDetailsLoading}
              move={moveDetails}
              onClose={() => {
                setMovePopupOpen(false);
                setSelectedMove("");
                setMoveDetails(null);
                setMoveDetailsLoading(false);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ======================
   Moves list with icons
====================== */
function MovesList({ movesByMethod, onPickMove }) {
  const sections = [
    { key: "level-up", label: "Level-up" },
    { key: "machine", label: "TM/HM (Machine)" },
    { key: "tutor", label: "Tutor" },
    { key: "egg", label: "Egg" },
    { key: "other", label: "Other" },
  ];

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {sections.map((sec) => {
        const list = movesByMethod[sec.key] || [];
        return (
          <div key={sec.key}>
            <div className="panelTitle" style={{ marginBottom: "6px" }}>
              {sec.label} <span className="small">({list.length})</span>
            </div>

            {list.length === 0 ? (
              <div className="panelText small">None.</div>
            ) : sec.key === "level-up" ? (
              <div style={{ display: "grid", gap: "6px" }}>
                {list.slice(0, 120).map((m) => (
                  <MoveRow
                    key={m.name + m.level}
                    kind="row"
                    labelLeft={`Lv ${m.level ?? "—"}`}
                    moveName={m.name}
                    labelRight={m.vg ? titleCaseSlug(m.vg) : ""}
                    onClick={() => onPickMove(m.name)}
                  />
                ))}
                {list.length > 120 && <div className="small">Showing first 120 (search to narrow).</div>}
              </div>
            ) : (
              <div className="moveGridWrap">
                {list.slice(0, 220).map((m) => (
                  <MoveRow
                    key={m.name}
                    kind="chip"
                    moveName={m.name}
                    onClick={() => onPickMove(m.name)}
                  />
                ))}
                {list.length > 220 && (
                  <div className="small" style={{ width: "100%" }}>
                    Showing first 220 (search to narrow).
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MoveRow({ kind, moveName, labelLeft, labelRight, onClick }) {
  const [mini, setMini] = useState({ type: "unknown", dmgClass: "status" });

  useEffect(() => {
    let alive = true;
    (async () => {
      const m = await getMoveMini(moveName);
      if (alive) setMini(m);
    })();
    return () => { alive = false; };
  }, [moveName]);

  const cat = mini.dmgClass || "status";
  const icon = catIcon(cat);
  const typeIcon = TYPE_ICON[mini.type] || "❔";

  const moveNameClass = `moveNameType moveType-${mini.type}`;

  if (kind === "chip") {
    return (
      <button className="moveChip smallChip" onClick={onClick} title="Click for move details">
        <span className={`badge typeBadge type-${mini.type}`}>
          <span className="ti">{typeIcon}</span> {titleCaseSlug(mini.type)}
        </span>

        <span className={`badge catMini cat-${cat}`} title={titleCaseSlug(cat)}>
          <span className="catIcon">{icon}</span>
        </span>

        <span className={`cap moveChipName ${moveNameClass}`}>{titleCaseSlug(moveName)}</span>
      </button>
    );
  }

  return (
    <button className="moveRowBtn2" onClick={onClick} title="Click for move details">
      <div className="moveLvl">{labelLeft}</div>

      <div className="moveIcons">
        <span className={`badge typeBadge type-${mini.type}`}>
          <span className="ti">{typeIcon}</span> {titleCaseSlug(mini.type)}
        </span>

        <span className={`badge catMini cat-${cat}`} title={titleCaseSlug(cat)}>
          <span className="catIcon">{icon}</span>
        </span>
      </div>

      <div className={`cap moveName ${moveNameClass}`}>{titleCaseSlug(moveName)}</div>
      <div className="moveVG small">{labelRight}</div>
    </button>
  );
}

/* ======================
   Move Popup (nested modal)
====================== */
function MovePopup({ moveName, loading, move, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="movePopBack" onClick={onClose}>
      <div className="movePop" onClick={(e) => e.stopPropagation()}>
        <div className="movePopHead">
          <div className="movePopTitle cap">{titleCaseSlug(moveName)}</div>
          <button className="x" onClick={onClose}>×</button>
        </div>

        <div className="movePopBody">
          {loading ? (
            <div className="panelText">Loading move data…</div>
          ) : move ? (
            <MoveDetails move={move} />
          ) : (
            <div className="panelText">No move data found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MoveDetails({ move }) {
  const typeRaw = move?.type?.name || "unknown";
  const type = typeRaw ? titleCaseSlug(typeRaw) : "—";

  const dmgClassRaw = move?.damage_class?.name || "status";
  const dmgClass = dmgClassRaw ? titleCaseSlug(dmgClassRaw) : "—";

  const power = move?.power ?? "—";
  const acc = move?.accuracy ?? "—";
  const pp = move?.pp ?? "—";
  const prio = move?.priority ?? 0;

  const target = move?.target?.name ? titleCaseSlug(move.target.name) : "—";
  const effectChance = move?.effect_chance != null ? `${move.effect_chance}%` : "—";

  const replaceEffectChance = (text) => {
    if (!text) return "";
    if (move.effect_chance == null) return text;
    return text.replace(/\$effect_chance/g, String(move.effect_chance));
  };

  const effect =
    replaceEffectChance(
      (move.effect_entries || [])
        .find((e) => e.language?.name === "en")
        ?.effect?.replace(/\n/g, " ")
        .trim()
    ) || "—";

  let shortEffect =
    replaceEffectChance(
      (move.effect_entries || [])
        .find((e) => e.language?.name === "en")
        ?.short_effect?.replace(/\n/g, " ")
        .trim()
    ) || "";

  if (shortEffect && effect && effect.toLowerCase().includes(shortEffect.toLowerCase())) {
    shortEffect = "";
  }

  const typeIcon = TYPE_ICON[typeRaw] || "❔";
  const cIcon = catIcon(dmgClassRaw);

  return (
    <div className="kv">
      <div className="moveTopBadges">
        <span className={`badge typeBadge type-${typeRaw}`}>
          <span className="ti">{typeIcon}</span> {type}
        </span>

        <span className={`badge catBadge cat-${dmgClassRaw}`}>
          <span className="catIcon">{cIcon}</span> {dmgClass}
        </span>
      </div>

      <div className="moveGrid">
        <div><span className="k">Power:</span> {power}</div>
        <div><span className="k">Accuracy:</span> {acc}</div>
        <div><span className="k">PP:</span> {pp}</div>
        <div><span className="k">Priority:</span> {prio}</div>
        <div><span className="k">Target:</span> {target}</div>
        <div><span className="k">Effect Chance:</span> {effectChance}</div>
      </div>

      <div style={{ marginTop: "10px" }}>
        <div className="k">Effect:</div>
        <div className="panelText" style={{ marginTop: "6px" }}>
          {shortEffect ? <b>{shortEffect}</b> : null}
          {shortEffect ? <div style={{ height: "6px" }} /> : null}
          {effect}
        </div>
      </div>
    </div>
  );
}

/* ======================
   Type chart card
====================== */
function TypeChartCard({ onClose }) {
  const [atk, setAtk] = useState("fire");
  const [def1, setDef1] = useState("grass");
  const [def2, setDef2] = useState("");

  const mult = typeEffect(atk, def1, def2 || null);

  const buckets = useMemo(() => {
    const b = { "4x": [], "2x": [], "1x": [], "0.5x": [], "0.25x": [], "0x": [] };
    for (const d of TYPES) {
      const m = typeEffect(atk, d, null);
      if (m === 4) b["4x"].push(d);
      else if (m === 2) b["2x"].push(d);
      else if (m === 1) b["1x"].push(d);
      else if (m === 0.5) b["0.5x"].push(d);
      else if (m === 0.25) b["0.25x"].push(d);
      else if (m === 0) b["0x"].push(d);
    }
    return b;
  }, [atk]);

  return (
    <div className="typeChartCard">
      <div className="typeChartHead">
        <div className="typeChartTitle">Type Chart</div>
        <button className="x" onClick={onClose}>×</button>
      </div>

      <div className="typeChartBody">
        <div className="typeChartRow">
          <span className="k">Attacking</span>
          <select className="entrySelect" value={atk} onChange={(e) => setAtk(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{titleCaseSlug(t)}</option>
            ))}
          </select>
        </div>

        <div className="typeChartRow">
          <span className="k">Defending</span>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select className="entrySelect" value={def1} onChange={(e) => setDef1(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>{titleCaseSlug(t)}</option>
              ))}
            </select>

            <select className="entrySelect" value={def2} onChange={(e) => setDef2(e.target.value)}>
              <option value="">(No 2nd type)</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>{titleCaseSlug(t)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="panelText">
          Result: <b>{mult}×</b>
        </div>

        <div className="typeChartBlock">
          <div className="k">Against all types (single-type defense)</div>

          {["4x","2x","1x","0.5x","0.25x","0x"].map((k) => (
            <div key={k} style={{ marginTop: "10px" }}>
              <div className="k">{k}</div>
              <div className="chipRow">
                {(buckets[k] || []).map((t) => (
                  <span key={t} className={`badge typeBadge type-${t}`}>
                    <span className="ti">{TYPE_ICON[t] || "❔"}</span>
                    {titleCaseSlug(t)}
                  </span>
                ))}
                {(buckets[k] || []).length === 0 ? (
                  <span className="small">None</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
