# Instalare pe hosting

## Cerințe

Server HTTP cu HTTPS: Apache 2.4, nginx sau IIS 10 cu modulul URL Rewrite.
Nu sunt necesare PHP, Node.js, Python sau o bază de date pe serverul de producție.
Fișierele site-ului ocupă aproximativ 136 MiB; păstrați spațiu și pentru o copie de rezervă.

Harta solicită resurse de la `https://tiles.openfreemap.org` direct din browserul vizitatorului.
Fonturile, imaginile, biblioteca MapLibre, videoclipurile și documentele sunt locale.
Limba implicită este engleza. Parametrul `?lang=ro` selectează româna; `?lang=en` selectează engleza.
Alegerea nu se memorează în browser. Site-ul nu include autentificare sau formulare de colectare.

## Publicare

1. Dezarhivați pachetul într-un director nou și verificați versiunea din `RELEASE.json`.
2. Publicați **conținutul directorului `site/`** în rădăcina web a domeniului dedicat.
   `server/`, `licenses/` și documentația se păstrează în afara rădăcinii web.
3. Instalați configurația pentru serverul folosit, conform tabelului de mai jos.
4. Configurați domeniul și certificatul TLS. Configurațiile presupun că HTTPS se termină pe acest server.
   Dacă instituția folosește un reverse proxy, IT adaptează redirecționarea și antetele la infrastructură.
5. Verificați funcționarea la adresa finală înainte de anunțarea publicării.

| Server | Configurație |
|---|---|
| Apache | Copiați `server/apache.htaccess` ca `.htaccess` lângă `index.html`. Sunt necesare mod_headers, mod_mime și mod_rewrite, cu AllowOverride corespunzător, sau preluarea regulilor în VirtualHost. Redirecționarea HTTPS este comentată; activați-o după instalarea certificatului, dacă nu este deja asigurată de VirtualHost/proxy. |
| nginx | Includeți `server/nginx-zarea.conf` în contextul `http`. Înlocuiți domeniul exemplu, rădăcina și căile certificatului. Rulați `nginx -t`, apoi reîncărcați serviciul. |
| IIS | Copiați `server/web.config` ca `web.config` lângă `index.html`. Activați Static Content și URL Rewrite; pentru `removeServerHeader` este necesară o versiune IIS care suportă opțiunea. |

Fișierele folosesc adrese relative. Instrucțiunile și exemplul nginx sunt pentru rădăcina unui domeniu;
publicarea într-un subdirector necesită adaptarea regulilor serverului.

## Verificare după instalare

- HTTP redirecționează către HTTPS, iar certificatul este valid.
- Pagina se încarcă pe desktop și mobil, în EN și RO; meniul și comparațiile foto/concept funcționează.
- Harta 3D și ambele galerii se încarcă; filmele pornesc și permit deplasarea în timp.
- PDF-urile sunt accesibile. Răspunsurile pentru MP4 au `Content-Type: video/mp4` și suportă cereri Range (206).
- HTML, CSS, JavaScript, JSON și erorile 404 includ antetele CSP, HSTS, X-Frame-Options și X-Content-Type-Options.
- `/.git/HEAD`, directoarele interne și listarea `/assets/docs/` nu sunt accesibile public.
- Consola browserului nu arată resurse lipsă sau încălcări CSP.

Configurația nginx este verificată automat într-un mediu Linux de test. Apache și IIS sunt configurații
de referință care trebuie verificate de IT în mediul folosit. Verificările automate nu înlocuiesc
verificarea domeniului, certificatului și eventualului proxy de producție.

## Actualizare și revenire

La o actualizare, descărcați ultima Release reușită, păstrați copia versiunii publicate și instalați noul
director `site/` complet. Fișierele se revalidează prin cache; goliți și cache-ul unui eventual CDN/proxy.
Evitați copierea treptată peste site-ul activ: folosiți directoare de versiune și comutați rădăcina/symlinkul
după verificare, conform procedurii IT. Revenirea constă în reactivarea directorului versiunii precedente.

Actualizarea repository-ului generează pachetul, dar instalarea pe hosting rămâne responsabilitatea IT.
Prețurile, termenele și documentele sunt validate de responsabilul de conținut.

## Integritate

`hotel-zarea-current.zip.sha256` permite verificarea arhivei. În interior, `SHA256SUMS.txt` conține
sumele SHA-256 ale fișierelor, iar `RELEASE.json` identifică sursa exactă.
În Linux/macOS: `shasum -a 256 hotel-zarea-current.zip`. În PowerShell:
`Get-FileHash hotel-zarea-current.zip -Algorithm SHA256`. Comparați rezultatul cu fișierul `.sha256`.
