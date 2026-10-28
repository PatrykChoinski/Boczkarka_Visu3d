// Alarmy boczkarki - jak w PLC (AlarmControl, Alarms.Active[1..32]). Przez OPC UA tablica przychodzi od indeksu 0:
// alarm n = element n - 1.
export const ALARMS = [
  { n: 1, pl: 'E-STOP wciśnięty' },
  { n: 2, pl: 'Brak gotowości obwodu bezpieczeństwa / STO' },
  { n: 3, pl: 'Osłona otwarta' },
  { n: 4, pl: 'Błąd serwa X' },
  { n: 5, pl: 'Błąd serwa B' },
  { n: 6, pl: 'X: krańcówka / softlimit' },
  { n: 7, pl: 'B: krańcówka / softlimit' },
  { n: 8, pl: 'Osie nie gotowe przy starcie automatu (brak załączenia / błąd)' },
  { n: 9, pl: 'Błąd falownika wrzeciona' },
  { n: 10, pl: 'Przeciążenie wrzeciona' },
  { n: 11, pl: 'Wrzeciono nie osiągnęło obrotów' },
  { n: 12, pl: 'Brak wody / powietrza' },
  { n: 13, pl: 'Błąd komunikacji EtherCAT' },
  { n: 14, pl: 'Niepoprawna receptura' },
  { n: 15, pl: 'Przekroczony czas kroku automatu' },
];

export const alarmByNumber = (n) => ALARMS.find((a) => a.n === n) ?? null;
export const alarmText = (n) => alarmByNumber(n)?.pl ?? `Alarm ${n}`;

// Numery aktywnych alarmow z wartosci PLC (klucz alarms = Alarms.Active)
export function activeFromValues(values) {
  const arr = values?.alarms;
  if (!Array.isArray(arr)) return [];
  const out = [];
  arr.forEach((on, i) => { if (on) out.push(i + 1); });
  return out;
}
