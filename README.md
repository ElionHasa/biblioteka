# Biblioteka “Genc Leka”

Website për bibliotekën e shkollës: katalogu i librave, llogaritë e nxënësve dhe paneli i administratorit (huazime, kthime, afate).

## Nisja

Duhet Node.js 22.13 ose më i ri (databaza SQLite është e integruar në Node).

```
npm install
npm start
```

Hapet në http://localhost:3000.

| Faqja | Çfarë bën |
|---|---|
| `/` | Librat, kërkimi, kategoritë, orari dhe të dhëna për bibliotekën |
| `/regjistrohu.html` | Nxënësi krijon llogari (emër, mbiemër, klasë, fjalëkalim) |
| `/hyr.html` | Hyrja e nxënësit |
| `/llogaria.html` | Nxënësi shikon librat që ka huazuar dhe afatet |
| `/admin.html` | Paneli i administratorit. Nuk ka link në menu, gjendet vetëm te footer-i (“Hyrja e administratorit”) |

## Fjalëkalimi i administratorit

Herën e parë që niset, serveri krijon një fjalëkalim të rastësishëm dhe e shfaq në terminal. Ruaje. Për ta ndryshuar:

```
npm run set-password -- "fjalëkalimi_i_ri"
```

## Nxënësit

Nxënësi hyn me emrin, mbiemrin, klasën dhe fjalëkalimin. Nëse harron fjalëkalimin, administratori e ndryshon te **Nxënësit → Ndrysho fjalëkalimin**.

## Librat demo

Herën e parë biblioteka mbushet me 19 libra demo. Për t'i hequr: **Librat → Fshi librat demo**. Çdo libër demo që e modifikon ti e humb shenjën “demo” dhe nuk fshihet bashkë me ta.

## Orari dhe të dhënat në sidebar

Orari është shembull. Ndryshoje te `public/app.js`, sipër te `OPEN` dhe `HOURS`. Teksti i hapave “Si të huazosh” është te `public/index.html`.

## Dizajni (Tailwind CSS)

Stili ndërtohet me Tailwind dhe skedari i gatshëm është `public/tailwind.css`, ndaj nuk duhet asgjë shtesë për ta nisur faqen. Nëse ndryshon klasat në HTML ose JS, rindërtoje:

```
npm run build:css
```

ose lëre të punojë vazhdimisht gjatë ndryshimeve: `npm run watch:css`. Ngjyrat dhe fontet janë te `tailwind.config.js`. Fontet (Fraunces dhe Plus Jakarta Sans, licencë OFL) ruhen lokalisht te `public/fonts`, pa varësi nga interneti.

## Të dhënat dhe siguria

- Gjithçka ruhet në një skedar: `data/biblioteka.db`. Për kopje rezervë kopjoje kur serveri është i ndalur.
- Fjalëkalimet ruhen të hash-uara (scrypt). Sesionet e nxënësve dhe të administratorit janë të ndara dhe kontrollohen në server.
- Serveri dëgjon në të gjithë rrjetin (`HOST=0.0.0.0`). Për ta lënë vetëm në këtë kompjuter: `HOST=127.0.0.1 npm start`. Pa HTTPS fjalëkalimet shkojnë të pa-enkriptuara në rrjet; për përdorim jashtë rrjetit të shkollës vendose pas një proxy me HTTPS.
- Formati i klasës është `7/A` (ose `7`). Ndryshoje te `parseIdentity` në `server.js` nëse shkolla përdor format tjetër.
