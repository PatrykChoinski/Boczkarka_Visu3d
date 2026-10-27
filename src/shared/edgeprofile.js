// Receptury boczkarki - port 1:1 z PLC (PLC/src/Recipes): ProfileType, GeneratePasses, ValidateProfile,
// SetProfileDefaults i receptury startowe (RecipeControl.InitDefaults). Strona liczy te same listy przejsc co PLC.

export const MAX_PASSES = 40;

export const PROFILE_TYPE = {
  StraightEdge: 0, TopChamfer: 1, BottomChamfer: 2, TopQuarterRound: 3, BottomQuarterRound: 4, HalfRound: 5, Custom: 6,
};
export const PROFILE_NAMES = {
  0: 'Bok prosty', 1: 'Faza górna', 2: 'Faza dolna', 3: 'Ćwierćwałek górny', 4: 'Ćwierćwałek dolny', 5: 'Półwałek', 6: 'Własny',
};

// Profile z wartosciami poczatkowymi jak w DUT Profile
export function newProfile(over = {}) {
  return {
    name: '', kind: PROFILE_TYPE.StraightEdge, xStart: 0, xEnd: 2000, overtravel: 50, spindleFrequency: 50, feed: 1.0,
    bothDirections: true, angle: 45, angleStart: 0, angleEnd: 90, angleStep: 10, repeats: 1, passCount: 0, passes: [], ...over,
  };
}

// GeneratePasses: lista przejsc z parametrow (Custom - bez zmian). Zwraca {ok, passes}; profil nie jest zmieniany.
export function generatePasses(p) {
  if (p.kind === PROFILE_TYPE.Custom) {
    const ok = p.passes.length >= 1 && p.passes.length <= MAX_PASSES;
    return { ok, passes: p.passes.slice() };
  }
  const start = Math.abs(p.angleStart);
  const end = Math.abs(p.angleEnd);
  const angles = [];
  const round = [PROFILE_TYPE.TopQuarterRound, PROFILE_TYPE.BottomQuarterRound, PROFILE_TYPE.HalfRound].includes(p.kind);
  if (round) {
    if (p.angleStep <= 0.1 || end < start) return { ok: false, passes: [] };
    let a = start;
    while (a < end - 0.001) {
      if (angles.length >= MAX_PASSES) return { ok: false, passes: [] };
      angles.push(a);
      a += p.angleStep;
    }
    if (angles.length >= MAX_PASSES) return { ok: false, passes: [] };
    angles.push(end);
  }
  let list;
  switch (p.kind) {
    case PROFILE_TYPE.StraightEdge: list = [0]; break;
    case PROFILE_TYPE.TopChamfer: list = [Math.abs(p.angle)]; break;
    case PROFILE_TYPE.BottomChamfer: list = [-Math.abs(p.angle)]; break;
    case PROFILE_TYPE.TopQuarterRound: list = angles; break;
    case PROFILE_TYPE.BottomQuarterRound: list = angles.map((a) => -a); break;
    case PROFILE_TYPE.HalfRound:
      list = [...angles.slice().reverse().map((a) => -a), ...angles.filter((a) => a > 0.001)];
      if (list.length > MAX_PASSES) return { ok: false, passes: [] };
      break;
    default: return { ok: false, passes: [] };
  }
  const repeats = Math.max(p.repeats, 1);
  return { ok: list.length >= 1, passes: list.map((angleB) => ({ angleB, repeats, feed: 0, spindleFrequency: 0 })) };
}

// ValidateProfile: 0 = OK, kody jak w PLC (Recipes.ValidationError)
export const VALIDATION_TEXT = {
  0: 'OK', 1: 'Początek pola ≥ koniec', 2: 'Kąt poza zakresem osi B', 3: 'Brak przejść / za dużo przejść',
  4: 'Posuw poza zakresem', 5: 'Obroty poza zakresem', 6: 'Liczba powtórzeń < 1', 7: 'Pole poza zakresem osi X',
};
export function validateProfile(p, passes, limits = {}) {
  const l = { xMin: -5, xMax: 2300, bMin: -95, bMax: 95, feedMin: 0.1, feedMax: 6, freqMin: 20, freqMax: 100, ...limits };
  if (p.xStart >= p.xEnd) return 1;
  if (p.xStart - p.overtravel < l.xMin || p.xEnd + p.overtravel > l.xMax) return 7;
  if (passes.length < 1 || passes.length > MAX_PASSES) return 3;
  for (const s of passes) {
    if (s.angleB < l.bMin || s.angleB > l.bMax) return 2;
    if (s.repeats < 1) return 6;
    const feed = s.feed > 0 ? s.feed : p.feed;
    if (feed < l.feedMin || feed > l.feedMax) return 4;
    const f = s.spindleFrequency > 0 ? s.spindleFrequency : p.spindleFrequency;
    if (f < l.freqMin || f > l.freqMax) return 5;
  }
  return 0;
}

// SetProfileDefaults: parametry katow dla rodzaju (pole X, obroty i posuw zostaja)
export function setProfileDefaults(p, kind) {
  const out = { ...p, kind, repeats: 1 };
  if (kind === PROFILE_TYPE.StraightEdge) out.angle = 0;
  else if (kind === PROFILE_TYPE.TopChamfer || kind === PROFILE_TYPE.BottomChamfer) out.angle = 45;
  else if (kind !== PROFILE_TYPE.Custom) Object.assign(out, { angleStart: 0, angleEnd: 90, angleStep: 10 });
  return out;
}

// Receptury startowe (RecipeControl.InitDefaults)
export function defaultRecipes() {
  const make = (name, kind, over = {}) => ({ ...setProfileDefaults(newProfile({ name }), kind), ...over });
  return [
    make('Bok prosty', PROFILE_TYPE.StraightEdge),
    make('Faza górna 45', PROFILE_TYPE.TopChamfer),
    make('Faza górna 30', PROFILE_TYPE.TopChamfer, { angle: 30 }),
    make('Faza dolna 45', PROFILE_TYPE.BottomChamfer),
    make('Ćwierćwałek górny', PROFILE_TYPE.TopQuarterRound),
    make('Ćwierćwałek dolny', PROFILE_TYPE.BottomQuarterRound),
    make('Półwałek', PROFILE_TYPE.HalfRound),
  ];
}

// Profil z wartosci PLC (klucze VARIABLES z przedrostkiem "cycle" albo "active")
export function profileFromValues(v, prefix = 'cycle') {
  const g = (k, d) => (v[`${prefix}${k}`] ?? d);
  return newProfile({
    name: g('Name', ''), kind: Number(g('Kind', 0)), xStart: Number(g('XStart', 0)), xEnd: Number(g('XEnd', 0)),
    overtravel: Number(g('Overtravel', 0)), angle: Number(g('Angle', 45)), angleStart: Number(g('AngleStart', 0)),
    angleEnd: Number(g('AngleEnd', 90)), angleStep: Number(g('AngleStep', 10)), repeats: Number(g('Repeats', 1)),
    bothDirections: Boolean(g('BothDirections', true)),
  });
}
