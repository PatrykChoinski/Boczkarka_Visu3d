// Jezyk strony: polski (domyslny) i angielski. Teksty zrodlowe po polsku (HTML, program, PLC, serwer); t() zwraca
// tlumaczenie: cale zdanie ze slownika albo podmiana znanych fraz (komunikaty z liczbami / adresami, bledy serwera).
// Statyczna czesc strony (teksty i podpowiedzi z index.html) tlumaczona raz przy starcie - zmiana jezyka przeladowuje.

const KEY = 'vizu.lang';
export const LANGS = { pl: 'PL', en: 'EN' };
export const lang = (() => { try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'pl'; } catch { return 'pl'; } })();
export function setLang(l) {
  try { localStorage.setItem(KEY, l); } catch { /* bez pamieci przegladarki */ }
  location.reload();
}

// Cale teksty: PL -> EN
const EN = {
  // pasek, okna, ekrany
  Boczkarka: 'Edge polisher', 'Boczkarka Visu3D': 'Edge polisher Visu3D',
  'Boczkarka profilowa Promasz B1PK – wizualizacja': 'Promasz B1PK profile edge polisher – visualization',
  'Online – pozycje i stany z PLC (OPC UA)': 'Online – positions and states from PLC (OPC UA)',
  'Offline – symulacja cyklu bez PLC': 'Offline – cycle simulation without PLC',
  'Połączenie z PLC – adres IP serwera OPC UA': 'PLC connection – OPC UA server IP address', 'Połączenie z PLC': 'PLC connection',
  Alarmy: 'Alarms', 'Ręczny – okno, które można przesuwać i zamknąć': 'Manual – movable window', PAUZA: 'PAUSE',
  'Tempo symulacji': 'Simulation speed', Niezalogowany: 'Not logged in', Zaloguj: 'Log in', Wyloguj: 'Log out',
  Automat: 'Automatic', Ręczny: 'Manual', Serwis: 'Service', 'Serwis – parametry': 'Service – parameters',
  Izometria: 'Isometric', 'Z przodu (od operatora)': 'Front (operator side)', 'Z boku – przekrój profilu': 'Side – profile section',
  'Z góry': 'Top', 'Kamera podąża za głowicą': 'Camera follows the head',
  'Przekrój krawędzi': 'Edge cross-section', 'Nowa, nieobrobiona płyta na widoku': 'New, unprocessed slab in view',
  'Nowy kamień': 'New stone', 'Sterowanie PLC': 'PLC control', 'Reset alarmów': 'Reset alarms',
  'Obroty aktywnej receptury – zmiana działa od razu, także w trakcie cyklu': 'Spindle speed of the active recipe – applies immediately, also during the cycle',
  'Symulacja – receptura': 'Simulation – recipe', Receptura: 'Recipe', Rodzaj: 'Profile', Strona: 'Side',
  'Strona krawędzi: góra, dół (kąty B ujemne / tarcza odwrócona) albo obie': 'Edge side: top, bottom (negative B angles / inverted wheel) or both',
  'X start [mm]': 'X start [mm]', 'X koniec [mm]': 'X end [mm]', 'Naddatek [mm]': 'Overtravel [mm]', 'Posuw [m/min]': 'Feed [m/min]',
  'Obroty [Hz]': 'Speed [Hz]', Powtórzenia: 'Repeats', 'Kąt fazy [°]': 'Chamfer angle [°]', 'Kąt od [°]': 'Angle from [°]',
  'Kąt do [°]': 'Angle to [°]', 'Krok kąta [°]': 'Angle step [°]', 'Polerowanie (etapy)': 'Polishing (stages)',
  'Etapy polerowania po kształcie: wymiana narzędzia, potem ta sama lista przejść': 'Polishing stages after shaping: tool change, then the same pass list',
  'Profil tarczą kształtową: przejście przy B = 0 (powtórzenia – zgrubne i wykańczające), potem etapy polerowania.': 'Form-wheel profile: pass at B = 0 (repeats – roughing and finishing), then polishing stages.',
  'Przejścia w obie strony': 'Passes in both directions', 'Potwierdzenie po STOP / błędzie receptury': 'Acknowledge after STOP / recipe error',
  Kasuj: 'Acknowledge', 'Trzymaj – jazda w lewo': 'Hold – move left', 'Trzymaj – jazda w prawo': 'Hold – move right',
  'Trzymaj – kąt w dół': 'Hold – angle down', 'Trzymaj – kąt w górę': 'Hold – angle up', 'Jog szybko': 'Fast jog', Dojazd: 'Positioning',
  'X cel [mm]': 'X target [mm]', 'B cel [°]': 'B target [°]', 'Jedź X': 'Move X', 'Ustaw B': 'Set B',
  'Wrzeciono i media': 'Spindle and media', Wrzeciono: 'Spindle', Woda: 'Water', Docisk: 'Clamp',
  'Adres IP serwera OPC UA': 'OPC UA server IP address', 'Adres z config.json': 'Address from config.json', Połącz: 'Connect',
  Domyślny: 'Default', Zamknij: 'Close', Aktywne: 'Active', Historia: 'History', Kwituj: 'Acknowledge',
  'Potwierdzenie wszystkich wpisów historii': 'Acknowledge all history entries', Logowanie: 'Login', Użytkownik: 'User',
  Hasło: 'Password', Anuluj: 'Cancel', 'Krok:': 'Step:', 'Przejście:': 'Pass:', 'Czas:': 'Time:', 'Licznik:': 'Counter:',
  Nr: 'No.', Alarm: 'Alarm', Wystąpił: 'Raised', Ustąpił: 'Cleared', 'Kwit.': 'Ack.', aktywny: 'active', TAK: 'YES', NIE: 'NO',
  WZNÓW: 'RESUME', 'Symulacja offline': 'Offline simulation', 'Serwer bez PLC – tylko offline': 'Server without PLC – offline only',
  'Serwer uruchomiony bez PLC (--no-plc).': 'Server started without PLC (--no-plc).',
  'Wersja bez serwera – dostępna tylko symulacja offline.': 'Version without server – offline simulation only.',
  'Wpisz adres IP serwera OPC UA (sterownika)': 'Enter the OPC UA server (controller) IP address',
  'Brak połączenia z serwerem VizuApp': 'No connection to the VizuApp server', 'Łączenie…': 'Connecting…', 'Łączenie...': 'Connecting...',
  'Automat pracuje – jog po zatrzymaniu': 'Automatic cycle running – jog after stop',
  'Automat pracuje – polecenie po zatrzymaniu': 'Automatic cycle running – command after stop',
  'Offline: osie symulatora, gdy automat stoi.': 'Offline: simulator axes, while the automatic cycle is stopped.',
  'Online: jog i dojazdy w trybie Ręczny (przełącznik na ekranie Automat).': 'Online: jog and positioning in Manual mode (switch on the Automatic screen).',
  'Parametry trwałe PLC – zapis po zmianie pola (zakres sprawdzany na stronie i w serwerze).': 'Persistent PLC parameters – saved on field change (range checked on the page and in the server).',
  'Offline: parametry symulatora (te, które mają odpowiednik w trybie offline).': 'Offline: simulator parameters (those with an offline equivalent).',
  'Historia alarmów jest zapisywana w bazie serwera VizuApp (alarms.db) przy pracy z PLC.': 'Alarm history is stored in the VizuApp server database (alarms.db) when working with the PLC.',
  'Symulacja: logowanie bez hasła (bez dostępu do PLC). W trybie PLC – hasło.': 'Simulation: login without password (no PLC access). In PLC mode – password.',
  'Wersja demonstracyjna: wybór konta bez hasła – pokazuje i ukrywa funkcje jak na maszynie.': 'Demo version: choose an account without password – shows and hides functions as on the machine.',
  'Sterowanie po zalogowaniu (Operator).': 'Control after login (Operator).', 'Złe hasło': 'Wrong password',
  'Brak aktywnych alarmów': 'No active alarms', kształt: 'shaping', polerowanie: 'polishing',
  docisk: 'clamp', woda: 'water', 'powt.': 'rep.',
  // poziomy, tryby, strony
  Podgląd: 'View only', Operator: 'Operator', Admin: 'Admin', Góra: 'Top', Dół: 'Bottom', 'Obie strony': 'Both sides',
  // kroki automatu (EdgeStep)
  'Gotowy - czeka na START': 'Ready - waiting for START', 'Sprawdzanie receptury': 'Checking recipe', 'Rozruch wrzeciona': 'Spindle start',
  'Dojazd na start': 'Moving to start', 'Zmiana kąta B': 'B angle change', 'Przejazd roboczy': 'Working pass', 'Następne przejście': 'Next pass',
  'Powrót (jeden kierunek)': 'Return (one direction)', 'Wymiana narzędzia – START': 'Tool change – START', 'Autopowrót B': 'Auto return B',
  'Autopowrót X': 'Auto return X', 'Zatrzymanie wrzeciona': 'Spindle stop', 'Koniec cyklu': 'End of cycle',
  'Zatrzymany - skasuj alarmy': 'Stopped - reset alarms',
  // profile i receptury
  'Bok prosty': 'Straight edge', 'Faza górna': 'Top chamfer', 'Faza dolna': 'Bottom chamfer', 'Faza górna 45': 'Top chamfer 45',
  'Faza górna 30': 'Top chamfer 30', 'Faza dolna 45': 'Bottom chamfer 45', 'Ćwierćwałek górny': 'Top quarter round',
  'Ćwierćwałek dolny': 'Bottom quarter round', Półwałek: 'Half round (1/2 Bullnose)', Własny: 'Custom',
  'Europejski': 'European', 'Faza na pół grubości': '1/2 Bevel', 'Zaokrąglenie małe': '1/4 Round', 'Wałek ćwiartkowy': '1/4 Bullnose', 'Wałek spłaszczony': 'Demi Bullnose', 'Wklęsły': 'Cove', 'Wklęsły ze stopniem': 'Cove Dupont', 'Wklęsło-wypukły': 'Cove Ogee', 'Esownica głęboka': 'Deep Ogee', 'Stopień zaokrąglony': 'Dupont', 'Esownica płaska': 'Flat Ogee', 'Esownica': 'Ogee', 'Esownica z wałkiem': 'Ogee Bullnose', 'Kaskadowy': 'Waterfall',
  // walidacja receptury (kody PLC)
  'Początek pola ≥ koniec': 'Field start ≥ end', 'Kąt poza zakresem osi B': 'Angle outside the B axis range',
  'Brak przejść / za dużo przejść': 'No passes / too many passes', 'Posuw poza zakresem': 'Feed out of range',
  'Obroty poza zakresem': 'Speed out of range', 'Liczba powtórzeń < 1': 'Repeats < 1', 'Pole poza zakresem osi X': 'Field outside the X axis range',
  'Etapy polerowania poza zakresem': 'Polishing stages out of range',
  // alarmy (AlarmControl)
  'E-STOP wciśnięty': 'E-STOP pressed', 'Brak gotowości obwodu bezpieczeństwa / STO': 'Safety circuit / STO not ready', 'Osłona otwarta': 'Guard open',
  'Błąd serwa X': 'X servo fault', 'Błąd serwa B': 'B servo fault', 'X: krańcówka / softlimit': 'X: limit switch / soft limit',
  'B: krańcówka / softlimit': 'B: limit switch / soft limit', 'Osie nie gotowe przy starcie automatu (brak załączenia / błąd)': 'Axes not ready at automatic start (not enabled / fault)',
  'Błąd falownika wrzeciona': 'Spindle inverter fault', 'Przeciążenie wrzeciona': 'Spindle overload', 'Wrzeciono nie osiągnęło obrotów': 'Spindle did not reach speed',
  'Brak wody / powietrza': 'No water / air', 'Błąd komunikacji EtherCAT': 'EtherCAT communication fault', 'Niepoprawna receptura': 'Invalid recipe',
  'Przekroczony czas kroku automatu': 'Automatic step timeout',
  // parametry serwisowe
  'Oś X': 'X axis', 'Oś B': 'B axis', 'Wrzeciono (MS300)': 'Spindle (MS300)', Maszyna: 'Machine', Softlimity: 'Soft limits',
  'Softlimit −': 'Soft limit −', 'Softlimit +': 'Soft limit +', 'Prędkość max': 'Max velocity', Przyspieszenie: 'Acceleration',
  'Hamowanie STOP': 'STOP deceleration', Jerk: 'Jerk', 'Jog wolno': 'Slow jog', 'Dojazdy i powrót': 'Positioning and return',
  'Pozycja załadunku': 'Loading position', 'Zmiana kąta': 'Angle change', 'Kąt po autopowrocie': 'Angle after auto return',
  'Liczba biegunów': 'Number of poles', 'Częstotliwość min': 'Min frequency', 'Częstotliwość max': 'Max frequency',
  'Tolerancja obrotów': 'Speed tolerance', 'Czas rozruchu max': 'Max start-up time', 'Rampa (symulacja)': 'Ramp (simulation)',
  'Skala prądu': 'Current scale', 'Prąd znamionowy': 'Rated current', 'Prąd przeciążenia': 'Overload current', 'Czas przeciążenia': 'Overload time',
  'Ustalenie docisku': 'Clamp settling', 'Woda po zatrzymaniu': 'Water after stop', Autopowrót: 'Auto return', 'Posuw min': 'Min feed',
  'Posuw max': 'Max feed', 'Osłona z czujnikiem': 'Guard with sensor', 'Czujnik wody': 'Water sensor', 'Czujnik powietrza': 'Air sensor',
  'Potencjometr posuwu': 'Feed potentiometer', 'AI dla 10 V': 'AI for 10 V', 'Posuw max z potencjometru': 'Max feed from potentiometer',
  'Symulacja (po restarcie PLC)': 'Simulation (after PLC restart)',
};

// Frazy w komunikatach z liczbami / adresami i w bledach z serwera (najdluzsze najpierw)
const PHRASES = Object.entries({
  'Hasła nieustawione (brak users.json) – logowanie bez hasła tylko na komputerze z VizuApp. Hasło:': 'Passwords not set (no users.json) – passwordless login only on the VizuApp computer. Password:',
  'Wymień narzędzie na polerkę': 'Change the tool to polisher', 'i naciśnij START.': 'and press START.',
  'Zaloguj się, żeby sterować maszyną': 'Log in to control the machine', 'Zaloguj się, żeby kwitować alarmy': 'Log in to acknowledge alarms',
  'Zmiana adresu PLC – zaloguj jako Serwis albo Admin': 'PLC address change – log in as Service or Admin',
  'Zmiana adresu PLC tylko na komputerze z VizuApp': 'PLC address change only on the VizuApp computer',
  'zmienna spoza listy sterowania': 'variable outside the control list', 'zapis od poziomu Serwis': 'write requires Service level',
  'bez hasła tylko na komputerze z VizuApp': 'without password only on the VizuApp computer', 'brak hasła – ustaw:': 'no password – set:',
  'Brak połączenia: zerwane połączenie z': 'No connection: connection lost to', 'Brak połączenia:': 'No connection:',
  'brak połączenia z PLC': 'no connection to PLC', 'Zły adres – np.': 'Wrong address – e.g.', 'Połączono': 'Connected',
  'Łączenie z': 'Connecting to', 'zmienne': 'variables', 's pozostało': 's remaining', 'Wpisów:': 'Entries:',
  'niepotwierdzonych:': 'unacknowledged:', 'Zapisano:': 'Saved:', 'Historia:': 'History:', 'Połączenie:': 'Connection:',
  'Strona w sieci:': 'Page on the network:', 'Adres:': 'Address:', '(domyślny': '(default', 'Obroty:': 'Speed:', 'Receptura:': 'Recipe:',
  'oczekiwano liczby całkowitej': 'expected an integer', 'oczekiwano liczby': 'expected a number', 'oczekiwano TAK / NIE': 'expected YES / NO',
  'poniżej': 'below', 'powyżej': 'above', 'polerowanie': 'polishing', 'kształt': 'shaping', 'cykli': 'cycles',
}).sort((a, b) => b[0].length - a[0].length);

const ascii = (x) => x.replace(/ł/g, 'l').replace(/Ł/g, 'L').normalize('NFKD').replace(/[̀-ͯ]/g, '');
const EN_ASCII = Object.fromEntries(Object.entries(EN).map(([k, v]) => [ascii(k), v]));

export function t(text) {
  if (lang === 'pl' || text === null || text === undefined) return text;
  const s = String(text);
  if (EN[s] !== undefined) return EN[s];
  if (EN_ASCII[s] !== undefined) return EN_ASCII[s];	// nazwy z PLC (STRING bez polskich znakow)
  let out = s;
  for (const [pl, en] of PHRASES) if (out.includes(pl)) out = out.split(pl).join(en);
  // pojedyncze slowa ze slownika w etykietach "A · B"
  return out.split(' · ').map((p) => EN[p] ?? p).join(' · ');
}

// Statyczna czesc strony: teksty wezlow i atrybuty title / placeholder / aria-label
export function translatePage(root = document.body) {
  document.documentElement.lang = lang;
  if (lang === 'pl') return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const raw = n.nodeValue;
    const trimmed = raw.trim();
    if (!trimmed || n.parentElement?.closest('script, style')) continue;
    const tr = t(trimmed);
    if (tr !== trimmed) n.nodeValue = raw.replace(trimmed, tr);
  }
  for (const el of root.querySelectorAll('[title], [placeholder], [aria-label]')) {
    for (const a of ['title', 'placeholder', 'aria-label']) if (el.hasAttribute(a)) el.setAttribute(a, t(el.getAttribute(a)));
  }
  document.title = t(document.title);
}
