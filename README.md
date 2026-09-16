# Hotel Zarea

Site de prezentare a Hotelului Zarea pentru cumpărători și investitori, în engleză și română.
HTML, CSS și JavaScript static, fără backend, bază de date sau compilare.

## Descărcare pentru hosting

[Deschide versiunea curentă](https://github.com/Cara9876/hotel-zarea/releases/latest) și descarcă **hotel-zarea-current.zip**.
Arhiva include site-ul, configurațiile de server, instrucțiunile de instalare și sumele de control.
Pentru instalare se folosesc fișierele din `site/`. Instrucțiuni complete: [DEPLOYMENT.md](DEPLOYMENT.md).

Repository-ul este privat. Linkurile GitHub funcționează pentru conturile cărora li s-a acordat acces.
Arhiva ZIP poate fi transmisă separat echipei IT.

## Structură

| Director | Conținut |
|---|---|
| `site/` | Fișierele publicate pe hosting |
| `site/data/` | Datele proprietății și listele media |
| `site/js/i18n-ro.js` | Traducerea română |
| `server/` | Configurații Apache, nginx și IIS |
| `licenses/` | Licențele componentelor externe |
| `tools/` | Verificarea și împachetarea versiunilor |

## Previzualizare locală

Cu Python 3 instalat, din rădăcina proiectului:

```sh
python3 -m http.server 8766 --directory site --bind 127.0.0.1
```

Deschide `http://localhost:8766/`. Acest server este doar pentru verificare locală.

## Actualizări

Modificările se fac în acest repository. Prețul, termenele, contactele și lista documentelor sunt în
`site/data/site.json`; textele paginii sunt în `site/index.html`, iar traducerile în `site/js/i18n-ro.js`.
Galeriile folosesc `site/data/media.json` și `site/data/concept-media.json`.

La fiecare push pe `main`, GitHub Actions verifică fișierele și configurația nginx, apoi creează o Release
cu un ZIP actualizat. Linkul „versiunea curentă” indică ultima Release reușită. Dacă verificarea eșuează,
versiunea anterioară rămâne disponibilă; eroarea se vede în fila Actions. Acest proces pregătește pachetul,
dar nu publică automat pe serverul instituției.

Pentru împachetare locală, după commit:

```sh
python3 tools/package.py --version 2026.09.16
```

Rezultatul apare în `dist/`. Fiecare pachet conține în `RELEASE.json` versiunea și commitul sursă.

## Conținut și componente

Fotografiile și filmele clădirii existente sunt prezentate separat de conceptele arhitecturale.
Etichetele „Architectural concept. Not an approved project.” și echivalentul român se păstrează.
Datele tranzacției trebuie reconfirmate de responsabilul de conținut înainte de publicare și când se modifică.

Harta folosește OpenFreeMap și OpenStreetMap; bibliotecile și fonturile sunt găzduite local.
Vezi [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
