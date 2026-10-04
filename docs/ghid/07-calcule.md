# 7. Calculele

Toate calculele se fac în telefon, în TypeScript, ca să meargă offline. Sunt funcții simple, fără ecrane, în `web/src/lib/`, și fiecare are teste lângă ea (`*.test.ts`).

Exemplele de mai jos folosesc datele reale din testul aplicației: varianta „Omletă cu spanac · 350 kcal” și planul „Plan B”.

## Valorile unei variante

Varianta are gramele pentru toată rețeta și numărul de porții. Alimentele au valorile la 100 g.

| Ingredient | Grame | kcal la 100 g | kcal în rețetă |
|---|---|---|---|
| Ou întreg | 167 | 143 | 143 × 167 / 100 = **238,8** |
| Spanac | 100 | 23 | **23** |
| Ulei de măsline | 10 | 884 | **88,4** |
| **Total** | 277 | | **350,2** |

Cu 1 porție, o porție are 350 kcal. Cu 2 porții, ar avea 175. La fel se calculează proteinele, carbohidrații, grăsimile, fibrele și sodiul.

```ts
export function forGrams(food: Food, grams: number): Nutrients {
  return scale(per100(food), grams / 100)
}
```

Funcția întreagă e `variantTotals` din `nutrition.ts`.

## Notele unei variante

### Proteina și volumul: din totalurile variantei

Se calculează la fel ca la un aliment, dar din totalurile rețetei. Proteina: ce parte din calorii vine din proteină (fiecare gram are 4 kcal). Volumul: câte calorii are la 100 g.

| | Cu 10 g ulei | Fără ulei |
|---|---|---|
| kcal | 350,2 | 261,8 |
| grame | 277 | 267 |
| proteine | 24 g | 23,9 g |
| % din calorii din proteină | 96 / 350,2 = 27% → **B** | 95,6 / 261,8 = 37% → **A** |
| kcal la 100 g | 126 → **A** | 98 → **A** |

Uleiul nu adaugă proteină, dar adaugă un sfert din calorii, deci partea proteinei scade sub 30%. Codul e în `proteinGrade`, `volumeGrade` și `variantGrades` din `nutrition.ts`.

### Nota glicemică: media ponderată după carbohidrați

Glicemia urcă din cauza carbohidraților, deci fiecare ingredient contează după carbohidrații pe care îi aduce. A = 1, B = 2, C = 3. Media se rotunjește: sub 1,5 dă A, sub 2,5 dă B, altfel C.

Regula în plus: dacă o porție are sub 5 g de carbohidrați, nota e **A**. Omleta are 4,8 g pe porție, deci are A.

Un exemplu cu carbohidrați: 100 g pâine albă (49 g carbohidrați, C) și 50 g măr (7 g carbohidrați, A). Media e (49 × 3 + 7 × 1) / 56 = 2,75, deci nota **C**. Pâinea domină.

## Alternativele unui ingredient

La butonul de schimbare de lângă spanac, aplicația propune:
- **Ciuperci champignon · 105 g**
- **Dovlecel · 135 g**

Pașii din `alternativesFor`:
1. **Aceeași categorie.** Spanacul e „legume”, deci se caută doar printre legume. Căpșunile sunt „fructe de pădure”, deci roșiile nu au cum să apară.
2. **Fără ce ai exclus tu.**
3. **Cele mai apropiate ca fel de calorii.** Pentru fiecare aliment, aplicația calculează ce parte din calorii vine din proteine, din carbohidrați și din grăsimi. Spanacul are cam jumătate din calorii din proteine. Ciupercile au tot cam jumătate, deci sunt aproape. La distanță se adună puțin și diferența de calorii la 100 g.
4. **Aceleași calorii.** Gramajul se ajustează: 100 g spanac au 23 kcal; ciupercile au 22 kcal la 100 g, deci 100 × 23 / 22 = 105 g.

## Țintele zilnice

Exemplu: bărbat, 30 de ani, 180 cm, 85 kg, ușor activ, slăbire cu 0,5 kg pe săptămână.

| Pas | Calcul | Rezultat |
|---|---|---|
| Metabolism bazal (Mifflin-St Jeor) | 10 × 85 + 6,25 × 180 − 5 × 30 + 5 | 1830 kcal |
| × activitate (ușor activ) | 1830 × 1,375 | 2516 kcal |
| − ritmul (0,5 kg pe săptămână) | 2516 − 0,5 × 7700 / 7 = 2516 − 550, rotunjit la zeci | **1970 kcal** |
| Proteine (2 g/kg la slăbire) | 85 × 2 | **170 g** |
| Grăsimi (0,8 g/kg) | 85 × 0,8 | **68 g** |
| Carbohidrați (ce rămâne) | (1970 − 170 × 4 − 68 × 9) / 4 | **170 g** |
| Fibre (14 g la 1000 kcal) | 1970 / 1000 × 14 | **28 g** |
| Sodiu (limită) | | **2300 mg** |

Un kilogram de grăsime are cam 7.700 kcal, deci 0,5 kg pe săptămână înseamnă 3.850 kcal pe săptămână, adică 550 pe zi. Dacă ritmul ar coborî ținta sub metabolismul bazal (1830 aici), ținta rămâne la metabolismul bazal. Proteinele și carbohidrații au 4 kcal pe gram, grăsimile 9. Funcțiile sunt `energyPlan` și `computeTargets` din `targets.ts`. După calcul, poți schimba orice număr de mână, în Profil.

## Obiectivul: cât mai ai și când ajungi

Cu 85 kg la pornire, 78 kg țintă și 0,5 kg pe săptămână:

| Ce | Calcul | Rezultat |
|---|---|---|
| Drumul întreg | 85 − 78 | 7 kg |
| Cât ai făcut | pornire − media pe 7 zile de azi | 0 kg (0%) |
| Data cu ritmul ales | 7 kg / 0,5 kg = 14 săptămâni = 98 de zile de azi | 10 ianuarie 2027 |
| Ritmul real | diferența dintre media pe 7 zile de acum 4 săptămâni (sau de la pornire) și cea de azi, împărțită la săptămâni | apare după 2 săptămâni de cântăriri |

Greutatea „de azi” e media pe 7 zile, nu ultima cântărire, pentru că de la o zi la alta greutatea sare cu 1–2 kg din apă. Codul e în `goalProgress` și `weeklyRate` din `goals.ts`.

## Cât mai ai azi

Fiecare intrare din jurnal **își copiază valorile** în momentul în care o notezi. Ecranul Azi doar adună intrările zilei și le scade din țintă:

```
1970 − 457 (omletă 350 + banană 107) = 1513 kcal rămase
```

Copia contează: dacă mâine schimbi varianta omletei, ce ai notat ieri rămâne cum era. Dacă schimbi cantitatea unei intrări, valorile se recalculează din aliment.

## Lista de cumpărături

„Plan B × 5 zile”, unde Plan B are la micul dejun 1 porție de omletă și o banană de 120 g:

| Ce | Calcul | Pe listă |
|---|---|---|
| Ou întreg | 167 g pe porție × 1 porție × 5 zile | **835 g ≈ 16 buc** (835 / 55, rotunjit în sus) |
| Spanac | 100 × 1 × 5 | **500 g** |
| Ulei de măsline | 10 × 1 × 5 | **50 g ≈ 5 linguri** |
| Banană (aliment simplu) | 120 × 5 | **600 g ≈ 5 buc** |

Regulile din `shopping.ts`:
- grame pe porție = gramele variantei / porțiile variantei;
- lista se grupează pe rețete, iar alimentele simple au grupul lor, la final. Același aliment din două rețete apare în ambele grupuri, ca să știi pentru ce îl cumperi;
- „≈ buc” apare doar la alimentele care au greutatea unei bucăți. La uleiuri, sosuri și dulciuri scrie „linguri”.

## Căutarea

`search.ts` caută fără diacritice și acceptă o greșeală de tastare:
- „branza” găsește „Brânză de vaci”: diacriticele se scot din ambele texte înainte de comparare;
- „bnana” găsește „Banană”: la cuvintele de minim 4 litere, se acceptă o literă greșită, lipsă sau în plus;
- „piept curcan” găsește doar ce conține ambele cuvinte;
- rezultatele în care un cuvânt **începe** cu ce ai scris apar primele.

## Testele

```bash
pnpm --dir web test
```

Fiecare regulă de mai sus are un test cu nume care spune regula. De exemplu: `weighs the weight-loss score by calories, so a little oil still counts` sau `stays in the same category`.
