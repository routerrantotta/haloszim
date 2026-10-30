/* Haloszim v0.2.0 – routerrantotta.hu – minden jog fenntartva. */
(() => {
  // src/mag/ido.js
  var Ora = class {
    constructor() {
      this.ido = 0;
      this.sor = [];
      this.kovetkezoSorszam = 0;
    }
    /**
     * Beütemez egy teendőt, ami `kesleltetes` ms múlva fut le.
     * @param {number} kesleltetes
     * @param {() => void} teendo
     * @returns {Esemeny} – ezzel később visszavonható (lemond)
     */
    utemez(kesleltetes, teendo) {
      const esemeny = { mikor: this.ido + Math.max(0, kesleltetes), sorszam: this.kovetkezoSorszam++, teendo };
      this.sor.push(esemeny);
      this.sor.sort((a, b) => a.mikor - b.mikor || a.sorszam - b.sorszam);
      return esemeny;
    }
    /** Visszavon egy korábban beütemezett eseményt. */
    lemond(esemeny) {
      this.sor = this.sor.filter((e) => e !== esemeny);
    }
    /**
     * Előre lépteti az órát `ms` ezredmásodperccel, és közben sorban lefuttatja
     * az esedékes eseményeket (ha egy esemény újat ütemez, az is lefut, ha belefér).
     * @param {number} ms
     */
    lep(ms) {
      const cel = this.ido + Math.max(0, ms);
      while (this.sor.length > 0 && this.sor[0].mikor <= cel) {
        const esemeny = this.sor.shift();
        this.ido = esemeny.mikor;
        esemeny.teendo();
      }
      this.ido = cel;
    }
  };
  var HONAPOK = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function naploIdobelyeg(ms) {
    const osszMp = Math.floor(ms / 1e3);
    const nap = 1 + Math.floor(osszMp / 86400);
    const ora = Math.floor(osszMp % 86400 / 3600);
    const perc = Math.floor(osszMp % 3600 / 60);
    const mp = osszMp % 60;
    const ezred = Math.floor(ms % 1e3);
    const k = (n, h = 2) => String(n).padStart(h, "0");
    return `*${HONAPOK[2]} ${String(nap).padStart(2, " ")} ${k(ora)}:${k(perc)}:${k(mp)}.${k(ezred, 3)}`;
  }

  // src/cli/interfesznev.js
  function tipusIllesztes(elotag, tipusok) {
    const kis = elotag.toLowerCase();
    const nevek = Object.keys(tipusok);
    const pontos = nevek.find((n) => n.toLowerCase() === kis);
    if (pontos) return { tipus: pontos, jeloltek: [pontos] };
    const jeloltek = nevek.filter((n) => n.toLowerCase().startsWith(kis));
    if (jeloltek.length === 1) return { tipus: jeloltek[0], jeloltek };
    if (jeloltek.length === 0) return { hiba: "nincs", jeloltek };
    return { hiba: "ketertelmu", jeloltek };
  }
  function szamEllenorzes(szam, letezok) {
    const normal = szam.split("/").map((r) => String(Number(r))).join("/");
    if (letezok.includes(normal)) return { ok: true };
    const reszek = szam.split("/");
    const letezoReszek = letezok.map((s) => s.split("/"));
    let eltolas = 0;
    for (let i = 0; i < reszek.length; i++) {
      const elotag = reszek.slice(0, i + 1);
      const vanIlyen = letezoReszek.some((lr) => elotag.every((r, j) => lr[j] === String(Number(r)) && /^\d+$/.test(r)));
      if (!vanIlyen) return { ok: false, eltolas };
      eltolas += reszek[i].length + 1;
    }
    return { ok: false, eltolas: szam.length };
  }
  function interfeszElemez(tokenek, i, tipusok) {
    const t = tokenek[i];
    const m = /^([a-zA-Z-]+)(.*)$/.exec(t.szoveg);
    if (!m) return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet };
    const illesztes = tipusIllesztes(m[1], tipusok);
    if (illesztes.hiba === "ketertelmu") return { ok: false, hiba: "ketertelmu" };
    if (illesztes.hiba) return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet };
    const tipus = illesztes.tipus;
    let szam = m[2];
    let szamKezdet = t.kezdet + m[1].length;
    let kovetkezo = i + 1;
    if (szam === "") {
      const kov = tokenek[i + 1];
      if (!kov) return { ok: false, hiba: "hianyos" };
      szam = kov.szoveg;
      szamKezdet = kov.kezdet;
      kovetkezo = i + 2;
    }
    if (!/^\d+(\/\d+)*$/.test(szam)) {
      const rossz = szam.search(/[^\d/]/);
      return { ok: false, hiba: "ervenytelen", oszlop: szamKezdet + Math.max(0, rossz) };
    }
    const ell = szamEllenorzes(szam, tipusok[tipus]);
    if (!ell.ok) {
      if (ell.eltolas >= szam.length) return { ok: false, hiba: "hianyos" };
      return { ok: false, hiba: "ervenytelen", oszlop: szamKezdet + ell.eltolas };
    }
    const normalSzam = szam.split("/").map((r) => String(Number(r))).join("/");
    return { ok: true, nev: tipus + normalSzam, tipus, szam: normalSzam, kovetkezo };
  }
  function tartomanyElemez(szoveg, kezdet, tipusok) {
    const nevek = [];
    let pozicio = 0;
    const darabok = szoveg.split(",");
    for (let d = 0; d < darabok.length; d++) {
      const darab = darabok[d];
      const darabKezdet = kezdet + pozicio;
      pozicio += darab.length + 1;
      const vezeto = darab.length - darab.trimStart().length;
      const tiszta = darab.trim();
      if (tiszta === "") {
        return { ok: false, hiba: d === darabok.length - 1 ? "hianyos" : "ervenytelen", oszlop: darabKezdet + vezeto };
      }
      const m = /^([a-zA-Z-]+)(\s*)(\d+(?:\/\d+)*)?(?:(\s*-\s*)(\d+)?)?(.*)$/.exec(tiszta);
      const elemKezdet = darabKezdet + vezeto;
      const illesztes = tipusIllesztes(m ? m[1] : tiszta, tipusok);
      if (!m || illesztes.hiba === "nincs") return { ok: false, hiba: "ervenytelen", oszlop: elemKezdet };
      if (illesztes.hiba === "ketertelmu") return { ok: false, hiba: "ketertelmu" };
      const tipus = illesztes.tipus;
      const [, tipusSzoveg, koz1, szam, kotojel, veg, maradek] = m;
      const szamKezdet = elemKezdet + tipusSzoveg.length + koz1.length;
      if (!szam) {
        if (maradek) return { ok: false, hiba: "ervenytelen", oszlop: szamKezdet };
        return { ok: false, hiba: "hianyos" };
      }
      const ell = szamEllenorzes(szam, tipusok[tipus]);
      if (!ell.ok) {
        if (ell.eltolas >= szam.length && !kotojel && !maradek) return { ok: false, hiba: "hianyos" };
        return { ok: false, hiba: "ervenytelen", oszlop: szamKezdet + Math.min(ell.eltolas, szam.length) };
      }
      const vegKezdet = szamKezdet + szam.length + (kotojel ? kotojel.length : 0);
      if (maradek) return { ok: false, hiba: "ervenytelen", oszlop: vegKezdet + (veg ? veg.length : 0) };
      if (kotojel && !veg) return { ok: false, hiba: "hianyos" };
      const reszek = szam.split("/").map(Number);
      const elsoPort = reszek[reszek.length - 1];
      const utolsoPort = veg !== void 0 ? Number(veg) : elsoPort;
      const elotag = reszek.slice(0, -1).join("/");
      if (utolsoPort < elsoPort) return { ok: false, hiba: "ervenytelen", oszlop: vegKezdet };
      for (let p = elsoPort; p <= utolsoPort; p++) {
        const sz = (elotag ? elotag + "/" : "") + p;
        if (!tipusok[tipus].includes(sz)) return { ok: false, hiba: "ervenytelen", oszlop: vegKezdet };
        const nev = tipus + sz;
        if (!nevek.includes(nev)) nevek.push(nev);
      }
    }
    return { ok: true, nevek };
  }

  // src/cli/ertelmezo.js
  function szavakra(sor2) {
    const tokenek = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(sor2)) !== null) tokenek.push({ szoveg: m[0], kezdet: m.index });
    return tokenek;
  }
  var PARAM_TIPUSOK = {
    /** Egész szám egy tartományban, pl. <1-4094> */
    szam: {
      nev: (e) => e.nev || `<${e.min}-${e.max}>`,
      illeszt(e, tokenek, i) {
        const t = tokenek[i];
        if (!/^\d+$/.test(t.szoveg)) return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet };
        const n = Number(t.szoveg);
        if (n < e.min || n > e.max) return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet };
        return { ok: true, ertek: n, kovetkezo: i + 1 };
      },
      sugoElemek: (e) => [{ nev: PARAM_TIPUSOK.szam.nev(e), sugo: e.sugo }],
      reszleges: (e, r) => /^\d+$/.test(r) ? [PARAM_TIPUSOK.szam.nev(e)] : [],
      kiegeszit: () => null
    },
    /** Egyetlen szó (szóköz nélkül), pl. gépnév, VLAN-név */
    szo: {
      nev: (e) => e.nev || "WORD",
      illeszt(e, tokenek, i) {
        const t = tokenek[i];
        if (e.maxHossz && t.szoveg.length > e.maxHossz) {
          return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet + e.maxHossz };
        }
        return { ok: true, ertek: t.szoveg, kovetkezo: i + 1 };
      },
      sugoElemek: (e) => [{ nev: PARAM_TIPUSOK.szo.nev(e), sugo: e.sugo }],
      reszleges: (e) => [PARAM_TIPUSOK.szo.nev(e)],
      kiegeszit: () => null
    },
    /** Egy interfész, pl. fa0/1 vagy „FastEthernet 0/1” (egy vagy két szó) */
    interfesz: {
      illeszt(e, tokenek, i, sor2, kornyezet) {
        const r = interfeszElemez(tokenek, i, kornyezet.portTipusok || {});
        if (!r.ok) return r;
        return { ok: true, ertek: r.nev, kovetkezo: r.kovetkezo };
      },
      sugoElemek: (e, kornyezet) => tipusSugo(e, kornyezet),
      reszleges: (e, r, kornyezet) => interfeszReszleges(r, kornyezet),
      kiegeszit: (e, r, kornyezet) => interfeszKiegeszit(r, kornyezet)
    },
    /** Interfész-tartomány: az interface range utáni teljes szöveg */
    "interfesz-tartomany": {
      maradekot: true,
      illeszt(e, tokenek, i, sor2, kornyezet) {
        const kezdet = tokenek[i].kezdet;
        const r = tartomanyElemez(sor2.slice(kezdet), kezdet, kornyezet.portTipusok || {});
        if (!r.ok) return r;
        return { ok: true, ertek: r.nevek, kovetkezo: tokenek.length };
      },
      sugoElemek: (e, kornyezet) => tipusSugo(e, kornyezet),
      reszleges: (e, r, kornyezet) => interfeszReszleges(r, kornyezet),
      kiegeszit: (e, r, kornyezet) => interfeszKiegeszit(r, kornyezet)
    }
  };
  function tipusSugo(e, kornyezet) {
    const tipusok = Object.keys(kornyezet.portTipusok || {});
    const leirasok = kornyezet.tipusLeirasok || {};
    return tipusok.map((t) => ({ nev: t, sugo: leirasok[t] || t }));
  }
  function interfeszReszleges(r, kornyezet) {
    const tipusok = kornyezet.portTipusok || {};
    const m = /^([a-zA-Z-]+)(.*)$/.exec(r);
    if (!m) return [];
    if (m[2] === "") return tipusIllesztes(m[1], tipusok).jeloltek;
    const ill = tipusIllesztes(m[1], tipusok);
    if (!ill.tipus) return [];
    return szamReszleges(m[2], tipusok[ill.tipus]);
  }
  function szamReszleges(szam, letezok) {
    const reszek = szam.split("/");
    const melyikResz = reszek.length - 1;
    const elotag = reszek.slice(0, -1).join("/");
    const illok = letezok.filter((s) => s.startsWith(elotag ? elotag + "/" : ""));
    if (illok.length === 0) return [];
    const ertekek = [...new Set(illok.map((s) => Number(s.split("/")[melyikResz])))].sort((a, b) => a - b);
    const utolso = reszek[melyikResz];
    if (utolso !== "" && !ertekek.some((v) => String(v).startsWith(utolso))) return [];
    const teljes = utolso !== "" && ertekek.includes(Number(utolso));
    const vanMeg = illok.some((s) => s.split("/").length > melyikResz + 1);
    if (teljes && vanMeg) return ["/"];
    return [`<${ertekek[0]}-${ertekek[ertekek.length - 1]}>`];
  }
  function interfeszKiegeszit(r, kornyezet) {
    if (!/^[a-zA-Z-]+$/.test(r)) return null;
    const ill = tipusIllesztes(r, kornyezet.portTipusok || {});
    return ill.tipus || null;
  }
  function ujCsomopont() {
    return { kulcsszavak: [], parameterek: [], parancs: null, tovabb: null };
  }
  function azonosParam(a, b) {
    return a.param === b.param && a.kulcs === b.kulcs && a.min === b.min && a.max === b.max;
  }
  function faEpites(parancsok) {
    const fak = {};
    for (const parancs of parancsok) {
      for (const mod of parancs.modok) {
        let cs = fak[mod] = fak[mod] || ujCsomopont();
        for (const elem5 of parancs.szavak) {
          if (elem5.tovabb) {
            cs.tovabb = elem5.tovabb;
            break;
          }
          if (elem5.szo) {
            let gy = cs.kulcsszavak.find((k) => k.elem.szo.toLowerCase() === elem5.szo.toLowerCase());
            if (!gy) cs.kulcsszavak.push(gy = { elem: elem5, csomopont: ujCsomopont() });
            cs = gy.csomopont;
          } else if (elem5.param) {
            if (!PARAM_TIPUSOK[elem5.param]) throw new Error(`Ismeretlen paramétertípus: ${elem5.param}`);
            let gy = cs.parameterek.find((p) => azonosParam(p.elem, elem5));
            if (!gy) cs.parameterek.push(gy = { elem: elem5, csomopont: ujCsomopont() });
            cs = gy.csomopont;
          } else {
            throw new Error("Hibás parancsleírás: " + JSON.stringify(elem5));
          }
        }
        if (!parancs.szavak.some((e) => e.tovabb)) {
          if (cs.parancs) {
            throw new Error(`Kétszer van leírva ugyanaz a parancs (${mod}): ${parancs.szavak.map((e) => e.szo || e.param).join(" ")}`);
          }
          cs.parancs = parancs;
        }
      }
    }
    return fak;
  }
  function kulcsszoJeloltek(cs, szoveg) {
    const kis = szoveg.toLowerCase();
    const pontos = cs.kulcsszavak.find((k) => k.elem.szo.toLowerCase() === kis);
    if (pontos) return [pontos];
    return cs.kulcsszavak.filter((k) => k.elem.szo.toLowerCase().startsWith(kis));
  }
  function bejar(fak, mod, tokenek, sor2, kornyezet, { megallMaradeknal = false } = {}) {
    let aktMod = mod;
    let cs = fak[aktMod];
    let gyokerKezdet = 0;
    const ertekek = {};
    if (!cs) return { ok: false, hiba: "ervenytelen", oszlop: tokenek[0] ? tokenek[0].kezdet : 0, tokenIndex: 0, mod, ertekek, gyokerKezdet };
    let i = 0;
    while (i < tokenek.length) {
      if (cs.tovabb) {
        aktMod = cs.tovabb;
        cs = fak[aktMod];
        gyokerKezdet = i;
        continue;
      }
      const t = tokenek[i];
      const jeloltek = kulcsszoJeloltek(cs, t.szoveg);
      if (cs.parancs && cs.parancs.nincsMeg && jeloltek.length === 0) break;
      if (jeloltek.length === 1) {
        cs = jeloltek[0].csomopont;
        i++;
        continue;
      }
      if (jeloltek.length > 1) {
        return { ok: false, hiba: "ketertelmu", tokenIndex: i, mod: aktMod, ertekek, gyokerKezdet };
      }
      let illett = false;
      let legjobbHiba = null;
      for (const p of cs.parameterek) {
        const tipus = PARAM_TIPUSOK[p.elem.param];
        if (megallMaradeknal && tipus.maradekot) {
          return { ok: true, cs, mod: aktMod, ertekek, gyokerKezdet, maradekParam: p, maradekIndex: i };
        }
        const r = tipus.illeszt(p.elem, tokenek, i, sor2, kornyezet);
        if (r.ok) {
          ertekek[p.elem.kulcs] = r.ertek;
          cs = p.csomopont;
          i = r.kovetkezo;
          illett = true;
          break;
        }
        if (!legjobbHiba) legjobbHiba = r;
        else if (legjobbHiba.hiba === "ervenytelen" && (r.hiba !== "ervenytelen" || r.oszlop > legjobbHiba.oszlop)) legjobbHiba = r;
      }
      if (illett) continue;
      if (legjobbHiba) {
        return {
          ok: false,
          hiba: legjobbHiba.hiba,
          oszlop: legjobbHiba.oszlop,
          tokenIndex: i,
          mod: aktMod,
          ertekek,
          gyokerKezdet,
          felbeHagyott: legjobbHiba.hiba === "hianyos"
        };
      }
      return { ok: false, hiba: "ervenytelen", oszlop: t.kezdet, tokenIndex: i, mod: aktMod, ertekek, gyokerKezdet };
    }
    return { ok: true, cs, mod: aktMod, ertekek, gyokerKezdet, tokenIndex: i };
  }
  function illeszt(fak, mod, sor2, kornyezet = {}) {
    const tokenek = szavakra(sor2);
    const b = bejar(fak, mod, tokenek, sor2, kornyezet);
    if (!b.ok) return { ...b, tokenek };
    if (b.cs.tovabb || !b.cs.parancs) {
      return { ok: false, hiba: "hianyos", tokenIndex: tokenek.length, gyokerKezdet: b.gyokerKezdet, mod: b.mod, tokenek };
    }
    return { ok: true, parancs: b.cs.parancs, ertekek: b.ertekek, mod: b.mod, tokenek };
  }
  function sugo(fak, mod, sor2, kornyezet = {}) {
    const tokenek = szavakra(sor2);
    const reszleges = sor2 === "" || /\s$/.test(sor2) ? "" : tokenek.pop().szoveg;
    const b = bejar(fak, mod, tokenek, sor2, kornyezet, { megallMaradeknal: true });
    if (!b.ok) {
      if (b.felbeHagyott && reszleges === "") {
        return interfeszSzamSugo(tokenek, b, kornyezet) || { ...b, tokenek };
      }
      if (b.felbeHagyott && reszleges !== "") {
        const t = tokenek[b.tokenIndex];
        const ill = tipusIllesztes(t.szoveg, kornyezet.portTipusok || {});
        if (ill.tipus) {
          const szavak2 = szamReszleges(reszleges, kornyezet.portTipusok[ill.tipus]);
          if (szavak2.length) return { ok: true, fajta: "szavak", szavak: szavak2 };
        }
      }
      return { ...b, tokenek };
    }
    if (b.maradekParam) {
      return tartomanySugo(b, tokenek, reszleges, sor2, kornyezet);
    }
    let cs = b.cs;
    if (cs.tovabb) cs = fak[cs.tovabb];
    if (tokenek.length > 0 && cs.parancs && cs.parancs.nincsMeg) {
      const nincsTovabb = cs.kulcsszavak.length === 0 && cs.parameterek.length === 0;
      if (nincsTovabb) {
        const szavak2 = cs.parancs.szavak;
        return { ok: true, fajta: "lista", elemek: [{ nev: "<cr>", sugo: szavak2[szavak2.length - 1].sugo }], cr: false, gyoker: false };
      }
    }
    if (reszleges === "") {
      const elemek = [];
      for (const p of cs.parameterek) elemek.push(...PARAM_TIPUSOK[p.elem.param].sugoElemek(p.elem, kornyezet));
      const kulcsok = cs.kulcsszavak.map((k) => ({ nev: k.elem.szo, sugo: k.elem.sugo || "" }));
      kulcsok.sort((a, b2) => a.nev.localeCompare(b2.nev, "en"));
      elemek.push(...kulcsok);
      return { ok: true, fajta: "lista", elemek, cr: !!cs.parancs, gyoker: tokenek.length === 0 };
    }
    const kis = reszleges.toLowerCase();
    const szavak = cs.kulcsszavak.filter((k) => k.elem.szo.toLowerCase().startsWith(kis)).map((k) => k.elem.szo);
    szavak.sort((a, c) => a.localeCompare(c, "en"));
    for (const p of cs.parameterek) szavak.push(...PARAM_TIPUSOK[p.elem.param].reszleges(p.elem, reszleges, kornyezet));
    if (szavak.length === 0) {
      return { ok: false, hiba: "ismeretlen", tokenIndex: tokenek.length, gyokerKezdet: b.gyokerKezdet, tokenek };
    }
    return { ok: true, fajta: "szavak", szavak: [...new Set(szavak)] };
  }
  function interfeszSzamSugo(tokenek, b, kornyezet) {
    const t = tokenek[b.tokenIndex];
    if (!t) return null;
    const ill = tipusIllesztes(t.szoveg, kornyezet.portTipusok || {});
    if (!ill.tipus) return null;
    const letezok = kornyezet.portTipusok[ill.tipus];
    const elsok = [...new Set(letezok.map((s) => Number(s.split("/")[0])))].sort((a, c) => a - c);
    return {
      ok: true,
      fajta: "lista",
      elemek: [{ nev: `<${elsok[0]}-${elsok[elsok.length - 1]}>`, sugo: `${ill.tipus}-port száma (modul/port)` }],
      cr: false,
      gyoker: false
    };
  }
  function tartomanySugo(b, tokenek, reszleges, sor2, kornyezet) {
    const p = b.maradekParam;
    const tipus = PARAM_TIPUSOK[p.elem.param];
    const eddigiTokenek = tokenek.slice(b.maradekIndex);
    if (eddigiTokenek.length === 0) {
      if (reszleges === "") return { ok: true, fajta: "lista", elemek: tipus.sugoElemek(p.elem, kornyezet), cr: false, gyoker: false };
      const szavak = tipus.reszleges(p.elem, reszleges, kornyezet);
      if (szavak.length) return { ok: true, fajta: "szavak", szavak };
      return { ok: false, hiba: "ismeretlen", tokenIndex: tokenek.length, gyokerKezdet: b.gyokerKezdet, tokenek };
    }
    const kezdet = eddigiTokenek[0].kezdet;
    const vizsgalt = reszleges === "" ? sor2 : sor2.slice(0, sor2.length - reszleges.length);
    const szoveg = vizsgalt.slice(kezdet).trimEnd();
    if (reszleges === "") {
      if (/[-,]$/.test(szoveg)) {
        return { ok: true, fajta: "lista", elemek: /-$/.test(szoveg) ? [{ nev: "<1-24>", sugo: "A tartomány utolsó portja" }] : tipus.sugoElemek(p.elem, kornyezet), cr: false, gyoker: false };
      }
      const r = tartomanyElemez(szoveg, kezdet, kornyezet.portTipusok || {});
      if (!r.ok) return { ok: false, hiba: r.hiba, oszlop: r.oszlop, tokenIndex: tokenek.length, gyokerKezdet: b.gyokerKezdet, tokenek };
      return {
        ok: true,
        fajta: "lista",
        elemek: [
          { nev: "-", sugo: "Tartomány: az első és az utolsó port között mindegyik" },
          { nev: ",", sugo: "Újabb port vagy tartomány hozzáadása a listához" }
        ],
        cr: true,
        gyoker: false
      };
    }
    return { ok: true, fajta: "szavak", szavak: tipus.reszleges(p.elem, reszleges, kornyezet) };
  }
  function kiegeszit(fak, mod, sor2, kornyezet = {}) {
    if (sor2 === "" || /\s$/.test(sor2)) return null;
    const tokenek = szavakra(sor2);
    const utolso = tokenek.pop();
    const b = bejar(fak, mod, tokenek, sor2, kornyezet, { megallMaradeknal: true });
    if (!b.ok) return null;
    const eleje = sor2.slice(0, utolso.kezdet);
    if (b.maradekParam) {
      const t = PARAM_TIPUSOK[b.maradekParam.elem.param].kiegeszit(b.maradekParam.elem, utolso.szoveg, kornyezet);
      return t ? eleje + t : null;
    }
    let cs = b.cs;
    if (cs.tovabb) cs = fak[cs.tovabb];
    const jeloltek = kulcsszoJeloltek(cs, utolso.szoveg);
    if (jeloltek.length === 1) return eleje + jeloltek[0].elem.szo + " ";
    if (jeloltek.length > 1) return null;
    for (const p of cs.parameterek) {
      const t = PARAM_TIPUSOK[p.elem.param].kiegeszit(p.elem, utolso.szoveg, kornyezet);
      if (t) return eleje + t;
    }
    return null;
  }

  // src/cli/terminal-munkamenet.js
  var TORTENET_MERET = 10;
  var Munkamenet = class {
    /**
     * @param {Object} p
     * @param {Object} p.szemelyiseg – a gyártói réteg (pl. ios)
     * @param {Object} p.eszkoz      – az eszköz állapota (modell)
     * @param {Ora} [p.ora]          – szimulált óra (a naplóüzenetek időbélyegéhez)
     */
    constructor({ szemelyiseg, eszkoz, ora }) {
      this.szemelyiseg = szemelyiseg;
      this.eszkoz = eszkoz;
      this.ora = ora || new Ora();
      this.fak = faEpites(szemelyiseg.parancsok);
      this.mod = szemelyiseg.kezdoMod;
      this.kontextus = {};
      this.tortenetek = {};
      this.varakozas = null;
      this.figyelok = [];
    }
    /** Feliratkozás: minden parancs után szól (pl. a nézetnek, hogy frissítse a gépnevet). */
    figyel(fn) {
      this.figyelok.push(fn);
    }
    /** Az aktuális prompt, pl. „Switch(config)#”. */
    prompt() {
      if (this.varakozas) return this.varakozas.prompt;
      return this.szemelyiseg.modok[this.mod].prompt(this.eszkoz.hostname);
    }
    /** Az eszköz adatai, amelyekre az értelmezőnek szüksége van (pl. milyen portok vannak). */
    kornyezet() {
      return this.szemelyiseg.kornyezet(this.eszkoz);
    }
    /** Az aktuális módcsoport előzményei (a legrégebbi elöl). */
    tortenet() {
      const csoport = this.szemelyiseg.modok[this.mod].tortenet;
      return this.tortenetek[csoport] || [];
    }
    /** @private */
    tortenetbe(sor2) {
      const csoport = this.szemelyiseg.modok[this.mod].tortenet;
      const lista = this.tortenetek[csoport] = this.tortenetek[csoport] || [];
      if (lista[lista.length - 1] !== sor2) lista.push(sor2);
      while (lista.length > TORTENET_MERET) lista.shift();
    }
    /**
     * A parancsoknak átadott „eszköztár”.
     * @private
     * @param {KimenetElem[]} kimenet – ide gyűlik a kiírt szöveg
     */
    ctx(kimenet) {
      const mm = this;
      return {
        eszkoz: mm.eszkoz,
        ora: mm.ora,
        get mod() {
          return mm.mod;
        },
        get kontextus() {
          return mm.kontextus;
        },
        /** Sorok kiírása. */
        kiir: (...sorok) => kimenet.push(...sorok),
        /** Időbélyeges naplóüzenet, pl. „*Mar  1 00:01:02.345: %SYS-5-…”. */
        naplo: (uzenet) => kimenet.push(`${naploIdobelyeg(mm.ora.ido)}: ${uzenet}`),
        /** Várakozás a kiírás közben (pl. névfeloldás). */
        varj: (ms) => kimenet.push({ varj: ms }),
        /** Módváltás; a személyiség „modValtasKor” része is lefut (pl. naplóüzenet). */
        modValt: (uj, kontextus = {}) => {
          const regi = mm.mod;
          mm.mod = uj;
          mm.kontextus = kontextus;
          if (mm.szemelyiseg.modValtasKor) mm.szemelyiseg.modValtasKor(regi, uj, mm.ctx(kimenet), mm);
        },
        /** Kérdés az eszköz részéről: a következő beírt sort a `valasz` kapja meg. */
        kerdez: (promptSzoveg, valasz) => {
          mm.varakozas = { prompt: promptSzoveg, valasz };
        },
        /** Az aktuális prompt (pl. a naplóüzenet előtti sorhoz). */
        prompt: () => mm.prompt()
      };
    }
    /** @private */
    ertesit() {
      for (const fn of this.figyelok) fn();
    }
    /**
     * Egy beírt sor (Enter) feldolgozása.
     * @param {string} sor
     * @returns {{kimenet: KimenetElem[], lapozhato: boolean}}
     */
    bevitel(sor2) {
      const kimenet = [];
      const ctx = this.ctx(kimenet);
      if (this.varakozas) {
        const { valasz } = this.varakozas;
        this.varakozas = null;
        valasz(sor2, ctx);
        this.ertesit();
        return { kimenet, lapozhato: false };
      }
      if (sor2.trim() === "") return { kimenet, lapozhato: false };
      this.tortenetbe(sor2);
      const kornyezet = this.kornyezet();
      const promptSzoveg = this.prompt();
      let r = illeszt(this.fak, this.mod, sor2, kornyezet);
      const visszaesik = this.szemelyiseg.modok[this.mod].visszaesik;
      if (!r.ok && visszaesik) {
        const r2 = illeszt(this.fak, visszaesik, sor2, kornyezet);
        if (r2.ok) {
          this.mod = visszaesik;
          this.kontextus = {};
          r = r2;
        } else if (r.hiba === "ervenytelen" && (r2.hiba !== "ervenytelen" || r2.oszlop > r.oszlop)) {
          r = r2;
        }
      }
      if (!r.ok) {
        const info = { sor: sor2, prompt: promptSzoveg, mod: this.mod, modAdat: this.szemelyiseg.modok[this.mod] };
        kimenet.push(...this.szemelyiseg.formazHiba(r, info));
        return { kimenet, lapozhato: false };
      }
      r.parancs.vegrehajt(ctx, r.ertekek);
      this.ertesit();
      return { kimenet, lapozhato: !!r.parancs.lapozhato };
    }
    /**
     * A ? súgó. A `sor` a ? ELŐTTI szöveg.
     * @returns {{kimenet: string[], sor: string}} – a kiírandó súgó, és a sor, amit vissza kell írni a beviteli mezőbe
     */
    sugo(sor2) {
      if (this.varakozas) return { kimenet: [], sor: sor2 };
      const kornyezet = this.kornyezet();
      let r = sugo(this.fak, this.mod, sor2, kornyezet);
      const visszaesik = this.szemelyiseg.modok[this.mod].visszaesik;
      if (!r.ok && visszaesik && sor2.trim() !== "") {
        const r2 = sugo(this.fak, visszaesik, sor2, kornyezet);
        if (r2.ok) r = r2;
      }
      const info = { sor: sor2, prompt: this.prompt(), mod: this.mod, modAdat: this.szemelyiseg.modok[this.mod] };
      return { kimenet: this.szemelyiseg.formazSugo(r, info), sor: sor2 };
    }
    /**
     * Tab-kiegészítés.
     * @returns {string|null} – a kiegészített sor, vagy null
     */
    kiegeszit(sor2) {
      if (this.varakozas) return null;
      const kornyezet = this.kornyezet();
      const r = kiegeszit(this.fak, this.mod, sor2, kornyezet);
      if (r !== null) return r;
      const visszaesik = this.szemelyiseg.modok[this.mod].visszaesik;
      return visszaesik ? kiegeszit(this.fak, visszaesik, sor2, kornyezet) : null;
    }
    /**
     * Ctrl+Z: konfigurációs módból vissza a privilegizált módba (mint az „end”).
     * @returns {{kimenet: KimenetElem[]}}
     */
    ctrlZ() {
      const kimenet = [];
      if (!this.varakozas && this.szemelyiseg.ctrlZ) {
        this.szemelyiseg.ctrlZ(this.ctx(kimenet), this);
        this.ertesit();
      }
      return { kimenet };
    }
  };

  // src/gyartok/ios/modok.js
  var MODOK = {
    felhasznalo: {
      prompt: (h) => `${h}>`,
      exec: true,
      tortenet: "exec",
      sugoFejlec: "Exec commands:"
    },
    priv: {
      prompt: (h) => `${h}#`,
      exec: true,
      tortenet: "exec",
      sugoFejlec: "Exec commands:"
    },
    konfig: {
      prompt: (h) => `${h}(config)#`,
      konfig: true,
      tortenet: "konfig",
      sugoFejlec: "Configure commands:"
    },
    "konfig-if": {
      prompt: (h) => `${h}(config-if)#`,
      konfig: true,
      visszaesik: "konfig",
      tortenet: "konfig",
      sugoFejlec: "Interface configuration commands:"
    },
    "konfig-if-tartomany": {
      prompt: (h) => `${h}(config-if-range)#`,
      konfig: true,
      visszaesik: "konfig",
      tortenet: "konfig",
      sugoFejlec: "Interface configuration commands:"
    },
    "konfig-vlan": {
      prompt: (h) => `${h}(config-vlan)#`,
      konfig: true,
      visszaesik: "konfig",
      tortenet: "konfig",
      sugoFejlec: "VLAN configuration commands:"
    }
  };
  var KONFIG_MODOK = Object.keys(MODOK).filter((m) => MODOK[m].konfig);
  var ALMODOK = KONFIG_MODOK.filter((m) => m !== "konfig");

  // src/gyartok/ios/uzenetek.js
  var NEVFELOLDAS_VARAKOZAS = 1500;
  function jelzoSor(prompt, oszlop) {
    return " ".repeat(prompt.length + oszlop) + "^";
  }
  function formazHiba(r, info) {
    if (r.hiba === "ketertelmu") return [`% Ambiguous command:  "${info.sor.trim()}"`];
    if (r.hiba === "hianyos") return ["% Incomplete command.", ""];
    if (info.modAdat.exec && r.gyokerKezdet === 0 && r.tokenIndex === 0) {
      if (r.tokenek.length === 1) {
        return [
          `Translating "${r.tokenek[0].szoveg}"...domain server (255.255.255.255)`,
          { varj: NEVFELOLDAS_VARAKOZAS },
          "% Unknown command or computer name, or unable to find computer address"
        ];
      }
      return [jelzoSor(info.prompt, r.tokenek[1].kezdet), "% Invalid input detected at '^' marker.", ""];
    }
    return [jelzoSor(info.prompt, r.oszlop || 0), "% Invalid input detected at '^' marker.", ""];
  }
  function formazSugo(r, info) {
    if (!r.ok) {
      if (r.hiba === "ismeretlen" || r.hiba === "ervenytelen" && r.tokenIndex === 0) return ["% Unrecognized command"];
      if (r.hiba === "ketertelmu") return [`% Ambiguous command:  "${info.sor.trim()}"`];
      if (r.hiba === "hianyos") return ["% Incomplete command.", ""];
      return [jelzoSor(info.prompt, r.oszlop || 0), "% Invalid input detected at '^' marker.", ""];
    }
    if (r.fajta === "szavak") {
      const szel2 = Math.max(...r.szavak.map((s) => s.length)) + 2;
      const egySorban = Math.max(1, Math.floor(80 / szel2));
      const sorok2 = [];
      for (let i = 0; i < r.szavak.length; i += egySorban) {
        sorok2.push(r.szavak.slice(i, i + egySorban).map((s) => s.padEnd(szel2)).join("").trimEnd());
      }
      return [...sorok2, ""];
    }
    const sorok = [];
    if (r.gyoker && info.modAdat.sugoFejlec) sorok.push(info.modAdat.sugoFejlec);
    const szel = Math.max(0, ...r.elemek.map((e) => e.nev.length));
    for (const e of r.elemek) sorok.push(`  ${e.nev.padEnd(szel)}  ${e.sugo}`.trimEnd());
    if (r.cr) sorok.push("  <cr>");
    sorok.push("");
    return sorok;
  }

  // src/modell/switch.js
  var ALAP_HOSTNAME = "Switch";
  function gyariVlanok() {
    return {
      1: { nev: "default", gyari: true, tamogatott: true },
      1002: { nev: "fddi-default", gyari: true, tamogatott: false },
      1003: { nev: "token-ring-default", gyari: true, tamogatott: false },
      1004: { nev: "fddinet-default", gyari: true, tamogatott: false },
      1005: { nev: "trnet-default", gyari: true, tamogatott: false }
    };
  }
  var ROVID_TIPUSNEV = { FastEthernet: "Fa", GigabitEthernet: "Gi" };
  function ujPort(tipus, szam) {
    return {
      nev: tipus + szam,
      rovid: ROVID_TIPUSNEV[tipus] + szam,
      tipus,
      szam,
      leallitva: false,
      accessVlan: 1,
      mod: "dinamikus-auto",
      nativVlan: 1,
      fent: false
    };
  }
  function ujSwitch2960(beallitasok = {}) {
    const portok = [];
    for (let i = 1; i <= 24; i++) portok.push(ujPort("FastEthernet", `0/${i}`));
    for (let i = 1; i <= 2; i++) portok.push(ujPort("GigabitEthernet", `0/${i}`));
    return {
      tipus: "switch",
      modell: "2960-24",
      hostname: beallitasok.hostname || ALAP_HOSTNAME,
      vtpMod: "server",
      vlanok: gyariVlanok(),
      portok,
      macTabla: []
    };
  }
  function portKeres(sw, nev) {
    return sw.portok.find((p) => p.nev === nev);
  }
  function portTipusok(sw) {
    const eredmeny = {};
    for (const p of sw.portok) {
      (eredmeny[p.tipus] = eredmeny[p.tipus] || []).push(p.szam);
    }
    return eredmeny;
  }
  function alapVlanNev(szam) {
    return "VLAN" + String(szam).padStart(4, "0");
  }

  // src/gyartok/ios/parancsok/alap.js
  var SZO = {
    no: { szo: "no", sugo: "Parancs visszavonása, alapérték visszaállítása" }
  };
  function kijelentkezes(ctx) {
    ctx.kiir("", `${ctx.eszkoz.hostname} con0 is now available`, "", "", "", "", "", "Press RETURN to get started.", "");
    ctx.modValt("felhasznalo");
    ctx.kerdez("", () => {
    });
  }
  function konfigBe(ctx) {
    ctx.kiir("Enter configuration commands, one per line.  End with CNTL/Z.");
    ctx.modValt("konfig");
  }
  function ervenyesGepnev(nev) {
    return /^[A-Za-z][\x21-\x7e]*$/.test(nev);
  }
  var alapParancsok = [
    // ---------- felhasználói és privilegizált mód ----------
    {
      modok: ["felhasznalo", "priv"],
      szavak: [{ szo: "enable", sugo: "Belépés privilegizált (rendszergazdai) módba" }],
      vegrehajt(ctx) {
        if (ctx.mod === "felhasznalo") ctx.modValt("priv");
      }
    },
    {
      modok: ["priv"],
      szavak: [{ szo: "disable", sugo: "Vissza a felhasználói módba" }],
      vegrehajt(ctx) {
        ctx.modValt("felhasznalo");
      }
    },
    {
      modok: ["felhasznalo", "priv"],
      szavak: [{ szo: "exit", sugo: "Kilépés az eszközről (a munkamenet bezárása)" }],
      vegrehajt: kijelentkezes
    },
    {
      modok: ["felhasznalo", "priv"],
      szavak: [{ szo: "logout", sugo: "Kilépés az eszközről (ugyanaz, mint az exit)" }],
      vegrehajt: kijelentkezes
    },
    {
      modok: ["priv"],
      szavak: [
        { szo: "configure", sugo: "Belépés konfigurációs módba" },
        { szo: "terminal", sugo: "Beállítás innen, a parancssorból" }
      ],
      vegrehajt: konfigBe
    },
    {
      // Csak „configure”: az eszköz megkérdezi, honnan jön a konfiguráció.
      modok: ["priv"],
      szavak: [{ szo: "configure", sugo: "Belépés konfigurációs módba" }],
      vegrehajt(ctx) {
        ctx.kerdez("Configuring from terminal, memory, or network [terminal]? ", (valasz, c) => {
          const v = valasz.trim().toLowerCase();
          if (v === "" || "terminal".startsWith(v)) konfigBe(c);
          else if ("memory".startsWith(v) || "network".startsWith(v)) c.kiir("[Szimulátor] Ez a lehetőség a szimulátorban még nincs meg.");
          else c.kiir('?Must be "terminal", "memory" or "network"');
        });
      }
    },
    // ---------- konfigurációs módok ----------
    {
      modok: ["konfig"],
      szavak: [{ szo: "exit", sugo: "Kilépés a konfigurációs módból" }],
      vegrehajt(ctx) {
        ctx.modValt("priv");
      }
    },
    {
      modok: ALMODOK,
      szavak: [{ szo: "exit", sugo: "Kilépés ebből az almódból (vissza a konfigurációs módba)" }],
      vegrehajt(ctx) {
        ctx.modValt("konfig");
      }
    },
    {
      modok: KONFIG_MODOK,
      szavak: [{ szo: "end", sugo: "Kilépés a konfigurációból, vissza a privilegizált módba" }],
      vegrehajt(ctx) {
        ctx.modValt("priv");
      }
    },
    {
      modok: KONFIG_MODOK,
      szavak: [{ szo: "do", sugo: "Privilegizált módú parancs futtatása (pl. do show vlan brief)" }, { tovabb: "priv" }]
    },
    {
      modok: ["konfig"],
      szavak: [
        { szo: "hostname", sugo: "Az eszköz nevének beállítása" },
        { param: "szo", kulcs: "nev", sugo: "Az eszköz új neve" }
      ],
      vegrehajt(ctx, { nev }) {
        if (!ervenyesGepnev(nev)) {
          ctx.kiir("% Hostname contains one or more illegal characters.");
          return;
        }
        ctx.eszkoz.hostname = nev.slice(0, 63);
      }
    },
    {
      modok: ["konfig"],
      szavak: [SZO.no, { szo: "hostname", sugo: "Az eszköz nevének visszaállítása az alapértékre" }],
      vegrehajt(ctx) {
        ctx.eszkoz.hostname = ALAP_HOSTNAME;
      }
    }
  ];

  // src/gyartok/ios/parancsok/vlan.js
  var VLAN_SZO = { szo: "vlan", sugo: "VLAN létrehozása vagy szerkesztése" };
  var VLAN_SZAM = { param: "szam", kulcs: "vlan", min: 1, max: 4094, sugo: "A VLAN száma" };
  var KITERJESZTETT_TOL = 1006;
  var vlanParancsok = [
    {
      modok: ["konfig"],
      szavak: [VLAN_SZO, VLAN_SZAM],
      vegrehajt(ctx, { vlan }) {
        const sw = ctx.eszkoz;
        if (vlan >= KITERJESZTETT_TOL && sw.vtpMod === "server") {
          ctx.kiir("Extended VLAN(s) not allowed in current VTP mode.", "%Failed to commit extended VLAN(s) changes.");
          return;
        }
        if (!sw.vlanok[vlan]) sw.vlanok[vlan] = { nev: alapVlanNev(vlan), gyari: false, tamogatott: true };
        ctx.modValt("konfig-vlan", { vlan });
      }
    },
    {
      modok: ["konfig"],
      szavak: [SZO.no, { szo: "vlan", sugo: "VLAN törlése" }, VLAN_SZAM],
      vegrehajt(ctx, { vlan }) {
        const sw = ctx.eszkoz;
        const v = sw.vlanok[vlan];
        if (v && v.gyari) {
          ctx.kiir(`%Default VLAN ${vlan} may not be deleted.`);
          return;
        }
        delete sw.vlanok[vlan];
      }
    },
    {
      modok: ["konfig-vlan"],
      szavak: [
        { szo: "name", sugo: "A VLAN nevének megadása" },
        { param: "szo", kulcs: "nev", maxHossz: 32, sugo: "A VLAN neve (legfeljebb 32 karakter, szóköz nélkül)" }
      ],
      vegrehajt(ctx, { nev }) {
        const szam = ctx.kontextus.vlan;
        const v = ctx.eszkoz.vlanok[szam];
        if (v.gyari) {
          ctx.kiir(`%Default VLAN ${szam} may not have its name changed.`);
          return;
        }
        v.nev = nev;
      }
    },
    {
      modok: ["konfig-vlan"],
      szavak: [SZO.no, { szo: "name", sugo: "A VLAN nevének visszaállítása (VLANxxxx)" }],
      vegrehajt(ctx) {
        const szam = ctx.kontextus.vlan;
        const v = ctx.eszkoz.vlanok[szam];
        if (!v.gyari) v.nev = alapVlanNev(szam);
      }
    }
  ];

  // src/mag/ethernet.js
  var SZORAS = "ffffffffffff";
  var kovetkezoAzon = 1;
  function ujKeretAzon() {
    return kovetkezoAzon++;
  }
  function macNevbol(nev) {
    let h = 2166136261;
    for (let i = 0; i < nev.length; i++) {
      h ^= nev.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    const kever = (x) => {
      x ^= x >>> 16;
      x = Math.imul(x, 2246822507) >>> 0;
      x ^= x >>> 13;
      x = Math.imul(x, 3266489909) >>> 0;
      x ^= x >>> 16;
      return x >>> 0;
    };
    const a = kever(h);
    const b = kever(a ^ 2654435769);
    return "02" + a.toString(16).padStart(8, "0") + (b & 255).toString(16).padStart(2, "0");
  }
  function macPontos(mac) {
    return `${mac.slice(0, 4)}.${mac.slice(4, 8)}.${mac.slice(8, 12)}`;
  }
  function macKotojeles(mac) {
    return mac.toUpperCase().match(/../g).join("-");
  }

  // src/mag/kapcsolas.js
  var MAC_ELETKOR = 3e5;
  function uzemmod(sw, port) {
    if (port.mod === "trunk") return "trunk";
    if (port.mod === "access") return "access";
    if (!port.fent || !sw.halozat) return "access";
    const tul = sw.halozat.szomszed(sw, port);
    if (!tul || tul.eszkoz.tipus !== "switch") return "access";
    const m = tul.port.mod;
    if (port.mod === "dinamikus-auto") return m === "trunk" || m === "dinamikus-kezdemenyezo" ? "trunk" : "access";
    if (port.mod === "dinamikus-kezdemenyezo") return m === "access" ? "access" : "trunk";
    return "access";
  }
  function vlanAktiv(sw, vlan) {
    const v = sw.vlanok[vlan];
    return !!v && v.tamogatott !== false;
  }
  function portTagja(sw, port, vlan) {
    if (uzemmod(sw, port) === "trunk") return vlanAktiv(sw, vlan);
    return port.accessVlan === vlan;
  }
  function macTabla(sw) {
    const ido = sw.halozat ? sw.halozat.ora.ido : 0;
    sw.macTabla = (sw.macTabla || []).filter((b) => ido - b.ido < MAC_ELETKOR);
    return sw.macTabla;
  }
  function macTorolPort(sw, portNev) {
    sw.macTabla = (sw.macTabla || []).filter((b) => b.port !== portNev);
  }
  function macTanul(sw, vlan, mac, portNev, ido) {
    const t = macTabla(sw);
    const b = t.find((x) => x.vlan === vlan && x.mac === mac);
    if (b) {
      b.port = portNev;
      b.ido = ido;
    } else {
      t.push({ vlan, mac, port: portNev, ido });
    }
  }
  function kapcsoloFogad(h, sw, port, keret) {
    let vlan;
    if (uzemmod(sw, port) === "trunk") {
      vlan = keret.vlan !== void 0 ? keret.vlan : port.nativVlan;
    } else {
      if (keret.vlan !== void 0) return h.eldob(sw, port, keret, "Címkés (802.1Q) keret érkezett egy access portra.");
      vlan = port.accessVlan;
    }
    if (!vlanAktiv(sw, vlan)) {
      return h.eldob(sw, port, keret, `A(z) ${vlan}-es VLAN nem létezik ezen a switchen (${sw.hostname}), ezért a keretet eldobta.`);
    }
    if (keret.forrasMac !== SZORAS) macTanul(sw, vlan, keret.forrasMac, port.nev, h.ora.ido);
    let kimenok;
    const ismert = keret.celMac !== SZORAS && macTabla(sw).find((b) => b.vlan === vlan && b.mac === keret.celMac);
    if (ismert) {
      if (ismert.port === port.nev) return;
      kimenok = sw.portok.filter((p) => p.nev === ismert.port);
    } else {
      kimenok = sw.portok.filter((p) => p !== port);
    }
    for (const p of kimenok) {
      if (!p.fent || !portTagja(sw, p, vlan)) continue;
      const trunk = uzemmod(sw, p) === "trunk";
      const cimke = trunk && vlan !== p.nativVlan ? vlan : void 0;
      h.kuld(sw, p, { ...keret, vlan: cimke });
    }
  }

  // src/mag/ip.js
  function ipSzam(szoveg) {
    if (typeof szoveg !== "string") return null;
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(szoveg.trim());
    if (!m) return null;
    const reszek = m.slice(1).map(Number);
    if (reszek.some((r) => r > 255)) return null;
    return (reszek[0] << 24 >>> 0) + (reszek[1] << 16) + (reszek[2] << 8) + reszek[3];
  }
  function ipSzoveg(szam) {
    return [24, 16, 8, 0].map((t) => szam >>> t & 255).join(".");
  }
  function ervenyesIp(szoveg) {
    return ipSzam(szoveg) !== null;
  }
  function ervenyesMaszk(szoveg) {
    const m = ipSzam(szoveg);
    if (m === null || m === 0) return false;
    const inv = ~m >>> 0;
    return (inv + 1 & inv) === 0;
  }
  function egyHalozat(a, b, maszk) {
    const x = ipSzam(a);
    const y = ipSzam(b);
    const m = ipSzam(maszk);
    if (x === null || y === null || m === null) return false;
    return (x & m) >>> 0 === (y & m) >>> 0;
  }
  function gepcimHiba(ip, maszk) {
    const x = ipSzam(ip);
    const m = ipSzam(maszk);
    if (x === null) return "Érvénytelen IP-cím.";
    if (m === null || !ervenyesMaszk(maszk)) return "Érvénytelen alhálózati maszk.";
    const elso = x >>> 24;
    if (elso === 0 || elso === 127 || elso >= 224) return "Ez a cím nem adható egy gépnek.";
    const gep = (x & ~m) >>> 0;
    const gepResz = ~m >>> 0;
    if (gepResz > 1 && gep === 0) return "Ez a hálózat címe, gépnek nem adható.";
    if (gepResz > 1 && gep === gepResz) return "Ez a hálózat szórási címe, gépnek nem adható.";
    return null;
  }

  // src/mag/vegpont.js
  var ARP_VARAKOZAS = 3e3;
  var PING_VARAKOZAS = 4e3;
  var ALAP_TTL = 128;
  var belso = /* @__PURE__ */ new WeakMap();
  function allapot(pc) {
    let a = belso.get(pc);
    if (!a) belso.set(pc, a = { arpVarok: /* @__PURE__ */ new Map(), pingVarok: /* @__PURE__ */ new Map(), kovetkezoSorszam: 1 });
    return a;
  }
  function nic(pc) {
    return pc.portok[0];
  }
  function kuld(h, pc, keret) {
    h.kuld(pc, nic(pc), { azon: ujKeretAzon(), forrasMac: pc.mac, ...keret });
  }
  function vanIp(pc) {
    return !!pc.ip && !!pc.maszk;
  }
  function kovetkezoUgras(pc, celIp) {
    if (egyHalozat(pc.ip, celIp, pc.maszk)) return celIp;
    if (pc.atjaro && egyHalozat(pc.ip, pc.atjaro, pc.maszk)) return pc.atjaro;
    return null;
  }
  function arpFelold(h, pc, ip, cb) {
    const b = pc.arpTabla[ip];
    if (b) return cb(b.mac);
    const a = allapot(pc);
    const var_ = a.arpVarok.get(ip);
    if (var_) {
      var_.cbk.push(cb);
      return;
    }
    const uj = { cbk: [cb], idozito: null };
    a.arpVarok.set(ip, uj);
    uj.idozito = h.ora.utemez(ARP_VARAKOZAS, () => {
      a.arpVarok.delete(ip);
      for (const f of uj.cbk) f(null);
    });
    kuld(h, pc, {
      celMac: SZORAS,
      tipus: "arp",
      adat: { muvelet: "keres", kuldoMac: pc.mac, kuldoIp: pc.ip, celMac: "000000000000", celIp: ip }
    });
  }
  function arpTanul(h, pc, ip, mac) {
    pc.arpTabla[ip] = { mac, ido: h.ora.ido };
    const a = allapot(pc);
    const var_ = a.arpVarok.get(ip);
    if (var_) {
      a.arpVarok.delete(ip);
      h.ora.lemond(var_.idozito);
      for (const f of var_.cbk) f(mac);
    }
  }
  function ipKuld(h, pc, celIp, adat, hibaCb) {
    const ugras = kovetkezoUgras(pc, celIp);
    if (!ugras) return hibaCb && hibaCb("nincs-ut");
    arpFelold(h, pc, ugras, (mac) => {
      if (!mac) return hibaCb && hibaCb("arp");
      kuld(h, pc, { celMac: mac, tipus: "ipv4", adat: { forrasIp: pc.ip, celIp, ttl: ALAP_TTL, ...adat } });
    });
  }
  function egyPing(h, pc, celIp, cb) {
    if (!vanIp(pc) || !nic(pc).fent) return cb({ fajta: "hiba" });
    if (celIp === pc.ip) return cb({ fajta: "valasz", ttl: ALAP_TTL });
    const a = allapot(pc);
    const sorszam = a.kovetkezoSorszam++;
    let kesz = false;
    const vege = (e) => {
      if (kesz) return;
      kesz = true;
      a.pingVarok.delete(sorszam);
      cb(e);
    };
    const ugras = kovetkezoUgras(pc, celIp);
    if (!ugras) return vege({ fajta: "hiba" });
    arpFelold(h, pc, ugras, (mac) => {
      if (!mac) return vege({ fajta: "elerhetetlen" });
      const idozito = h.ora.utemez(PING_VARAKOZAS, () => vege({ fajta: "idotullepes" }));
      a.pingVarok.set(sorszam, (ttl) => {
        h.ora.lemond(idozito);
        vege({ fajta: "valasz", ttl });
      });
      kuld(h, pc, {
        celMac: mac,
        tipus: "ipv4",
        adat: { forrasIp: pc.ip, celIp, ttl: ALAP_TTL, protokoll: "icmp", icmp: { tipus: "echo-keres", sorszam } }
      });
    });
  }
  function szorasProba(h, pc, cb) {
    const azon = ujKeretAzon();
    const kik = [];
    const leiratkozas = h.figyel((e) => {
      if (e.tipus === "fogadva" && e.keret.azon === azon && !kik.includes(e.eszkoz)) kik.push(e.eszkoz);
    });
    h.kuld(pc, nic(pc), {
      azon,
      forrasMac: pc.mac,
      celMac: SZORAS,
      tipus: "arp",
      adat: { muvelet: "keres", kuldoMac: pc.mac, kuldoIp: "0.0.0.0", celMac: "000000000000", celIp: pc.ip || "0.0.0.0" }
    });
    h.ora.utemez(h.kesleltetes * 12 + 50, () => {
      leiratkozas();
      cb(kik);
    });
  }
  function vegpontFogad(h, pc, port, keret) {
    if (keret.vlan !== void 0) return h.eldob(pc, port, keret, "A PC nem ismeri a 802.1Q-címkés keretet.");
    if (keret.celMac !== pc.mac && keret.celMac !== SZORAS) return;
    h.esemeny({ tipus: "fogadva", eszkoz: pc, port, keret });
    if (keret.tipus === "arp") {
      const arp = keret.adat;
      if (!vanIp(pc) || arp.kuldoIp === "0.0.0.0") return;
      if (arp.celIp !== pc.ip) return;
      arpTanul(h, pc, arp.kuldoIp, arp.kuldoMac);
      if (arp.muvelet === "keres") {
        kuld(h, pc, {
          celMac: arp.kuldoMac,
          tipus: "arp",
          adat: { muvelet: "valasz", kuldoMac: pc.mac, kuldoIp: pc.ip, celMac: arp.kuldoMac, celIp: arp.kuldoIp }
        });
      }
      return;
    }
    if (keret.tipus === "ipv4") {
      const ip = keret.adat;
      if (!vanIp(pc) || ip.celIp !== pc.ip) return;
      if (ip.protokoll === "icmp" && ip.icmp.tipus === "echo-keres") {
        ipKuld(h, pc, ip.forrasIp, { protokoll: "icmp", icmp: { tipus: "echo-valasz", sorszam: ip.icmp.sorszam } });
      } else if (ip.protokoll === "icmp" && ip.icmp.tipus === "echo-valasz") {
        const v = allapot(pc).pingVarok.get(ip.icmp.sorszam);
        if (v) v(ip.ttl);
      }
    }
  }
  function ipBeallit(pc, { ip, maszk, atjaro }) {
    if (ip !== void 0) pc.ip = ip;
    if (maszk !== void 0) pc.maszk = maszk;
    if (atjaro !== void 0) pc.atjaro = atjaro;
    pc.arpTabla = {};
  }

  // src/mag/halozat.js
  var LINK_FEL_IDO = 1e3;
  var PROTOKOLL_FEL_IDO = 2e3;
  var PROTOKOLL_LE_IDO = 1e3;
  var Halozat = class {
    /**
     * @param {{ora?: Ora, kesleltetes?: number}} [p]
     */
    constructor({ ora, kesleltetes = 1 } = {}) {
      this.ora = ora || new Ora();
      this.kesleltetes = kesleltetes;
      this.eszkozok = [];
      this.kabelek = [];
      this.figyelok = [];
    }
    /** Eszköz hozzáadása. Az eszköz „tudni fogja”, melyik hálózatban van. */
    hozzaad(eszkoz) {
      Object.defineProperty(eszkoz, "halozat", { value: this, enumerable: false, configurable: true });
      this.eszkozok.push(eszkoz);
      return eszkoz;
    }
    /** Eszköz keresése név (hostname) szerint. */
    eszkoz(nev) {
      return this.eszkozok.find((e) => e.hostname === nev);
    }
    /**
     * Kábel két port között. A kábel azonnal működik (nincs „link up” üzenet), ha mindkét
     * vég be van kapcsolva – mintha a hálózat már így indult volna.
     */
    kabel(eszkozA, portNevA, eszkozB, portNevB) {
      const pa = eszkozA.portok.find((p) => p.nev === portNevA);
      const pb = eszkozB.portok.find((p) => p.nev === portNevB);
      if (!pa || !pb) throw new Error(`Nincs ilyen port: ${eszkozA.hostname} ${portNevA} / ${eszkozB.hostname} ${portNevB}`);
      if (this.kabelVege(eszkozA, pa) || this.kabelVege(eszkozB, pb)) throw new Error("A port már foglalt.");
      const k = { a: { eszkoz: eszkozA, port: pa }, b: { eszkoz: eszkozB, port: pb }, fuggo: [] };
      this.kabelek.push(k);
      const fent = !pa.leallitva && !pb.leallitva;
      pa.fent = fent;
      pb.fent = fent;
      return k;
    }
    /** A porthoz csatlakozó kábel, vagy null. */
    kabelVege(eszkoz, port) {
      return this.kabelek.find((k) => k.a.eszkoz === eszkoz && k.a.port === port || k.b.eszkoz === eszkoz && k.b.port === port) || null;
    }
    /** A kábel túlsó vége: {eszkoz, port}, vagy null, ha nincs kábel. */
    szomszed(eszkoz, port) {
      const k = this.kabelVege(eszkoz, port);
      if (!k) return null;
      return k.a.eszkoz === eszkoz && k.a.port === port ? k.b : k.a;
    }
    /** Feliratkozás az eseményekre. Visszaad egy függvényt, amivel le lehet iratkozni. */
    figyel(fn) {
      this.figyelok.push(fn);
      return () => {
        this.figyelok = this.figyelok.filter((f) => f !== fn);
      };
    }
    /** @param {Object} e */
    esemeny(e) {
      for (const fn of this.figyelok.slice()) fn(e);
    }
    /** Időbélyeges konzolüzenet egy eszközön (a nézet a konzoljára írja). */
    naplo(eszkoz, uzenet) {
      if (eszkoz.tipus !== "switch") return;
      this.esemeny({ tipus: "naplo", eszkoz, sor: `${naploIdobelyeg(this.ora.ido)}: ${uzenet}` });
    }
    /**
     * Keret küldése egy porton. Ha a port nem működik, vagy nincs rajta kábel, a keret elvész.
     * @param {Object} eszkoz
     * @param {Object} port
     * @param {Object} keret
     */
    kuld(eszkoz, port, keret) {
      if (!port.fent) return;
      const tul = this.szomszed(eszkoz, port);
      if (!tul) return;
      this.esemeny({ tipus: "keret", honnan: { eszkoz, port }, hova: tul, keret, idotartam: this.kesleltetes });
      this.ora.utemez(this.kesleltetes, () => this.fogad(tul.eszkoz, tul.port, keret));
    }
    /** @private – egy keret megérkezett egy portra */
    fogad(eszkoz, port, keret) {
      if (!port.fent) return;
      if (eszkoz.tipus === "switch") kapcsoloFogad(this, eszkoz, port, keret);
      else vegpontFogad(this, eszkoz, port, keret);
    }
    /** Eldobott keret (a nézet egy jelet tesz ki, a tanuló láthatja, hol akadt el a csomag). */
    eldob(eszkoz, port, keret, ok) {
      this.esemeny({ tipus: "eldobva", eszkoz, port, keret, ok });
    }
    /**
     * Egy port beállítása megváltozott (shutdown / no shutdown). Kiszámolja, működik-e a kábel,
     * és ha változott, kiírja a konzolüzeneteket – a valódi eszközhöz hasonló időzítéssel.
     */
    portValtozott(eszkoz, port) {
      const k = this.kabelVege(eszkoz, port);
      if (!k) {
        this.esemeny({ tipus: "allapot" });
        return;
      }
      for (const e of k.fuggo) this.ora.lemond(e);
      k.fuggo = [];
      const kell = !k.a.port.leallitva && !k.b.port.leallitva;
      const vegek = [k.a, k.b];
      if (!kell) {
        if (k.a.port.fent) {
          for (const v of vegek) {
            v.port.fent = false;
            if (v.eszkoz.tipus === "switch") macTorolPort(v.eszkoz, v.port.nev);
            if (!v.port.leallitva) this.naplo(v.eszkoz, `%LINK-3-UPDOWN: Interface ${v.port.nev}, changed state to down`);
          }
          k.fuggo.push(this.ora.utemez(PROTOKOLL_LE_IDO, () => {
            for (const v of vegek) {
              this.naplo(v.eszkoz, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${v.port.nev}, changed state to down`);
            }
          }));
        }
        this.esemeny({ tipus: "allapot" });
        return;
      }
      if (!k.a.port.fent) {
        k.fuggo.push(this.ora.utemez(LINK_FEL_IDO, () => {
          for (const v of vegek) this.naplo(v.eszkoz, `%LINK-3-UPDOWN: Interface ${v.port.nev}, changed state to up`);
        }));
        k.fuggo.push(this.ora.utemez(PROTOKOLL_FEL_IDO, () => {
          for (const v of vegek) {
            v.port.fent = true;
            this.naplo(v.eszkoz, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${v.port.nev}, changed state to up`);
          }
          this.esemeny({ tipus: "allapot" });
        }));
      }
      this.esemeny({ tipus: "allapot" });
    }
  };
  function portValtozott(eszkoz, port) {
    if (eszkoz.halozat) eszkoz.halozat.portValtozott(eszkoz, port);
  }

  // src/gyartok/ios/parancsok/interfesz.js
  var INTERFACE_SZO = { szo: "interface", sugo: "Interfész (port) kiválasztása a beállításhoz" };
  var IF_MODOK = ["konfig-if", "konfig-if-tartomany"];
  var interfeszParancsok = [
    {
      modok: ["konfig"],
      szavak: [INTERFACE_SZO, { param: "interfesz", kulcs: "interfesz", sugo: "Az interfész neve" }],
      vegrehajt(ctx, { interfesz }) {
        ctx.modValt("konfig-if", { portok: [interfesz] });
      }
    },
    {
      modok: ["konfig"],
      szavak: [
        INTERFACE_SZO,
        { szo: "range", sugo: "Több interfész kiválasztása egyszerre (pl. fa0/1 - 4)" },
        { param: "interfesz-tartomany", kulcs: "portok", sugo: "Interfészek listája vagy tartománya" }
      ],
      vegrehajt(ctx, { portok }) {
        ctx.modValt("konfig-if-tartomany", { portok });
      }
    },
    {
      modok: IF_MODOK,
      szavak: [{ szo: "shutdown", sugo: "Az interfész lekapcsolása" }],
      vegrehajt(ctx) {
        for (const nev of ctx.kontextus.portok) {
          const p = portKeres(ctx.eszkoz, nev);
          if (!p.leallitva) {
            p.leallitva = true;
            ctx.naplo(`%LINK-5-CHANGED: Interface ${p.nev}, changed state to administratively down`);
            portValtozott(ctx.eszkoz, p);
          }
        }
      }
    },
    {
      modok: IF_MODOK,
      szavak: [SZO.no, { szo: "shutdown", sugo: "Az interfész bekapcsolása" }],
      vegrehajt(ctx) {
        for (const nev of ctx.kontextus.portok) {
          const p = portKeres(ctx.eszkoz, nev);
          if (!p.leallitva) continue;
          p.leallitva = false;
          portValtozott(ctx.eszkoz, p);
        }
      }
    }
  ];

  // src/gyartok/ios/kimenetek/vlan-brief.js
  var PORT_OSZLOP_SZELESSEG = 31;
  var BEHUZAS = " ".repeat(4 + 1 + 32 + 1 + 9 + 1);
  function portSorok(portok) {
    const sorok = [];
    let aktualis = "";
    for (const p of portok) {
      const jelolt = aktualis === "" ? p : `${aktualis}, ${p}`;
      if (aktualis !== "" && jelolt.length > PORT_OSZLOP_SZELESSEG) {
        sorok.push(aktualis);
        aktualis = p;
      } else {
        aktualis = jelolt;
      }
    }
    if (aktualis !== "") sorok.push(aktualis);
    return sorok;
  }
  function showVlanBrief(sw) {
    const sorok = [
      "",
      "VLAN Name                             Status    Ports",
      "---- -------------------------------- --------- -------------------------------"
    ];
    const szamok = Object.keys(sw.vlanok).map(Number).sort((a, b) => a - b);
    for (const szam of szamok) {
      const vlan = sw.vlanok[szam];
      const allapot2 = vlan.tamogatott === false ? "act/unsup" : "active";
      const portok = sw.portok.filter((p) => p.accessVlan === szam && uzemmod(sw, p) !== "trunk").map((p) => p.rovid);
      const elso = `${String(szam).padEnd(4)} ${vlan.nev.padEnd(32)} ${allapot2.padEnd(9)} `;
      const ps = portSorok(portok);
      sorok.push((elso + (ps[0] || "")).trimEnd());
      for (const folytatas of ps.slice(1)) sorok.push(BEHUZAS + folytatas);
    }
    return sorok;
  }

  // src/gyartok/ios/kimenetek/running-config.js
  function konfiguracioTorzs(sw) {
    const s = [];
    s.push(
      "!",
      "version 15.0",
      "no service pad",
      "service timestamps debug datetime msec",
      "service timestamps log datetime msec",
      "no service password-encryption",
      "!"
    );
    s.push(`hostname ${sw.hostname}`, "!");
    s.push("boot-start-marker", "boot-end-marker", "!", "!");
    s.push("no aaa new-model", "system mtu routing 1500");
    if (sw.vtpMod !== "server") s.push(`vtp mode ${sw.vtpMod}`);
    s.push("!", "!", "!", "!", "!", "!");
    s.push("spanning-tree mode pvst", "spanning-tree extend system-id", "!");
    s.push("vlan internal allocation policy ascending", "!");
    if (sw.vtpMod === "transparent") {
      const szamok = Object.keys(sw.vlanok).map(Number).filter((n) => !sw.vlanok[n].gyari).sort((a, b) => a - b);
      for (const n of szamok) {
        s.push(`vlan ${n}`);
        const v = sw.vlanok[n];
        if (v.nev !== "VLAN" + String(n).padStart(4, "0")) s.push(` name ${v.nev}`);
        s.push("!");
      }
    }
    s.push("!", "!", "!", "!", "!");
    for (const p of sw.portok) {
      s.push(`interface ${p.nev}`);
      if (p.accessVlan !== 1) s.push(` switchport access vlan ${p.accessVlan}`);
      if (p.mod === "access") s.push(" switchport mode access");
      else if (p.mod === "trunk") s.push(" switchport mode trunk");
      else if (p.mod === "dinamikus-kezdemenyezo") s.push(" switchport mode dynamic desirable");
      if (p.leallitva) s.push(" shutdown");
      s.push("!");
    }
    s.push("interface Vlan1", " no ip address", " shutdown", "!");
    s.push("ip http server", "ip http secure-server", "!", "!", "!");
    s.push("line con 0", "line vty 0 4", " login", "line vty 5 15", " login", "!", "end");
    return s;
  }
  function showRunningConfig(sw) {
    const torzs = konfiguracioTorzs(sw);
    const bajt = torzs.reduce((osszeg, sor2) => osszeg + sor2.length + 1, 0);
    return ["Building configuration...", "", `Current configuration : ${bajt} bytes`, ...torzs, ""];
  }

  // src/gyartok/ios/kimenetek/interfaces.js
  function vlanListaTomor(szamok) {
    const s = [...szamok].sort((a, b) => a - b);
    const reszek = [];
    for (let i = 0; i < s.length; i++) {
      let j = i;
      while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
      reszek.push(j > i ? `${s[i]}-${s[j]}` : String(s[i]));
      i = j;
    }
    return reszek.join(",");
  }
  var MOD_NEV = { trunk: "on", "dinamikus-auto": "auto", "dinamikus-kezdemenyezo": "desirable" };
  function showInterfacesTrunk(sw) {
    const portok = sw.portok.filter((p) => p.mod === "trunk" || p.mod !== "access" && uzemmod(sw, p) === "trunk");
    if (portok.length === 0) return [];
    const aktivak = Object.keys(sw.vlanok).map(Number).filter((n) => n < 1002 || n > 1005).filter((n) => vlanAktiv(sw, n));
    const sor2 = (port, szoveg) => `${port.padEnd(12)}${szoveg}`;
    const s = ["", "Port        Mode             Encapsulation  Status        Native vlan"];
    for (const p of portok) {
      s.push(sor2(p.rovid, `${MOD_NEV[p.mod].padEnd(17)}${"802.1q".padEnd(15)}${(p.fent ? "trunking" : "other").padEnd(14)}${p.nativVlan}`));
    }
    const szakasz = (cim, ertek) => {
      s.push("", sor2("Port", cim));
      for (const p of portok) s.push(sor2(p.rovid, p.fent ? ertek : "none"));
    };
    szakasz("Vlans allowed on trunk", "1-4094");
    szakasz("Vlans allowed and active in management domain", vlanListaTomor(aktivak));
    szakasz("Vlans in spanning tree forwarding state and not pruned", vlanListaTomor(aktivak));
    return s;
  }
  function showInterfacesStatus(sw) {
    const s = ["", "Port      Name               Status       Vlan       Duplex  Speed Type"];
    for (const p of sw.portok) {
      let allapot2;
      if (p.leallitva) allapot2 = "disabled";
      else if (p.fent) allapot2 = "connected";
      else allapot2 = "notconnect";
      const vlan = p.fent && uzemmod(sw, p) === "trunk" ? "trunk" : String(p.accessVlan);
      const giga = p.tipus === "GigabitEthernet";
      const duplex = p.fent ? "a-full" : "auto";
      const sebesseg = p.fent ? giga ? "a-1000" : "a-100" : "auto";
      const tipus = giga ? "10/100/1000BaseTX" : "10/100BaseTX";
      s.push(`${p.rovid.padEnd(9)} ${"".padEnd(18)} ${allapot2.padEnd(12)} ${vlan.padEnd(10)} ${duplex.padStart(6)} ${sebesseg.padStart(6)} ${tipus}`);
    }
    return s;
  }

  // src/gyartok/ios/kimenetek/mac-tabla.js
  var STATIKUS = [
    "0100.0ccc.cccc",
    "0100.0ccc.cccd",
    ...Array.from({ length: 16 }, (_, i) => `0180.c200.00${i.toString(16).padStart(2, "0")}`),
    "0180.c200.0010",
    "ffff.ffff.ffff"
  ];
  function rovidPortnev(nev) {
    const m = /^([A-Za-z]+)(.*)$/.exec(nev);
    return (ROVID_TIPUSNEV[m[1]] || m[1]) + m[2];
  }
  function sor(vlan, mac, tipus, port) {
    return `${String(vlan).padStart(4)}    ${mac}    ${tipus.padEnd(8)}    ${port}`;
  }
  function showMacTabla(sw, { csakDinamikus = false } = {}) {
    const s = [
      "          Mac Address Table",
      "-------------------------------------------",
      "",
      "Vlan    Mac Address       Type        Ports",
      "----    -----------       --------    -----"
    ];
    let db = 0;
    if (!csakDinamikus) {
      for (const m of STATIKUS) s.push(sor("All", m, "STATIC", "CPU"));
      db += STATIKUS.length;
    }
    const dinamikus = macTabla(sw).slice().sort((a, b) => a.vlan - b.vlan || a.mac.localeCompare(b.mac));
    for (const b of dinamikus) s.push(sor(b.vlan, macPontos(b.mac), "DYNAMIC", rovidPortnev(b.port)));
    db += dinamikus.length;
    s.push(`Total Mac Addresses for this criterion: ${db}`);
    return s;
  }

  // src/gyartok/ios/parancsok/show.js
  var SHOW = { szo: "show", sugo: "Információk megjelenítése az eszközről" };
  var VLAN = { szo: "vlan", sugo: "A VLAN-ok adatai" };
  var INTERFACES = { szo: "interfaces", sugo: "Az interfészek (portok) állapota" };
  var MAC = { szo: "mac", sugo: "MAC-beállítások" };
  var ADDRESS_TABLE = { szo: "address-table", sugo: "A MAC-címtábla: melyik cím melyik porton és VLAN-ban van" };
  var EXEC = ["felhasznalo", "priv"];
  var showParancsok = [
    {
      modok: ["felhasznalo", "priv"],
      szavak: [SHOW, VLAN, { szo: "brief", sugo: "Rövid összefoglaló: VLAN-ok, állapotuk és portjaik" }],
      lapozhato: true,
      vegrehajt(ctx) {
        ctx.kiir(...showVlanBrief(ctx.eszkoz));
      }
    },
    {
      // A teljes „show vlan” a valódi eszközön működik; a szimulátorban még nincs meg.
      modok: ["felhasznalo", "priv"],
      szavak: [SHOW, VLAN],
      vegrehajt(ctx) {
        ctx.kiir("[Szimulátor] A teljes „show vlan” még nincs meg. Próbáld így: show vlan brief", "");
      }
    },
    {
      modok: ["priv"],
      szavak: [SHOW, { szo: "running-config", sugo: "Az éppen futó (érvényes) konfiguráció" }],
      lapozhato: true,
      vegrehajt(ctx) {
        ctx.kiir(...showRunningConfig(ctx.eszkoz));
      }
    },
    {
      modok: EXEC,
      szavak: [SHOW, INTERFACES, { szo: "trunk", sugo: "A trunk portok: mód, natív VLAN, átengedett VLAN-ok" }],
      lapozhato: true,
      vegrehajt(ctx) {
        ctx.kiir(...showInterfacesTrunk(ctx.eszkoz));
      }
    },
    {
      modok: EXEC,
      szavak: [SHOW, INTERFACES, { szo: "status", sugo: "Összefoglaló: portonként állapot, VLAN, sebesség" }],
      lapozhato: true,
      vegrehajt(ctx) {
        ctx.kiir(...showInterfacesStatus(ctx.eszkoz));
      }
    },
    {
      modok: EXEC,
      szavak: [SHOW, MAC, ADDRESS_TABLE],
      lapozhato: true,
      vegrehajt(ctx) {
        ctx.kiir(...showMacTabla(ctx.eszkoz));
      }
    },
    {
      modok: EXEC,
      szavak: [SHOW, MAC, ADDRESS_TABLE, { szo: "dynamic", sugo: "Csak a megtanult (dinamikus) címek" }],
      lapozhato: true,
      vegrehajt(ctx) {
        ctx.kiir(...showMacTabla(ctx.eszkoz, { csakDinamikus: true }));
      }
    }
  ];

  // src/gyartok/ios/parancsok/switchport.js
  var IF_MODOK2 = ["konfig-if", "konfig-if-tartomany"];
  var SWITCHPORT = { szo: "switchport", sugo: "Kapcsolóport-beállítások (VLAN, üzemmód)" };
  var MODE = { szo: "mode", sugo: "A port üzemmódja (access, trunk …)" };
  var ACCESS = { szo: "access", sugo: "Access mód beállításai" };
  var VLAN2 = { szo: "vlan", sugo: "Melyik VLAN-hoz tartozzon a port access módban" };
  var KITERJESZTETT_TOL2 = 1006;
  function portokra(ctx, fn) {
    for (const nev of ctx.kontextus.portok) {
      const p = portKeres(ctx.eszkoz, nev);
      fn(p);
      macTorolPort(ctx.eszkoz, p.nev);
      const tul = ctx.eszkoz.halozat && ctx.eszkoz.halozat.szomszed(ctx.eszkoz, p);
      if (tul && tul.eszkoz.tipus === "switch") macTorolPort(tul.eszkoz, tul.port.nev);
      portValtozott(ctx.eszkoz, p);
    }
  }
  function modParancs(szavak, mod) {
    return {
      modok: IF_MODOK2,
      szavak: [SWITCHPORT, MODE, ...szavak],
      vegrehajt(ctx) {
        portokra(ctx, (p) => {
          p.mod = mod;
        });
      }
    };
  }
  var DYNAMIC = { szo: "dynamic", sugo: "Dinamikus mód: a trunkról a két switch egyezteti (DTP)" };
  var switchportParancsok = [
    modParancs([{ szo: "access", sugo: "Access port: egyetlen VLAN, címke nélküli keretek" }], "access"),
    modParancs([{ szo: "trunk", sugo: "Trunk port: több VLAN forgalma, 802.1Q-címkével" }], "trunk"),
    modParancs([DYNAMIC, { szo: "auto", sugo: "Akkor lesz trunk, ha a túloldal kezdeményezi (gyári érték)" }], "dinamikus-auto"),
    modParancs([DYNAMIC, { szo: "desirable", sugo: "Maga kezdeményezi a trunkot" }], "dinamikus-kezdemenyezo"),
    {
      modok: IF_MODOK2,
      szavak: [SZO.no, SWITCHPORT, { szo: "mode", sugo: "Az üzemmód visszaállítása a gyári értékre (dynamic auto)" }],
      vegrehajt(ctx) {
        portokra(ctx, (p) => {
          p.mod = "dinamikus-auto";
        });
      }
    },
    {
      modok: IF_MODOK2,
      szavak: [SWITCHPORT, ACCESS, VLAN2, { param: "szam", kulcs: "vlan", min: 1, max: 4094, sugo: "A VLAN száma" }],
      vegrehajt(ctx, { vlan }) {
        const sw = ctx.eszkoz;
        if (!sw.vlanok[vlan]) {
          if (vlan >= KITERJESZTETT_TOL2 && sw.vtpMod === "server") {
            ctx.kiir("Extended VLAN(s) not allowed in current VTP mode.", "%Failed to commit extended VLAN(s) changes.");
            return;
          }
          ctx.kiir(`% Access VLAN does not exist. Creating vlan ${vlan}`);
          sw.vlanok[vlan] = { nev: alapVlanNev(vlan), gyari: false, tamogatott: true };
        }
        portokra(ctx, (p) => {
          p.accessVlan = vlan;
        });
      }
    },
    {
      modok: IF_MODOK2,
      szavak: [SZO.no, SWITCHPORT, ACCESS, { szo: "vlan", sugo: "Vissza az 1-es VLAN-ba" }],
      vegrehajt(ctx) {
        portokra(ctx, (p) => {
          p.accessVlan = 1;
        });
      }
    }
  ];

  // src/gyartok/ios/parancsok/meg-nincs.js
  var MEG_NINCS = "(a szimulátorban még nincs meg)";
  var LISTA = {
    felhasznalo: ["connect", "disconnect", "ping", "ssh", "telnet", "terminal", "traceroute", "show interfaces"],
    priv: [
      "clear",
      "clock",
      "connect",
      "copy",
      "debug",
      "delete",
      "dir",
      "disconnect",
      "erase",
      "more",
      "ping",
      "reload",
      "setup",
      "ssh",
      "telnet",
      "terminal",
      "traceroute",
      "undebug",
      "write",
      "show interfaces"
    ],
    konfig: [
      "aaa",
      "access-list",
      "banner",
      "boot",
      "cdp",
      "clock",
      "crypto",
      "default",
      "enable",
      "ip",
      "line",
      "logging",
      "mac",
      "ntp",
      "service",
      "snmp-server",
      "spanning-tree",
      "username",
      "vtp"
    ],
    "konfig-if": [
      "cdp",
      "channel-group",
      "description",
      "duplex",
      "ip",
      "spanning-tree",
      "speed",
      "switchport trunk",
      "switchport nonegotiate",
      "switchport port-security",
      "switchport voice"
    ],
    "konfig-if-tartomany": [
      "cdp",
      "channel-group",
      "description",
      "duplex",
      "spanning-tree",
      "speed",
      "switchport trunk",
      "switchport nonegotiate",
      "switchport port-security",
      "switchport voice"
    ]
  };
  var megNincsParancsok = Object.entries(LISTA).flatMap(
    ([mod, nevek]) => nevek.map((nev) => ({
      modok: [mod],
      // Csak az utolsó szó új; az előtte lévők (pl. switchport) már meglévő parancsok szavai.
      szavak: nev.split(" ").map((szo) => ({ szo, sugo: MEG_NINCS })),
      nincsMeg: true,
      vegrehajt(ctx) {
        ctx.kiir(`[Szimulátor] A(z) „${nev}” parancs a valódi eszközön létezik, de a szimulátorban még nincs meg.`, "");
      }
    }))
  );

  // src/gyartok/ios/index.js
  var TIPUS_LEIRASOK = {
    FastEthernet: "FastEthernet (100 Mbit/s) port",
    GigabitEthernet: "GigabitEthernet (1 Gbit/s) port"
  };
  var ios = {
    nev: "ios",
    felirat: "IOS-szerű parancssor",
    modok: MODOK,
    kezdoMod: "felhasznalo",
    parancsok: [...alapParancsok, ...vlanParancsok, ...interfeszParancsok, ...switchportParancsok, ...showParancsok, ...megNincsParancsok],
    formazHiba,
    formazSugo,
    /** Az értelmezőnek szükséges eszközadatok. */
    kornyezet(eszkoz) {
      return { portTipusok: portTipusok(eszkoz), tipusLeirasok: TIPUS_LEIRASOK };
    },
    /**
     * Módváltáskor: ha a konfigurációs módból kilépünk, az eszköz naplóüzenetet ír
     * (először kiírja az új promptot, utána jön az üzenet – így néz ki a valódi konzolon is).
     */
    modValtasKor(regi, uj, ctx) {
      if (MODOK[regi].konfig && !MODOK[uj].konfig) {
        ctx.kiir(ctx.prompt());
        ctx.naplo("%SYS-5-CONFIG_I: Configured from console by console");
      }
    },
    /** Ctrl+Z: konfigurációs módból vissza a privilegizált módba. */
    ctrlZ(ctx) {
      if (MODOK[ctx.mod].konfig) ctx.modValt("priv");
    }
  };

  // src/nezet/terminal.js
  var OLDAL_SOROK = 23;
  var MAX_SOROK = 1e3;
  function elem(tag, osztaly, szoveg) {
    const e = document.createElement(tag);
    if (osztaly) e.className = osztaly;
    if (szoveg !== void 0) e.textContent = szoveg;
    return e;
  }
  var Terminal = class {
    /**
     * @param {HTMLElement} szulo – ide kerül a terminál
     * @param {import('../cli/terminal-munkamenet.js').Munkamenet} munkamenet
     * @param {{cim?: string, parancsUtan?: (sor: string) => void}} [beallitasok]
     */
    constructor(szulo, munkamenet, beallitasok = {}) {
      this.mm = munkamenet;
      this.beallitasok = beallitasok;
      this.tortenetIndex = null;
      this.piszkozat = "";
      this.foglalt = false;
      this.lapozas = null;
      this.doboz = elem("section", "hsz-terminal");
      this.doboz.setAttribute("aria-label", "IOS-szerű parancssor");
      this.fej = elem("div", "hsz-terminal__fej");
      this.fejCim = elem("span", "hsz-terminal__cim");
      this.fej.append(elem("span", "hsz-terminal__pottyok"), this.fejCim);
      this.kepernyo = elem("div", "hsz-terminal__kepernyo");
      this.kimenet = elem("div", "hsz-terminal__kimenet");
      this.kimenet.setAttribute("role", "log");
      this.kimenet.setAttribute("aria-live", "polite");
      this.sor = elem("div", "hsz-terminal__sor");
      this.promptElem = elem("span", "hsz-terminal__prompt");
      this.bevitel = elem("input", "hsz-terminal__bevitel");
      Object.assign(this.bevitel, { type: "text", autocomplete: "off", spellcheck: false });
      this.bevitel.setAttribute("autocapitalize", "off");
      this.bevitel.setAttribute("autocorrect", "off");
      this.bevitel.setAttribute("aria-label", "Parancs");
      this.bevitel.setAttribute("enterkeyhint", "send");
      this.sor.append(this.promptElem, this.bevitel);
      this.kepernyo.append(this.kimenet, this.sor);
      this.gombsor = elem("div", "hsz-terminal__gombok");
      this.gombok = {
        sugo: this.gomb("?", "Súgó", () => this.sugo()),
        tab: this.gomb("Tab", "Kiegészítés", () => this.tab()),
        fel: this.gomb("↑", "Előző parancs", () => this.tortenetLep(-1)),
        le: this.gomb("↓", "Következő parancs", () => this.tortenetLep(1)),
        ctrlz: this.gomb("Ctrl+Z", "Kilépés a konfigurációs módból", () => this.ctrlZ()),
        tovabb: this.gomb("Tovább", "Következő oldal (szóköz)", () => this.lapozasLep("oldal")),
        kilep: this.gomb("Kilépés", "A lista vége (q)", () => this.lapozasLep("kilep"))
      };
      this.doboz.append(this.fej, this.kepernyo, this.gombsor);
      szulo.append(this.doboz);
      this.bevitel.addEventListener("keydown", (e) => this.billentyu(e));
      this.bevitel.addEventListener("input", () => this.bevitelValtozott());
      this.kepernyo.addEventListener("click", () => {
        if (!window.getSelection || String(window.getSelection()) === "") this.fokusz();
      });
      this.kepernyo.tabIndex = -1;
      this.kepernyo.addEventListener("keydown", (e) => {
        if (this.lapozas && e.target === this.kepernyo) this.lapozasBillentyu(e);
      });
      this.frissitPrompt();
      this.gombAllapot();
    }
    /** @private */
    gomb(felirat, cim, fn) {
      const g = elem("button", "hsz-terminal__gomb", felirat);
      g.type = "button";
      g.title = cim;
      g.setAttribute("aria-label", cim);
      g.addEventListener("mousedown", (e) => e.preventDefault());
      g.addEventListener("click", () => {
        fn();
        if (!this.lapozas) this.fokusz();
      });
      this.gombsor.append(g);
      return g;
    }
    fokusz() {
      if (this.lapozas) this.kepernyo.focus({ preventScroll: true });
      else this.bevitel.focus({ preventScroll: true });
    }
    /** A fejléc felirata (pl. a gépnév). */
    cim(szoveg) {
      this.fejCim.textContent = szoveg;
    }
    // -------------------------------------------------------------------------
    // Kiírás
    // -------------------------------------------------------------------------
    /** Egy kimeneti sor. A „[Szimulátor]” kezdetű sorok a szimulátor saját megjegyzései. */
    kiirSor(szoveg) {
      const s = elem("div", "hsz-terminal__kisor");
      if (szoveg.startsWith("[Szimulátor]")) s.classList.add("hsz-terminal__megjegyzes");
      s.textContent = szoveg === "" ? " " : szoveg;
      this.kimenet.append(s);
      this.vagas();
    }
    /** A beírt sor visszaírása: sárga prompt + fehér parancs. */
    visszhang(prompt, szoveg) {
      const s = elem("div", "hsz-terminal__kisor");
      s.append(elem("span", "hsz-terminal__prompt", prompt), document.createTextNode(szoveg));
      if (!prompt && !szoveg) s.textContent = " ";
      this.kimenet.append(s);
      this.vagas();
    }
    /** @private – a túl régi sorok eldobása, és görgetés az aljára */
    vagas() {
      while (this.kimenet.childElementCount > MAX_SOROK) this.kimenet.firstElementChild.remove();
      this.kepernyo.scrollTop = this.kepernyo.scrollHeight;
    }
    frissitPrompt() {
      this.promptElem.textContent = this.mm.prompt();
    }
    /** @private */
    gombAllapot() {
      const lapoz = !!this.lapozas;
      const nincs = {
        sugo: this.mm.sugoBillentyu === false,
        tab: this.mm.vanTab === false,
        ctrlz: this.mm.vanCtrlZ === false
      };
      for (const [nev, g] of Object.entries(this.gombok)) {
        const lapozoGomb = nev === "tovabb" || nev === "kilep";
        g.hidden = lapoz ? !lapozoGomb : lapozoGomb || !!nincs[nev];
        g.disabled = this.foglalt && !lapoz;
      }
    }
    /**
     * Magától érkező sor (pl. az eszköz naplóüzenete, %LINK-3-UPDOWN): a beírás alatt álló
     * sor fölé kerül, a gépelést nem zavarja.
     */
    aszinkronSor(szoveg) {
      this.kiirSor(szoveg);
    }
    /**
     * Kimenet kiírása sorban. A { varj: ms } elemeknél vár; a { folyamat } elem fokozatosan ír
     * (pl. a ping válaszai, ahogy megérkeznek); { torles } = képernyőtörlés. Lapozható kimenetnél
     * oldalanként megáll (--More--).
     * @param {Array<string|{varj:number}|{folyamat: Function}|{torles: true}>} elemek
     * @param {boolean} lapozhato
     */
    async kiirMind(elemek, lapozhato) {
      this.foglalt = true;
      this.sor.hidden = true;
      this.gombAllapot();
      if (lapozhato && elemek.length > OLDAL_SOROK) {
        await new Promise((kesz) => this.lapozasIndit(elemek, kesz));
      } else {
        for (const e of elemek) {
          if (typeof e === "string") this.kiirSor(e);
          else if (e.folyamat) await new Promise((kesz) => e.folyamat((sor2) => this.kiirSor(sor2), kesz));
          else if (e.torles) this.kimenet.textContent = "";
          else await new Promise((r) => setTimeout(r, e.varj));
        }
      }
      this.foglalt = false;
      this.sor.hidden = false;
      this.frissitPrompt();
      this.gombAllapot();
      this.vagas();
      this.fokusz();
    }
    // -------------------------------------------------------------------------
    // Lapozás (--More--)
    // -------------------------------------------------------------------------
    /** @private */
    lapozasIndit(sorok, kesz) {
      this.lapozas = { sorok: sorok.filter((s) => typeof s === "string"), hol: 0, kesz, more: null };
      this.lapozasKiir(OLDAL_SOROK);
    }
    /** @private – `db` sor kiírása, utána --More--, vagy vége */
    lapozasKiir(db) {
      const l = this.lapozas;
      if (l.more) l.more.remove();
      const veg = Math.min(l.sorok.length, l.hol + db);
      for (; l.hol < veg; l.hol++) this.kiirSor(l.sorok[l.hol]);
      if (l.hol >= l.sorok.length) return this.lapozasVege();
      l.more = elem("div", "hsz-terminal__kisor hsz-terminal__more", " --More-- ");
      this.kimenet.append(l.more);
      this.vagas();
      this.gombAllapot();
      this.kepernyo.focus({ preventScroll: true });
    }
    /** @private */
    lapozasVege() {
      const l = this.lapozas;
      if (l.more) l.more.remove();
      this.lapozas = null;
      l.kesz();
    }
    /** @private */
    lapozasLep(mit) {
      if (!this.lapozas) return;
      if (mit === "oldal") this.lapozasKiir(OLDAL_SOROK);
      else if (mit === "sor") this.lapozasKiir(1);
      else this.lapozasVege();
    }
    /** @private */
    lapozasBillentyu(e) {
      e.preventDefault();
      if (e.key === " ") this.lapozasLep("oldal");
      else if (e.key === "Enter") this.lapozasLep("sor");
      else if (e.key.length === 1 || e.key === "Escape") this.lapozasLep("kilep");
    }
    // -------------------------------------------------------------------------
    // Bevitel
    // -------------------------------------------------------------------------
    /** @private */
    billentyu(e) {
      if (this.lapozas) return this.lapozasBillentyu(e);
      if (this.foglalt) {
        e.preventDefault();
        return;
      }
      const ctrl = e.ctrlKey && !e.altKey && !e.metaKey;
      const k = e.key;
      if (k === "Enter") {
        e.preventDefault();
        this.enter();
      } else if (k === "Tab") {
        e.preventDefault();
        this.tab();
      } else if (k === "?" && this.mm.sugoBillentyu !== false) {
        e.preventDefault();
        this.sugo();
      } else if (k === "ArrowUp" || ctrl && (k === "p" || k === "P")) {
        e.preventDefault();
        this.tortenetLep(-1);
      } else if (k === "ArrowDown" || ctrl && (k === "n" || k === "N")) {
        e.preventDefault();
        this.tortenetLep(1);
      } else if (ctrl && (k === "z" || k === "Z")) {
        e.preventDefault();
        this.ctrlZ();
      } else if (ctrl && (k === "a" || k === "A")) {
        e.preventDefault();
        this.bevitel.setSelectionRange(0, 0);
      } else if (ctrl && (k === "e" || k === "E")) {
        e.preventDefault();
        const n = this.bevitel.value.length;
        this.bevitel.setSelectionRange(n, n);
      }
    }
    /** Telefonon a ? nem mindig jön billentyűeseményként: itt kapjuk el. */
    bevitelValtozott() {
      if (this.mm.sugoBillentyu === false) return;
      const v = this.bevitel.value;
      const hol = v.indexOf("?");
      if (hol >= 0) {
        this.bevitel.value = v.slice(0, hol) + v.slice(hol + 1);
        this.bevitel.setSelectionRange(hol, hol);
        this.sugo();
      }
    }
    /** @private */
    enter() {
      const szoveg = this.bevitel.value;
      const prompt = this.mm.prompt();
      this.bevitel.value = "";
      this.tortenetIndex = null;
      this.visszhang(prompt, szoveg);
      const r = this.mm.bevitel(szoveg);
      if (this.beallitasok.parancsUtan && szoveg.trim() !== "") this.beallitasok.parancsUtan(szoveg);
      this.kiirMind(r.kimenet, r.lapozhato);
    }
    /** ? – súgó a kurzor előtti szöveghez; utána a sor visszakerül a mezőbe. */
    sugo() {
      var _a;
      if (this.foglalt) return;
      const teljes = this.bevitel.value;
      const kurzor = (_a = this.bevitel.selectionStart) != null ? _a : teljes.length;
      const eleje = teljes.slice(0, kurzor);
      this.visszhang(this.mm.prompt(), eleje + "?");
      const r = this.mm.sugo(eleje);
      for (const s of r.kimenet) this.kiirSor(s);
      this.bevitel.value = eleje;
      this.frissitPrompt();
      this.fokusz();
    }
    /** Tab – kiegészítés (ha nem egyértelmű, nem változik semmi, mint a valódi eszközön). */
    tab() {
      if (this.foglalt) return;
      const uj = this.mm.kiegeszit(this.bevitel.value);
      if (uj !== null) this.bevitel.value = uj;
      const n = this.bevitel.value.length;
      this.bevitel.setSelectionRange(n, n);
    }
    /** Ctrl+Z – vissza a privilegizált módba. */
    ctrlZ() {
      if (this.foglalt || this.mm.vanCtrlZ === false) return;
      const prompt = this.mm.prompt();
      const szoveg = this.bevitel.value;
      this.bevitel.value = "";
      this.tortenetIndex = null;
      this.visszhang(prompt, szoveg + "^Z");
      const r = this.mm.ctrlZ();
      this.kiirMind(r.kimenet, false);
    }
    /** Előzmények: -1 = régebbi, +1 = újabb. */
    tortenetLep(irany) {
      if (this.foglalt) return;
      const lista = this.mm.tortenet();
      if (lista.length === 0) return;
      if (this.tortenetIndex === null) {
        if (irany > 0) return;
        this.piszkozat = this.bevitel.value;
        this.tortenetIndex = lista.length;
      }
      const uj = this.tortenetIndex + irany;
      if (uj < 0) return;
      if (uj >= lista.length) {
        this.tortenetIndex = null;
        this.bevitel.value = this.piszkozat;
      } else {
        this.tortenetIndex = uj;
        this.bevitel.value = lista[uj];
      }
      const n = this.bevitel.value.length;
      requestAnimationFrame(() => this.bevitel.setSelectionRange(n, n));
    }
  };

  // src/nezet/topologia.js
  var SVG_NS = "http://www.w3.org/2000/svg";
  function svg(tag, attr = {}, szoveg) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attr)) e.setAttribute(k, String(v));
    if (szoveg !== void 0) e.textContent = szoveg;
    return e;
  }
  var SW = { szel: 520, mag: 96, portSzel: 22, portMag: 17, koz: 4, nagyitas: 0.6 };
  var PC = { szel: 80, mag: 66 };
  var MOD_SZOVEG = { access: "access", trunk: "trunk", "dinamikus-auto": "dynamic auto", "dinamikus-kezdemenyezo": "dynamic desirable" };
  function swPortHely(p) {
    const sorszam = Number(p.szam.split("/")[1]);
    const kezdX = 82;
    if (p.tipus === "FastEthernet") {
      const oszlop = Math.floor((sorszam - 1) / 2);
      const csoport = Math.floor(oszlop / 6);
      return {
        x: kezdX + oszlop * (SW.portSzel + SW.koz) + csoport * 10,
        y: sorszam % 2 === 1 ? 24 : 24 + SW.portMag + 14,
        sorszam
      };
    }
    return {
      x: kezdX + 12 * (SW.portSzel + SW.koz) + 2 * 10 + 34 + (sorszam - 1) * (SW.portSzel + 10),
      y: 24 + (SW.portMag + 14) / 2,
      sorszam
    };
  }
  var Topologia = class {
    /**
     * @param {HTMLElement} szulo
     * @param {{elemek: {eszkoz: Object, x: number, y: number, tipus: string}[], halozat: Object,
     *          meret?: {szel: number, mag: number}}} adat
     * @param {{valaszt?: (eszkoz: Object) => void}} [beallitasok]
     */
    constructor(szulo, { elemek, halozat, meret }, beallitasok = {}) {
      this.elemek = elemek;
      this.halozat = halozat;
      this.beallitasok = beallitasok;
      const m = meret || { szel: 800, mag: 400 };
      this.doboz = document.createElement("section");
      this.doboz.className = "hsz-topologia";
      this.doboz.setAttribute("aria-label", "Topológia");
      this.rajz = svg("svg", { viewBox: `0 0 ${m.szel} ${m.mag}`, class: "hsz-topologia__rajz", role: "group" });
      this.rajz.append(svg("title", {}, "A hálózat rajza – kattints egy eszközre a kezeléséhez"));
      this.kabelReteg = svg("g", { class: "hsz-kabelek" });
      this.eszkozReteg = svg("g");
      this.animReteg = svg("g", { class: "hsz-anim" });
      this.rajz.append(this.kabelReteg, this.eszkozReteg, this.animReteg);
      this.doboz.append(this.rajz, this.jelmagyarazat());
      szulo.append(this.doboz);
      this.rajzok = /* @__PURE__ */ new Map();
      for (const e of elemek) {
        this.rajzok.set(e.eszkoz, e.tipus === "switch" ? this.switchRajz(e) : this.pcRajz(e));
      }
      this.kabelek = halozat.kabelek.map((k) => this.kabelRajz(k));
      this.mozgok = [];
      this.animFut = false;
      this.leiratkozas = halozat.figyel((e) => this.esemeny(e));
      this.frissit();
    }
    /** @private */
    jelmagyarazat() {
      const j = document.createElement("p");
      j.className = "hsz-jelmagyarazat";
      j.innerHTML = '<span><i class="hsz-potty hsz-potty--arp"></i>ARP</span><span><i class="hsz-potty hsz-potty--icmp"></i>ping (ICMP)</span><span><b class="hsz-cimke-minta">10</b>802.1Q-címke (VLAN)</span><span><b class="hsz-x-minta">✕</b>eldobott keret</span><span><i class="hsz-vonal-minta"></i>trunk</span>';
      return j;
    }
    /** @private – kattintható csoport egy eszköznek */
    kattinthato(g, eszkoz, leiras) {
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", leiras);
      const valaszt = () => this.beallitasok.valaszt && this.beallitasok.valaszt(eszkoz);
      g.addEventListener("click", valaszt);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          valaszt();
        }
      });
    }
    /** @private – egy switch kirajzolása (kicsinyítve) */
    switchRajz({ eszkoz, x, y }) {
      const n = SW.nagyitas;
      const kulso = svg("g", { class: "hsz-eszkoz" });
      this.kattinthato(kulso, eszkoz, `Switch: ${eszkoz.hostname} – kattints, és írj a parancssorába`);
      const g = svg("g", { transform: `translate(${x} ${y}) scale(${n})` });
      g.append(svg("rect", { x: 0, y: 0, width: SW.szel, height: SW.mag, rx: 10, class: "hsz-eszkoz__haz" }));
      g.append(svg("rect", { x: 8, y: 8, width: SW.szel - 16, height: SW.mag - 16, rx: 6, class: "hsz-eszkoz__elolap" }));
      g.append(svg("circle", { cx: 28, cy: 34, r: 5, class: "hsz-led hsz-led--be" }));
      g.append(svg("text", { x: 38, y: 38, class: "hsz-eszkoz__apro" }, "SYS"));
      g.append(svg("circle", { cx: 28, cy: 56, r: 5, class: "hsz-led" }));
      g.append(svg("text", { x: 38, y: 60, class: "hsz-eszkoz__apro" }, "MODE"));
      const portok = /* @__PURE__ */ new Map();
      for (const p of eszkoz.portok) {
        const h = swPortHely(p);
        const pg = svg("g", { class: "hsz-port" });
        const cim = svg("title");
        pg.append(cim);
        pg.append(svg("rect", { x: h.x, y: h.y, width: SW.portSzel, height: SW.portMag, rx: 2, class: "hsz-port__aljzat" }));
        pg.append(svg("rect", { x: h.x + 6, y: h.y + SW.portMag - 6, width: SW.portSzel - 12, height: 4, class: "hsz-port__nyelv" }));
        const led = svg("rect", { x: h.x + 5, y: h.y - 7, width: SW.portSzel - 10, height: 4, rx: 1, class: "hsz-led" });
        pg.append(led);
        const felul = p.tipus === "FastEthernet" && h.sorszam % 2 === 1;
        const szam = p.tipus === "FastEthernet" ? String(h.sorszam) : `G${h.sorszam}`;
        pg.append(svg("text", { x: h.x + SW.portSzel / 2, y: felul ? h.y - 10 : h.y + SW.portMag + 11, class: "hsz-eszkoz__apro hsz-kozep" }, szam));
        g.append(pg);
        portok.set(p.nev, {
          x: x + n * (h.x + SW.portSzel / 2),
          y: y + n * (h.y + SW.portMag / 2),
          led,
          pg,
          cim
        });
      }
      const felirat = svg("text", { x, y: y - 9, class: "hsz-eszkoz__nev" });
      const nev = svg("tspan");
      const tipus = svg("tspan", { class: "hsz-eszkoz__tipus", dx: 8 }, "2960-24 jellegű switch");
      felirat.append(nev, tipus);
      kulso.append(g, felirat);
      this.eszkozReteg.append(kulso);
      return { g: kulso, felirat: nev, portok, also: y + n * SW.mag, felso: y, tipus: "switch" };
    }
    /** @private – egy PC kirajzolása */
    pcRajz({ eszkoz, x, y }) {
      const g = svg("g", { class: "hsz-eszkoz hsz-eszkoz--pc", transform: `translate(${x} ${y})` });
      this.kattinthato(g, eszkoz, `PC: ${eszkoz.hostname} – kattints a beállításaihoz és a parancssorához`);
      g.append(svg("rect", { x: 0, y: 0, width: PC.szel, height: 52, rx: 6, class: "hsz-eszkoz__haz" }));
      g.append(svg("rect", { x: 6, y: 6, width: PC.szel - 12, height: 38, rx: 2, class: "hsz-pc__kepernyo" }));
      g.append(svg("text", { x: 11, y: 20, class: "hsz-pc__prompt" }, "C:\\>_"));
      g.append(svg("rect", { x: PC.szel / 2 - 6, y: 52, width: 12, height: 8, class: "hsz-eszkoz__haz" }));
      g.append(svg("rect", { x: PC.szel / 2 - 20, y: 59, width: 40, height: 7, rx: 3, class: "hsz-eszkoz__haz" }));
      const led = svg("circle", { cx: PC.szel - 9, cy: 48, r: 2.5, class: "hsz-led" });
      const cim = svg("title");
      g.append(led, cim);
      const felirat = svg("text", { x: PC.szel / 2, y: PC.mag + 18, class: "hsz-eszkoz__nev hsz-kozep" });
      const ipFelirat = svg("text", { x: PC.szel / 2, y: PC.mag + 34, class: "hsz-eszkoz__ip hsz-kozep" });
      g.append(felirat, ipFelirat);
      this.eszkozReteg.append(g);
      const portok = /* @__PURE__ */ new Map([[eszkoz.portok[0].nev, { x: x + PC.szel / 2, y, led, cim }]]);
      return { g, felirat, ipFelirat, portok, tipus: "pc" };
    }
    /** @private – egy kábel útvonala és portcímkéi */
    kabelRajz(k) {
      const ra = this.rajzok.get(k.a.eszkoz);
      const rb = this.rajzok.get(k.b.eszkoz);
      const pa = ra.portok.get(k.a.port.nev);
      const pb = rb.portok.get(k.b.port.nev);
      let d;
      const cimkek = [];
      if (ra.tipus === "switch" && rb.tipus === "switch") {
        const fent = Math.min(ra.felso, rb.felso) - 30;
        d = `M ${pa.x} ${pa.y} L ${pa.x} ${fent} L ${pb.x} ${fent} L ${pb.x} ${pb.y}`;
        cimkek.push({ x: pa.x + 5, y: ra.felso - 5, szoveg: k.a.port.rovid, igazit: "start" });
        cimkek.push({ x: pb.x - 5, y: rb.felso - 5, szoveg: k.b.port.rovid, igazit: "end" });
      } else {
        const [sw, swp, swk, pcp] = ra.tipus === "switch" ? [ra, pa, k.a, pb] : [rb, pb, k.b, pa];
        const ki = sw.also + 10;
        const forditott = sw !== ra;
        d = forditott ? `M ${pcp.x} ${pcp.y} C ${pcp.x} ${pcp.y - 80} ${swp.x} ${ki + 70} ${swp.x} ${ki} L ${swp.x} ${swp.y}` : `M ${swp.x} ${swp.y} L ${swp.x} ${ki} C ${swp.x} ${ki + 70} ${pcp.x} ${pcp.y - 80} ${pcp.x} ${pcp.y}`;
        const balra = pcp.x < swp.x;
        cimkek.push({ x: swp.x + (balra ? -5 : 5), y: sw.also + 14, szoveg: swk.port.rovid, igazit: balra ? "end" : "start" });
        cimkek.push({ x: pcp.x + 5, y: pcp.y - 6, szoveg: "Fa0", igazit: "start" });
      }
      const ut = svg("path", { d, class: "hsz-kabel" });
      this.kabelReteg.append(ut);
      for (const c of cimkek) {
        this.kabelReteg.append(svg("text", { x: c.x, y: c.y, class: "hsz-kabel__cimke", "text-anchor": c.igazit }, c.szoveg));
      }
      return { k, ut };
    }
    /** Kijelöli az éppen kezelt eszközt. */
    kijelol(eszkoz) {
      for (const [e, r] of this.rajzok) r.g.classList.toggle("hsz-eszkoz--kijelolt", e === eszkoz);
    }
    /** Újrarajzolja a változó részeket (nevek, IP-címek, LED-ek, kábelek állapota). */
    frissit() {
      for (const [eszkoz, r] of this.rajzok) {
        r.felirat.textContent = eszkoz.hostname;
        if (r.tipus === "pc") {
          r.ipFelirat.textContent = eszkoz.ip ? `${eszkoz.ip}` : "nincs IP-cím";
          r.ipFelirat.classList.toggle("hsz-eszkoz__ip--nincs", !eszkoz.ip);
          const p = r.portok.get(eszkoz.portok[0].nev);
          p.led.classList.toggle("hsz-led--be", eszkoz.portok[0].fent);
          p.cim.textContent = `${eszkoz.hostname} – ${eszkoz.ip || "nincs IP-cím"}${eszkoz.maszk ? " / " + eszkoz.maszk : ""}`;
          continue;
        }
        for (const p of eszkoz.portok) {
          const pe = r.portok.get(p.nev);
          pe.pg.classList.toggle("hsz-port--lekapcsolva", p.leallitva);
          pe.led.classList.toggle("hsz-led--be", p.fent);
          let allapot2;
          if (p.leallitva) allapot2 = "lekapcsolva (shutdown)";
          else if (p.fent) allapot2 = uzemmod(eszkoz, p) === "trunk" ? "működik, trunk" : `működik, VLAN ${p.accessVlan}`;
          else allapot2 = "nincs kábel";
          pe.cim.textContent = `${p.nev} – ${allapot2} (mód: ${MOD_SZOVEG[p.mod]})`;
        }
      }
      for (const kr of this.kabelek) {
        const { a, b } = kr.k;
        const fent = a.port.fent && b.port.fent;
        const trunk = fent && a.eszkoz.tipus === "switch" && uzemmod(a.eszkoz, a.port) === "trunk";
        kr.ut.classList.toggle("hsz-kabel--le", !fent);
        kr.ut.classList.toggle("hsz-kabel--trunk", trunk);
      }
    }
    // -------------------------------------------------------------------------
    // Animáció
    // -------------------------------------------------------------------------
    /** @private */
    esemeny(e) {
      if (e.tipus === "keret") this.csomag(e);
      else if (e.tipus === "eldobva") this.eldobva(e);
      else if (e.tipus === "allapot") this.frissit();
    }
    /** @private – egy keret elindul egy kábelen */
    csomag(e) {
      const kr = this.kabelek.find((x) => x.k === this.halozat.kabelVege(e.honnan.eszkoz, e.honnan.port));
      if (!kr || typeof kr.ut.getTotalLength !== "function") return;
      const elore = kr.k.a.eszkoz === e.honnan.eszkoz && kr.k.a.port === e.honnan.port;
      const g = svg("g", { class: `hsz-csomag hsz-csomag--${e.keret.tipus === "arp" ? "arp" : "icmp"}` });
      g.append(svg("circle", { r: 7 }));
      if (e.keret.vlan !== void 0) {
        const c = svg("g", { class: "hsz-csomag__cimke", transform: "translate(0 -16)" });
        c.append(svg("rect", { x: -13, y: -8, width: 26, height: 15, rx: 4 }));
        c.append(svg("text", { x: 0, y: 4, class: "hsz-kozep" }, String(e.keret.vlan)));
        g.append(c);
      }
      g.append(svg("title", {}, csomagLeiras(e.keret)));
      this.animReteg.append(g);
      const m = { g, ut: kr.ut, hossz: kr.ut.getTotalLength(), elore, kezd: performance.now(), ido: Math.max(1, e.idotartam) };
      this.mozgok.push(m);
      this.helyez(m, 0);
      setTimeout(() => this.torolMozgo(m), m.ido + 100);
      if (!this.animFut) {
        this.animFut = true;
        requestAnimationFrame((t) => this.kepkocka(t));
      }
    }
    /** @private */
    helyez(m, arany) {
      const hol = m.elore ? arany * m.hossz : (1 - arany) * m.hossz;
      const p = m.ut.getPointAtLength(hol);
      m.g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    }
    /** @private */
    torolMozgo(m) {
      m.g.remove();
      this.mozgok = this.mozgok.filter((x) => x !== m);
    }
    /** @private */
    kepkocka(most) {
      for (const m of this.mozgok.slice()) {
        const arany = (most - m.kezd) / m.ido;
        if (arany >= 1) this.torolMozgo(m);
        else this.helyez(m, Math.max(0, arany));
      }
      if (this.mozgok.length) requestAnimationFrame((t) => this.kepkocka(t));
      else this.animFut = false;
    }
    /** @private – ✕ jel ott, ahol egy keret elakadt */
    eldobva(e) {
      const r = this.rajzok.get(e.eszkoz);
      const p = r && r.portok.get(e.port.nev);
      if (!p) return;
      const g = svg("g", { class: "hsz-eldobva", transform: `translate(${p.x} ${p.y + (r.tipus === "switch" ? 0 : -10)})` });
      g.append(svg("circle", { r: 10 }));
      g.append(svg("text", { x: 0, y: 5, class: "hsz-kozep" }, "✕"));
      g.append(svg("title", {}, e.ok));
      this.animReteg.append(g);
      setTimeout(() => g.remove(), 2500);
    }
  };
  function csomagLeiras(k) {
    const cimke = k.vlan !== void 0 ? ` – 802.1Q-címke: VLAN ${k.vlan}` : "";
    if (k.tipus === "arp") {
      const a = k.adat;
      if (a.muvelet === "keres") return `ARP-kérdés (szórás): kié a(z) ${a.celIp}? Kérdezi: ${a.kuldoIp}${cimke}`;
      return `ARP-válasz: a(z) ${a.kuldoIp} az enyém${cimke}`;
    }
    if (k.adat && k.adat.protokoll === "icmp") {
      const fajta = k.adat.icmp.tipus === "echo-keres" ? "ping-kérés (echo request)" : "ping-válasz (echo reply)";
      return `${fajta}: ${k.adat.forrasIp} → ${k.adat.celIp}${cimke}`;
    }
    return `keret${cimke}`;
  }

  // src/cli/pc-munkamenet.js
  var PROMPT = "C:\\>";
  var PcMunkamenet = class {
    /**
     * @param {{eszkoz: Object, halozat: import('../mag/halozat.js').Halozat}} p
     */
    constructor({ eszkoz, halozat }) {
      this.eszkoz = eszkoz;
      this.halozat = halozat;
      this.lista = [];
      this.figyelok = [];
      this.sugoBillentyu = false;
      this.vanCtrlZ = false;
      this.vanTab = false;
    }
    figyel(fn) {
      this.figyelok.push(fn);
    }
    prompt() {
      return PROMPT;
    }
    tortenet() {
      return this.lista;
    }
    sugo(sor2) {
      return { kimenet: [], sor: sor2 };
    }
    kiegeszit() {
      return null;
    }
    ctrlZ() {
      return { kimenet: [] };
    }
    /**
     * @param {string} sor
     * @returns {{kimenet: Array<string|{varj:number}|{folyamat: Function}|{torles: true}>, lapozhato: boolean}}
     */
    bevitel(sor2) {
      const kimenet = [];
      const s = sor2.trim();
      if (s === "") return { kimenet, lapozhato: false };
      if (this.lista[this.lista.length - 1] !== s) this.lista.push(s);
      while (this.lista.length > TORTENET_MERET * 2) this.lista.shift();
      const szavak = s.split(/\s+/);
      const parancs = szavak[0].toLowerCase();
      const arg = szavak.slice(1);
      if (parancs === "ping") kimenet.push(...this.ping(arg));
      else if (parancs === "ipconfig") kimenet.push(...this.ipconfig(arg));
      else if (parancs === "arp") kimenet.push(...this.arp(arg));
      else if (parancs === "hostname") kimenet.push(this.eszkoz.hostname, "");
      else if (parancs === "cls") kimenet.push({ torles: true });
      else if (parancs === "help" || parancs === "?" || parancs === "/?") kimenet.push(...sugoSzoveg());
      else {
        kimenet.push(
          `'${szavak[0]}' is not recognized as an internal or external command,`,
          "operable program or batch file.",
          "",
          "[Szimulátor] A gépen használható parancsok: ping, ipconfig, arp -a, hostname, cls, help",
          ""
        );
      }
      for (const fn of this.figyelok) fn();
      return { kimenet, lapozhato: false };
    }
    /** @private */
    ping(arg) {
      let db = 4;
      let cel = null;
      for (let i = 0; i < arg.length; i++) {
        const a = arg[i].toLowerCase();
        if (a === "-n" || a === "/n") {
          const n = Number(arg[++i]);
          if (!Number.isInteger(n) || n < 1 || n > 100) {
            return ["Bad value for option -n, valid range is from 1 to 100.", ""];
          }
          db = n;
        } else if (a.startsWith("-") || a.startsWith("/")) {
          return [`Bad option ${arg[i]}.`, "", ...pingHasznalat()];
        } else {
          cel = arg[i];
        }
      }
      if (cel === null) return pingHasznalat();
      if (!ervenyesIp(cel)) {
        return [`Ping request could not find host ${cel}. Please check the name and try again.`, ""];
      }
      return ["", `Pinging ${cel} with 32 bytes of data:`, { folyamat: (kiir, kesz) => this.pingFolyamat(cel, db, kiir, kesz) }];
    }
    /** @private – a ping válaszai egyenként, ahogy megérkeznek */
    pingFolyamat(cel, db, kiir, kesz) {
      const h = this.halozat;
      const pc = this.eszkoz;
      let elkuldve = 0;
      let fogadva = 0;
      let valaszok = 0;
      const fajtak = /* @__PURE__ */ new Set();
      const egy = () => {
        if (elkuldve >= db) return vege();
        elkuldve++;
        egyPing(h, pc, cel, (e) => {
          fajtak.add(e.fajta);
          let szunet = 1e3;
          if (e.fajta === "valasz") {
            kiir(`Reply from ${cel}: bytes=32 time<1ms TTL=${e.ttl}`);
            fogadva++;
            valaszok++;
          } else if (e.fajta === "idotullepes") {
            kiir("Request timed out.");
            szunet = 0;
          } else if (e.fajta === "elerhetetlen") {
            kiir(`Reply from ${pc.ip}: Destination host unreachable.`);
            fogadva++;
            szunet = 0;
          } else {
            kiir("PING: transmit failed. General failure. ");
            szunet = 500;
          }
          if (elkuldve >= db) return vege();
          h.ora.utemez(szunet, egy);
        });
      };
      const vege = () => {
        const elveszett = elkuldve - fogadva;
        kiir("");
        kiir(`Ping statistics for ${cel}:`);
        kiir(`    Packets: Sent = ${elkuldve}, Received = ${fogadva}, Lost = ${elveszett} (${Math.round(elveszett / elkuldve * 100)}% loss),`);
        if (valaszok > 0) {
          kiir("Approximate round trip times in milli-seconds:");
          kiir("    Minimum = 0ms, Maximum = 0ms, Average = 0ms");
        }
        kiir("");
        for (const m of this.magyarazat(cel, fajtak)) kiir(m);
        kesz();
      };
      egy();
    }
    /** @private – rövid magyarázat a sikertelen pinghez (a szimulátor saját megjegyzése) */
    magyarazat(cel, fajtak) {
      const pc = this.eszkoz;
      const m = [];
      if (fajtak.has("hiba")) {
        if (!vanIp(pc)) m.push("[Szimulátor] Ennek a gépnek még nincs IP-címe vagy maszkja (kattints a beállításokra fent).");
        else if (!pc.portok[0].fent) m.push("[Szimulátor] Nincs link: a gép kábele egy lekapcsolt portra csatlakozik.");
        else if (!kovetkezoUgras(pc, cel)) {
          m.push("[Szimulátor] A cél másik hálózatban van, és nincs alapértelmezett átjáró, ezért a csomag el sem indul.");
        }
      }
      if (fajtak.has("elerhetetlen")) {
        m.push("[Szimulátor] A „Destination host unreachable” a saját gépedtől jön: senki nem válaszolt az ARP-kérdésre, hogy kié ez a cím. A gép ezt is „Received”-nek számolja.");
      }
      if (m.length) m.push("");
      return m;
    }
    /** @private */
    ipconfig(arg) {
      const pc = this.eszkoz;
      const minden = arg.some((a) => a.toLowerCase() === "/all");
      if (arg.length && !minden) return ["", `Error: unrecognized or incomplete command line.`, "", "[Szimulátor] Használat: ipconfig vagy ipconfig /all", ""];
      const s = [""];
      if (minden) s.push(`   Host Name . . . . . . . . . . . . : ${pc.hostname}`, "");
      s.push("Ethernet adapter FastEthernet0:", "");
      if (!pc.portok[0].fent) {
        s.push("   Media State . . . . . . . . . . . : Media disconnected");
      }
      s.push("   Connection-specific DNS Suffix  . :");
      if (minden) s.push(`   Physical Address. . . . . . . . . : ${macKotojeles(pc.mac)}`);
      s.push(`   IPv4 Address. . . . . . . . . . . : ${pc.ip || "0.0.0.0"}`);
      s.push(`   Subnet Mask . . . . . . . . . . . : ${pc.maszk || "0.0.0.0"}`);
      s.push(`   Default Gateway . . . . . . . . . : ${pc.atjaro}`.trimEnd());
      s.push("");
      return s;
    }
    /** @private */
    arp(arg) {
      const pc = this.eszkoz;
      const kapcsolo = (arg[0] || "").toLowerCase();
      if (kapcsolo === "-a" || kapcsolo === "-g") {
        const sorok = Object.entries(pc.arpTabla);
        if (sorok.length === 0) return ["No ARP Entries Found.", ""];
        const s = ["", `Interface: ${pc.ip || "0.0.0.0"} --- 0x2`, "  Internet Address      Physical Address      Type"];
        for (const [ip, b] of sorok) s.push(`  ${ip.padEnd(22)}${macKotojeles(b.mac).toLowerCase().padEnd(22)}dynamic`);
        s.push("");
        return s;
      }
      if (kapcsolo === "-d") {
        pc.arpTabla = {};
        return [""];
      }
      return ["", "[Szimulátor] Használat: arp -a (az ARP-gyorstár kiírása), arp -d (törlése)", ""];
    }
  };
  function pingHasznalat() {
    return [
      "",
      "Usage: ping [-n count] target_name",
      "",
      "[Szimulátor] Példa: ping 192.168.10.13 (a -n után megadható, hány csomagot küldjön; alapból 4)",
      ""
    ];
  }
  function sugoSzoveg() {
    return [
      "",
      "[Szimulátor] A gépen használható parancsok:",
      "[Szimulátor]   ping <IP-cím>      – elér-e egy másik gépet (ping -n 2 … = csak 2 csomag)",
      "[Szimulátor]   ipconfig           – a gép IP-beállításai (ipconfig /all: MAC-címmel együtt)",
      "[Szimulátor]   arp -a             – az ARP-gyorstár: melyik IP-címhez melyik MAC tartozik",
      "[Szimulátor]   arp -d             – az ARP-gyorstár törlése",
      "[Szimulátor]   hostname           – a gép neve",
      "[Szimulátor]   cls                – a képernyő törlése",
      ""
    ];
  }

  // src/nezet/pc-ablak.js
  function elem2(tag, osztaly, szoveg) {
    const e = document.createElement(tag);
    if (osztaly) e.className = osztaly;
    if (szoveg !== void 0) e.textContent = szoveg;
    return e;
  }
  function maszkAlak(szoveg) {
    const m = /^\/?(\d{1,2})$/.exec(szoveg.trim());
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 32) return szoveg.trim();
    const n = Number(m[1]);
    return ipSzoveg(n === 32 ? 4294967295 : ~((1 << 32 - n) - 1) >>> 0);
  }
  var PcAblak = class {
    /**
     * @param {HTMLElement} szulo
     * @param {{eszkoz: Object, halozat: Object, valtozott?: () => void}} p
     */
    constructor(szulo, { eszkoz, halozat, valtozott = () => {
    } }) {
      this.pc = eszkoz;
      this.valtozott = valtozott;
      this.doboz = elem2("section", "hsz-pc-ablak");
      this.doboz.setAttribute("aria-label", `${eszkoz.hostname} – IP-beállítások és parancssor`);
      const urlap = elem2("form", "hsz-pc-urlap");
      urlap.noValidate = true;
      const cim = elem2("h3", "hsz-pc-urlap__cim", "IP-beállítások");
      urlap.append(cim);
      this.mezok = {
        ip: this.mezo(urlap, "IP-cím", "pl. 192.168.10.11"),
        maszk: this.mezo(urlap, "Alhálózati maszk", "pl. 255.255.255.0"),
        atjaro: this.mezo(urlap, "Alapértelmezett átjáró", "most nem kell")
      };
      const sor2 = elem2("div", "hsz-pc-urlap__gombsor");
      const mentes = elem2("button", "hsz-gomb", "Mentés");
      mentes.type = "submit";
      this.uzenet = elem2("span", "hsz-pc-urlap__uzenet");
      this.uzenet.setAttribute("role", "status");
      sor2.append(mentes, this.uzenet);
      urlap.append(sor2);
      urlap.addEventListener("submit", (e) => {
        e.preventDefault();
        this.ment();
      });
      this.terminalHely = elem2("div", "hsz-pc-ablak__terminal");
      this.doboz.append(urlap, this.terminalHely);
      szulo.append(this.doboz);
      this.munkamenet = new PcMunkamenet({ eszkoz, halozat });
      this.terminal = new Terminal(this.terminalHely, this.munkamenet);
      this.terminal.cim(`${eszkoz.hostname} – parancssor`);
      this.betolt();
    }
    /** @private */
    mezo(urlap, felirat, pelda) {
      const l = elem2("label", "hsz-pc-urlap__mezo");
      const t = elem2("span", "", felirat);
      const i = elem2("input");
      Object.assign(i, { type: "text", inputMode: "decimal", autocomplete: "off", spellcheck: false, placeholder: pelda });
      l.append(t, i);
      urlap.append(l);
      return i;
    }
    /** Az aktuális beállítás a mezőkbe. */
    betolt() {
      this.mezok.ip.value = this.pc.ip;
      this.mezok.maszk.value = this.pc.maszk;
      this.mezok.atjaro.value = this.pc.atjaro;
    }
    /** @private */
    jelez(szoveg, hiba, mezo) {
      this.uzenet.textContent = szoveg;
      this.uzenet.classList.toggle("hsz-pc-urlap__uzenet--hiba", !!hiba);
      for (const m of Object.values(this.mezok)) m.removeAttribute("aria-invalid");
      if (mezo) {
        mezo.setAttribute("aria-invalid", "true");
        mezo.focus();
      }
    }
    /** @private – ellenőrzés és mentés */
    ment() {
      const ip = this.mezok.ip.value.trim();
      const maszk = maszkAlak(this.mezok.maszk.value);
      const atjaro = this.mezok.atjaro.value.trim();
      this.mezok.maszk.value = maszk;
      if (ip === "" && maszk === "" && atjaro === "") {
        ipBeallit(this.pc, { ip: "", maszk: "", atjaro: "" });
        this.jelez("A beállítás törölve.");
        return this.valtozott();
      }
      if (!ervenyesIp(ip)) return this.jelez("Érvénytelen IP-cím (négy 0–255 közötti szám, ponttal elválasztva).", true, this.mezok.ip);
      if (maszk === "") return this.jelez("Add meg az alhálózati maszkot is.", true, this.mezok.maszk);
      const hiba = gepcimHiba(ip, maszk);
      if (hiba) return this.jelez(hiba, true, /maszk/.test(hiba) ? this.mezok.maszk : this.mezok.ip);
      if (atjaro !== "" && !ervenyesIp(atjaro)) return this.jelez("Érvénytelen átjárócím.", true, this.mezok.atjaro);
      ipBeallit(this.pc, { ip, maszk, atjaro });
      if (atjaro !== "" && !egyHalozat(ip, atjaro, maszk)) {
        this.jelez("Mentve – de figyelem: az átjáró nincs a gép hálózatában, így nem használható.");
      } else {
        this.jelez("Mentve.");
      }
      this.valtozott();
    }
    /** Megjelenítés / elrejtés. */
    mutat(lathato) {
      this.doboz.hidden = !lathato;
      if (lathato) this.betolt();
    }
  };

  // src/feladat/ellenorzo.js
  var MOD_SZOVEG2 = { access: "access", trunk: "trunk", "dinamikus-auto": "dynamic auto", "dinamikus-kezdemenyezo": "dynamic desirable" };
  function rovid(nev) {
    return nev.replace(/^FastEthernet/, "Fa").replace(/^GigabitEthernet/, "Gi");
  }
  var ALLAPOT_CELOK = {
    vlan(f, c) {
      const sw = f.eszkoz(c.eszkoz);
      const v = sw.vlanok[c.vlan];
      if (!v) return { ok: false, megjegyzes: `A(z) ${c.vlan}-es VLAN nincs létrehozva (${c.eszkoz}).` };
      if (c.nev && v.nev !== c.nev) return { ok: false, megjegyzes: `A VLAN neve most: ${v.nev} (${c.nev} kellene).` };
      return { ok: true, megjegyzes: `Megvan: ${c.vlan} ${v.nev}` };
    },
    "access-port"(f, c) {
      const sw = f.eszkoz(c.eszkoz);
      const p = portKeres(sw, c.port);
      const hibak = [];
      if (p.mod !== "access") hibak.push(`a port üzemmódja most ${MOD_SZOVEG2[p.mod]} (access kellene)`);
      if (p.accessVlan !== c.vlan) hibak.push(`a port most a(z) ${p.accessVlan}-es VLAN-ban van`);
      else if (!sw.vlanok[c.vlan]) hibak.push(`a(z) ${c.vlan}-es VLAN nem létezik ezen a switchen`);
      if (p.leallitva) hibak.push("a port le van kapcsolva (shutdown)");
      if (hibak.length) return { ok: false, megjegyzes: hibak.join("; ") + "." };
      return { ok: true, megjegyzes: `access, VLAN ${c.vlan}` };
    },
    trunk(f, c) {
      const sw = f.eszkoz(c.eszkoz);
      const p = portKeres(sw, c.port);
      if (!p.fent) return { ok: false, megjegyzes: `Nincs link a(z) ${rovid(p.nev)} porton (le van kapcsolva?).` };
      const tul = sw.halozat.szomszed(sw, p);
      const vegek = [[sw, p], [tul.eszkoz, tul.port]];
      const rossz = vegek.filter(([e, pp]) => uzemmod(e, pp) !== "trunk");
      if (rossz.length) {
        const leiras = rossz.map(([e, pp]) => `${e.hostname} ${rovid(pp.nev)}: ${MOD_SZOVEG2[pp.mod]}`).join(", ");
        return { ok: false, megjegyzes: `Nem lett trunk (${leiras}). Két „dynamic auto” port nem kezdeményez trunkot.` };
      }
      const modok = vegek.map(([e, pp]) => `${e.hostname}: ${MOD_SZOVEG2[pp.mod]}`).join(", ");
      return { ok: true, megjegyzes: `Mindkét vég trunkként működik (${modok}).` };
    },
    "pc-ip"(f, c) {
      const pc = f.eszkoz(c.eszkoz);
      if (!pc.ip) return { ok: false, megjegyzes: `${c.eszkoz}-nek még nincs IP-címe (kattints a gépre).` };
      const hibak = [];
      if (pc.ip !== c.ip) hibak.push(`IP-cím most: ${pc.ip} (${c.ip} kellene)`);
      if (pc.maszk !== c.maszk) hibak.push(`maszk most: ${pc.maszk || "nincs"} (${c.maszk} kellene)`);
      if (hibak.length) return { ok: false, megjegyzes: hibak.join("; ") + "." };
      return { ok: true, megjegyzes: `${pc.ip} / ${pc.maszk}` };
    }
  };
  function tervezettIp(f, nev) {
    const sor2 = (f.feladat.cimterv || []).find((s) => s.eszkoz === nev);
    return sor2 ? sor2.ip : f.eszkoz(nev).ip;
  }
  var PING_SZOVEG = {
    valasz: "Megjött a válasz.",
    idotullepes: "Nem jött válasz (Request timed out).",
    elerhetetlen: "Nem jött ARP-válasz: a cél nem érhető el ebben a szórási tartományban (Destination host unreachable).",
    hiba: "A ping el sem indult: nincs IP-cím, vagy a cél másik hálózatban van, és nincs alapértelmezett átjáró."
  };
  var PROBA_CELOK = {
    ping(f, c, kesz) {
      const ip = tervezettIp(f, c.cel);
      egyPing(f.halozat, f.eszkoz(c.honnan), ip, (e) => {
        const ment = e.fajta === "valasz";
        const vart = c.vart !== false;
        let megjegyzes = `${c.honnan} → ${ip}: ${PING_SZOVEG[e.fajta]}`;
        if (!vart && ment) megjegyzes += " Pedig ennek nem szabadna sikerülnie!";
        kesz({ ok: ment === vart, megjegyzes });
      });
    },
    szoras(f, c, kesz) {
      szorasProba(f.halozat, f.eszkoz(c.honnan), (kik) => {
        const nevek = c.elerje.concat(c.neErje);
        const elerte = nevek.filter((n) => kik.includes(f.eszkoz(n)));
        const hianyzik = (c.elerje || []).filter((n) => !elerte.includes(n));
        const tilos = (c.neErje || []).filter((n) => elerte.includes(n));
        const reszek = [`Eljutott ide: ${elerte.length ? elerte.join(", ") : "senkihez"}.`];
        if (hianyzik.length) reszek.push(`Nem jutott el ide, pedig kellene: ${hianyzik.join(", ")}.`);
        if (tilos.length) reszek.push(`Ide nem szabadna eljutnia (más VLAN): ${tilos.join(", ")}.`);
        kesz({ ok: hianyzik.length === 0 && tilos.length === 0, megjegyzes: reszek.join(" ") });
      });
    }
  };
  function probaE(cel) {
    return !!PROBA_CELOK[cel.tipus];
  }
  function ellenoriz(f, { indul = () => {
  }, lepes = () => {
  }, kesz = () => {
  }, szunet = 0 } = {}) {
    const celok = f.feladat.celok;
    const eredmenyek = new Array(celok.length).fill(null);
    const probak = [];
    celok.forEach((c, i) => {
      if (ALLAPOT_CELOK[c.tipus]) {
        eredmenyek[i] = ALLAPOT_CELOK[c.tipus](f, c);
        lepes(i, eredmenyek[i]);
      } else if (PROBA_CELOK[c.tipus]) {
        probak.push(i);
      } else {
        throw new Error(`Ismeretlen céltípus: ${c.tipus}`);
      }
    });
    const kovetkezo = (k) => {
      if (k >= probak.length) return kesz(eredmenyek);
      const i = probak[k];
      indul(i);
      PROBA_CELOK[celok[i].tipus](f, celok[i], (e) => {
        eredmenyek[i] = e;
        lepes(i, e);
        f.halozat.ora.utemez(szunet, () => kovetkezo(k + 1));
      });
    };
    kovetkezo(0);
    return eredmenyek;
  }

  // src/nezet/panel.js
  function elem3(tag, osztaly, szoveg) {
    const e = document.createElement(tag);
    if (osztaly) e.className = osztaly;
    if (szoveg !== void 0) e.textContent = szoveg;
    return e;
  }
  var PROBA_SZUNET = 500;
  var FeladatPanel = class {
    /**
     * @param {HTMLElement} szulo
     * @param {import('../feladat/betolto.js').BetoltottFeladat} f
     * @param {{kezdes?: () => void, vege?: () => void}} [beallitasok]
     */
    constructor(szulo, f, beallitasok = {}) {
      this.f = f;
      this.beallitasok = beallitasok;
      const fd = f.feladat;
      this.doboz = elem3("section", "hsz-panel");
      this.doboz.setAttribute("aria-label", "Feladat");
      const fej = elem3("div", "hsz-panel__fej");
      fej.append(elem3("h2", "hsz-panel__cim", fd.cim));
      if (fd.szint) fej.append(elem3("span", "hsz-panel__szint", fd.szint));
      this.doboz.append(fej);
      for (const bek of fd.leiras || []) this.doboz.append(elem3("p", "hsz-panel__szoveg", bek));
      if (fd.lepesek && fd.lepesek.length) {
        this.doboz.append(elem3("h3", "hsz-panel__alcim", "Teendők"));
        const ol = elem3("ol", "hsz-panel__lepesek");
        for (const l of fd.lepesek) ol.append(elem3("li", "", l));
        this.doboz.append(ol);
      }
      if (fd.cimterv && fd.cimterv.length) {
        this.doboz.append(elem3("h3", "hsz-panel__alcim", "Címterv"));
        const tabla = elem3("table", "hsz-panel__tabla");
        const fejsor = elem3("tr");
        for (const c of ["Gép", "IP-cím", "Maszk", "VLAN", "Port"]) fejsor.append(elem3("th", "", c));
        const thead = elem3("thead");
        thead.append(fejsor);
        const tbody = elem3("tbody");
        for (const s of fd.cimterv) {
          const tr = elem3("tr");
          for (const c of [s.eszkoz, s.ip, s.maszk, s.vlan, s.hova]) tr.append(elem3("td", "", c === void 0 ? "" : String(c)));
          tbody.append(tr);
        }
        tabla.append(thead, tbody);
        const gorgeto = elem3("div", "hsz-panel__tablahely");
        gorgeto.append(tabla);
        this.doboz.append(gorgeto);
      }
      this.gomb = elem3("button", "hsz-gomb hsz-gomb--fo", "Ellenőrzés");
      this.gomb.type = "button";
      this.gomb.addEventListener("click", () => this.ellenoriz());
      this.osszegzes = elem3("p", "hsz-panel__osszegzes");
      this.osszegzes.setAttribute("role", "status");
      this.lista = elem3("ul", "hsz-celok");
      this.lista.hidden = true;
      const lab = elem3("div", "hsz-panel__lab");
      lab.append(this.osszegzes, this.gomb);
      this.doboz.append(this.lista, lab);
      szulo.append(this.doboz);
    }
    /** Az ellenőrzés indítása. */
    ellenoriz() {
      if (this.fut) return;
      this.fut = true;
      this.gomb.disabled = true;
      this.gomb.textContent = "Ellenőrzés folyik…";
      this.osszegzes.textContent = "A próbák futnak – figyeld a csomagokat a rajzon!";
      this.osszegzes.className = "hsz-panel__osszegzes";
      if (this.beallitasok.kezdes) this.beallitasok.kezdes();
      this.lista.textContent = "";
      this.lista.hidden = false;
      const sorok = this.f.feladat.celok.map((c) => {
        const li = elem3("li", "hsz-cel hsz-cel--var");
        const jel = elem3("span", "hsz-cel__jel", "·");
        jel.setAttribute("aria-hidden", "true");
        const szoveg = elem3("span", "hsz-cel__szoveg");
        const cim = elem3("span", "hsz-cel__cim", c.szoveg);
        if (c.ellenproba) cim.classList.add("hsz-cel__cim--ellenproba");
        const megj = elem3("span", "hsz-cel__megj");
        const allapot2 = elem3("span", "hsz-rejtett", probaE(c) ? "vár" : "");
        szoveg.append(cim, megj);
        li.append(jel, allapot2, szoveg);
        this.lista.append(li);
        return { li, jel, megj, allapot: allapot2 };
      });
      ellenoriz(this.f, {
        szunet: PROBA_SZUNET,
        indul: (i) => {
          sorok[i].li.className = "hsz-cel hsz-cel--fut";
          sorok[i].jel.textContent = "…";
          sorok[i].allapot.textContent = "fut";
          sorok[i].li.scrollIntoView({ block: "nearest", behavior: "smooth" });
        },
        lepes: (i, e) => {
          const s = sorok[i];
          s.li.className = `hsz-cel ${e.ok ? "hsz-cel--ok" : "hsz-cel--hiba"}`;
          s.jel.textContent = e.ok ? "✔" : "✘";
          s.allapot.textContent = e.ok ? "teljesült" : "nem teljesült";
          s.megj.textContent = e.megjegyzes;
        },
        kesz: (eredmenyek) => {
          const jo = eredmenyek.filter((e) => e.ok).length;
          const osszes = eredmenyek.length;
          if (jo === osszes) {
            this.osszegzes.textContent = `Kész! Mind a ${osszes} cél teljesült, az ellenpróbák is. Szép munka!`;
            this.osszegzes.classList.add("hsz-panel__osszegzes--siker");
          } else {
            this.osszegzes.textContent = `${jo} / ${osszes} cél teljesült. A ✘ jelűeknél olvasd el, mi a gond, javítsd, és ellenőrizz újra.`;
          }
          this.fut = false;
          this.gomb.disabled = false;
          this.gomb.textContent = "Ellenőrzés újra";
          if (this.beallitasok.vege) this.beallitasok.vege();
        }
      });
    }
  };

  // src/modell/pc.js
  function ujPc({ nev }) {
    return {
      tipus: "pc",
      modell: "pc",
      hostname: nev,
      mac: macNevbol("pc:" + nev),
      ip: "",
      maszk: "",
      atjaro: "",
      arpTabla: {},
      portok: [{ nev: "FastEthernet0", rovid: "Fa0", tipus: "FastEthernet", szam: "0", leallitva: false, fent: false }]
    };
  }

  // src/feladat/betolto.js
  function feladatLista() {
    const g = typeof window !== "undefined" ? window : globalThis;
    return g.HaloszimFeladatok || [];
  }
  function feladatKeres(azon) {
    const lista = feladatLista();
    if (!azon) return lista[0] || null;
    return lista.find((f) => f.azon === azon) || null;
  }
  function feladatBetolt(feladat, beallitasok = {}) {
    const halozat = new Halozat(beallitasok);
    const nevek = /* @__PURE__ */ new Map();
    const elemek = [];
    for (const e of feladat.topologia.eszkozok) {
      let eszkoz;
      if (e.tipus === "switch") eszkoz = ujSwitch2960({ hostname: e.nev });
      else if (e.tipus === "pc") eszkoz = ujPc({ nev: e.nev });
      else throw new Error(`Ismeretlen eszköztípus: ${e.tipus}`);
      halozat.hozzaad(eszkoz);
      nevek.set(e.nev, eszkoz);
      elemek.push({ nev: e.nev, eszkoz, x: e.x, y: e.y, tipus: e.tipus });
    }
    for (const [a, pa, b, pb] of feladat.topologia.kabelek || []) {
      halozat.kabel(nevek.get(a), pa, nevek.get(b), pb);
    }
    for (const [nev, beall] of Object.entries(feladat.kiindulo || {})) {
      const eszkoz = nevek.get(nev);
      if (eszkoz.tipus === "pc") ipBeallit(eszkoz, beall);
      else if (beall.hostname) eszkoz.hostname = beall.hostname;
    }
    return {
      feladat,
      halozat,
      elemek,
      eszkoz: (nev) => {
        const e = nevek.get(nev);
        if (!e) throw new Error(`Nincs ilyen eszköz a feladatban: ${nev}`);
        return e;
      }
    };
  }

  // src/fo.js
  var VERZIO = true ? "0.2.0" : "fejlesztői";
  var HIBAJELENTO = "https://routerrantotta.hu/otlet.html";
  var ANIM_KESLELTETES = 260;
  var SZABAD = {
    azon: "szabad",
    cim: "Szabad gyakorlás",
    topologia: { meret: { szel: 400, mag: 120 }, eszkozok: [{ nev: "Switch", tipus: "switch", x: 44, y: 34 }], kabelek: [] },
    celok: []
  };
  function elem4(tag, osztaly, szoveg) {
    const e = document.createElement(tag);
    if (osztaly) e.className = osztaly;
    if (szoveg !== void 0) e.textContent = szoveg;
    return e;
  }
  function indit(gyoker, beallitasok = {}) {
    gyoker.classList.add("hsz");
    gyoker.textContent = "";
    let azon = beallitasok.feladat;
    try {
      azon = new URLSearchParams(window.location.search).get("feladat") || azon;
    } catch (e) {
    }
    const feladat = feladatKeres(azon) || SZABAD;
    const ora = new Ora();
    let elozo = performance.now();
    setInterval(() => {
      const most = performance.now();
      ora.lep(most - elozo);
      elozo = most;
    }, 20);
    const f = feladatBetolt(feladat, { ora, kesleltetes: ANIM_KESLELTETES });
    const { halozat } = f;
    const kisKepernyo = elem4("p", "hsz-kiskepernyo", "Tipp: nagyobb képernyőn kényelmesebb a gyakorlás.");
    const felso = elem4("div", feladat.celok.length ? "hsz-felso" : "hsz-felso hsz-felso--egy");
    const munka = elem4("section", "hsz-munka");
    munka.setAttribute("aria-label", "Az eszközök kezelése");
    gyoker.append(kisKepernyo, felso, munka);
    let valasztott = null;
    const topologia = new Topologia(felso, { elemek: f.elemek, halozat, meret: feladat.topologia.meret }, {
      valaszt: (e) => valaszt(e, true)
    });
    if (feladat.celok.length) new FeladatPanel(felso, f);
    const jelzo = elem4("a", "hsz-jelzo", "Hibás a kimenet? Jelezd!");
    jelzo.target = "_blank";
    jelzo.rel = "noopener";
    const jelzoFrissit = (parancs) => {
      const p = new URLSearchParams({ oldal: "szimulator/index.html" });
      if (parancs) p.set("parancs", parancs.slice(0, 200));
      jelzo.href = `${HIBAJELENTO}?${p}`;
    };
    jelzoFrissit("");
    const fulek = elem4("div", "hsz-fulek");
    fulek.setAttribute("role", "tablist");
    fulek.setAttribute("aria-label", "Eszközök");
    const nezetHely = elem4("div", "hsz-nezetek");
    munka.append(fulek, nezetHely);
    const nezetek = /* @__PURE__ */ new Map();
    const frissitMind = () => {
      topologia.frissit();
      for (const n of nezetek.values()) n.cimFrissit();
    };
    for (const { eszkoz, tipus } of f.elemek) {
      const ful = elem4("button", "hsz-ful");
      ful.type = "button";
      ful.setAttribute("role", "tab");
      ful.addEventListener("click", () => valaszt(eszkoz, true));
      fulek.append(ful);
      let n;
      if (tipus === "switch") {
        const doboz = elem4("div", "hsz-nezet");
        const munkamenet = new Munkamenet({ szemelyiseg: ios, eszkoz, ora });
        const terminal = new Terminal(doboz, munkamenet, { parancsUtan: jelzoFrissit });
        munkamenet.figyel(frissitMind);
        nezetHely.append(doboz);
        n = {
          doboz,
          terminal,
          munkamenet,
          mutat: (l) => {
            doboz.hidden = !l;
          },
          cimFrissit: () => {
            terminal.cim(`${eszkoz.hostname} – konzol`);
            ful.textContent = eszkoz.hostname;
          }
        };
      } else {
        const ablak = new PcAblak(nezetHely, { eszkoz, halozat, valtozott: frissitMind });
        n = {
          doboz: ablak.doboz,
          terminal: ablak.terminal,
          munkamenet: ablak.munkamenet,
          mutat: (l) => ablak.mutat(l),
          cimFrissit: () => {
            ful.textContent = eszkoz.hostname;
          }
        };
        ablak.munkamenet.figyel(frissitMind);
      }
      n.ful = ful;
      n.cimFrissit();
      n.mutat(false);
      nezetek.set(eszkoz, n);
    }
    halozat.figyel((e) => {
      if (e.tipus === "naplo" && nezetek.has(e.eszkoz)) nezetek.get(e.eszkoz).terminal.aszinkronSor(e.sor);
    });
    function valaszt(eszkoz, fokusz) {
      valasztott = eszkoz;
      for (const [e, n] of nezetek) {
        n.mutat(e === eszkoz);
        n.ful.setAttribute("aria-selected", String(e === eszkoz));
        n.ful.classList.toggle("hsz-ful--aktiv", e === eszkoz);
      }
      topologia.kijelol(eszkoz);
      if (fokusz) nezetek.get(eszkoz).terminal.fokusz();
    }
    valaszt(f.elemek[0].eszkoz, false);
    const lab = elem4("div", "hsz-lab");
    const verzio = elem4("span", "", `IOS-szerű parancssor · Haloszim v${VERZIO.replace(/\.0$/, "")}`);
    lab.append(verzio, jelzo);
    gyoker.append(lab);
    const elso = nezetek.get(f.elemek[0].eszkoz);
    return {
      feladat: f,
      halozat,
      ora,
      valaszt,
      nezetek,
      get valasztott() {
        return valasztott;
      },
      // Visszafelé kompatibilis mezők (az első eszköz):
      eszkoz: f.elemek[0].eszkoz,
      munkamenet: elso.munkamenet,
      terminal: elso.terminal
    };
  }
  if (typeof window !== "undefined") {
    window.Haloszim = { indit, verzio: VERZIO };
  }
})();
