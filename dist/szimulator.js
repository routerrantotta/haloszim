/* Haloszim v0.1.0 – routerrantotta.hu – minden jog fenntartva. */
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
      accessVlan: 1
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
      portok
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
  function szavakra(sor) {
    const tokenek = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(sor)) !== null) tokenek.push({ szoveg: m[0], kezdet: m.index });
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
      illeszt(e, tokenek, i, sor, kornyezet) {
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
      illeszt(e, tokenek, i, sor, kornyezet) {
        const kezdet = tokenek[i].kezdet;
        const r = tartomanyElemez(sor.slice(kezdet), kezdet, kornyezet.portTipusok || {});
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
        for (const elem2 of parancs.szavak) {
          if (elem2.tovabb) {
            cs.tovabb = elem2.tovabb;
            break;
          }
          if (elem2.szo) {
            let gy = cs.kulcsszavak.find((k) => k.elem.szo.toLowerCase() === elem2.szo.toLowerCase());
            if (!gy) cs.kulcsszavak.push(gy = { elem: elem2, csomopont: ujCsomopont() });
            cs = gy.csomopont;
          } else if (elem2.param) {
            if (!PARAM_TIPUSOK[elem2.param]) throw new Error(`Ismeretlen paramétertípus: ${elem2.param}`);
            let gy = cs.parameterek.find((p) => azonosParam(p.elem, elem2));
            if (!gy) cs.parameterek.push(gy = { elem: elem2, csomopont: ujCsomopont() });
            cs = gy.csomopont;
          } else {
            throw new Error("Hibás parancsleírás: " + JSON.stringify(elem2));
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
  function bejar(fak, mod, tokenek, sor, kornyezet, { megallMaradeknal = false } = {}) {
    let aktMod = mod;
    let cs = fak[aktMod];
    let gyokerKezdet = 0;
    const ertekek = {};
    if (!cs) return { ok: false, hiba: "ervenytelen", oszlop: tokenek[0] ? tokenek[0].kezdet : 0, tokenIndex: 0, mod, ertekek, gyokerKezdet };
    let i = 0;
    while (i < tokenek.length) {
      if (cs.parancs && cs.parancs.nincsMeg) break;
      if (cs.tovabb) {
        aktMod = cs.tovabb;
        cs = fak[aktMod];
        gyokerKezdet = i;
        continue;
      }
      const t = tokenek[i];
      const jeloltek = kulcsszoJeloltek(cs, t.szoveg);
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
        const r = tipus.illeszt(p.elem, tokenek, i, sor, kornyezet);
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
  function illeszt(fak, mod, sor, kornyezet = {}) {
    const tokenek = szavakra(sor);
    const b = bejar(fak, mod, tokenek, sor, kornyezet);
    if (!b.ok) return { ...b, tokenek };
    if (b.cs.tovabb || !b.cs.parancs) {
      return { ok: false, hiba: "hianyos", tokenIndex: tokenek.length, gyokerKezdet: b.gyokerKezdet, mod: b.mod, tokenek };
    }
    return { ok: true, parancs: b.cs.parancs, ertekek: b.ertekek, mod: b.mod, tokenek };
  }
  function sugo(fak, mod, sor, kornyezet = {}) {
    const tokenek = szavakra(sor);
    const reszleges = sor === "" || /\s$/.test(sor) ? "" : tokenek.pop().szoveg;
    const b = bejar(fak, mod, tokenek, sor, kornyezet, { megallMaradeknal: true });
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
      return tartomanySugo(b, tokenek, reszleges, sor, kornyezet);
    }
    let cs = b.cs;
    if (cs.tovabb) cs = fak[cs.tovabb];
    if (tokenek.length > 0 && cs.parancs && cs.parancs.nincsMeg) {
      return { ok: true, fajta: "lista", elemek: [{ nev: "<cr>", sugo: cs.parancs.szavak[0].sugo }], cr: false, gyoker: false };
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
  function tartomanySugo(b, tokenek, reszleges, sor, kornyezet) {
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
    const vizsgalt = reszleges === "" ? sor : sor.slice(0, sor.length - reszleges.length);
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
  function kiegeszit(fak, mod, sor, kornyezet = {}) {
    if (sor === "" || /\s$/.test(sor)) return null;
    const tokenek = szavakra(sor);
    const utolso = tokenek.pop();
    const b = bejar(fak, mod, tokenek, sor, kornyezet, { megallMaradeknal: true });
    if (!b.ok) return null;
    const eleje = sor.slice(0, utolso.kezdet);
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
    tortenetbe(sor) {
      const csoport = this.szemelyiseg.modok[this.mod].tortenet;
      const lista = this.tortenetek[csoport] = this.tortenetek[csoport] || [];
      if (lista[lista.length - 1] !== sor) lista.push(sor);
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
    bevitel(sor) {
      const kimenet = [];
      const ctx = this.ctx(kimenet);
      if (this.varakozas) {
        const { valasz } = this.varakozas;
        this.varakozas = null;
        valasz(sor, ctx);
        this.ertesit();
        return { kimenet, lapozhato: false };
      }
      if (sor.trim() === "") return { kimenet, lapozhato: false };
      this.tortenetbe(sor);
      const kornyezet = this.kornyezet();
      const promptSzoveg = this.prompt();
      let r = illeszt(this.fak, this.mod, sor, kornyezet);
      const visszaesik = this.szemelyiseg.modok[this.mod].visszaesik;
      if (!r.ok && visszaesik) {
        const r2 = illeszt(this.fak, visszaesik, sor, kornyezet);
        if (r2.ok) {
          this.mod = visszaesik;
          this.kontextus = {};
          r = r2;
        } else if (r.hiba === "ervenytelen" && (r2.hiba !== "ervenytelen" || r2.oszlop > r.oszlop)) {
          r = r2;
        }
      }
      if (!r.ok) {
        const info = { sor, prompt: promptSzoveg, mod: this.mod, modAdat: this.szemelyiseg.modok[this.mod] };
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
    sugo(sor) {
      if (this.varakozas) return { kimenet: [], sor };
      const kornyezet = this.kornyezet();
      let r = sugo(this.fak, this.mod, sor, kornyezet);
      const visszaesik = this.szemelyiseg.modok[this.mod].visszaesik;
      if (!r.ok && visszaesik && sor.trim() !== "") {
        const r2 = sugo(this.fak, visszaesik, sor, kornyezet);
        if (r2.ok) r = r2;
      }
      const info = { sor, prompt: this.prompt(), mod: this.mod, modAdat: this.szemelyiseg.modok[this.mod] };
      return { kimenet: this.szemelyiseg.formazSugo(r, info), sor };
    }
    /**
     * Tab-kiegészítés.
     * @returns {string|null} – a kiegészített sor, vagy null
     */
    kiegeszit(sor) {
      if (this.varakozas) return null;
      const kornyezet = this.kornyezet();
      const r = kiegeszit(this.fak, this.mod, sor, kornyezet);
      if (r !== null) return r;
      const visszaesik = this.szemelyiseg.modok[this.mod].visszaesik;
      return visszaesik ? kiegeszit(this.fak, visszaesik, sor, kornyezet) : null;
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
          }
        }
      }
    },
    {
      modok: IF_MODOK,
      szavak: [SZO.no, { szo: "shutdown", sugo: "Az interfész bekapcsolása" }],
      vegrehajt(ctx) {
        for (const nev of ctx.kontextus.portok) portKeres(ctx.eszkoz, nev).leallitva = false;
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
      const allapot = vlan.tamogatott === false ? "act/unsup" : "active";
      const portok = sw.portok.filter((p) => p.accessVlan === szam).map((p) => p.rovid);
      const elso = `${String(szam).padEnd(4)} ${vlan.nev.padEnd(32)} ${allapot.padEnd(9)} `;
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
    const bajt = torzs.reduce((osszeg, sor) => osszeg + sor.length + 1, 0);
    return ["Building configuration...", "", `Current configuration : ${bajt} bytes`, ...torzs, ""];
  }

  // src/gyartok/ios/parancsok/show.js
  var SHOW = { szo: "show", sugo: "Információk megjelenítése az eszközről" };
  var VLAN = { szo: "vlan", sugo: "A VLAN-ok adatai" };
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
    }
  ];

  // src/gyartok/ios/parancsok/meg-nincs.js
  var MEG_NINCS = "(a szimulátorban még nincs meg)";
  var LISTA = {
    felhasznalo: ["connect", "disconnect", "ping", "ssh", "telnet", "terminal", "traceroute"],
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
      "write"
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
    "konfig-if": ["cdp", "channel-group", "description", "duplex", "ip", "spanning-tree", "speed", "switchport"],
    "konfig-if-tartomany": ["cdp", "channel-group", "description", "duplex", "spanning-tree", "speed", "switchport"]
  };
  var megNincsParancsok = Object.entries(LISTA).flatMap(
    ([mod, nevek]) => nevek.map((nev) => ({
      modok: [mod],
      szavak: [{ szo: nev, sugo: MEG_NINCS }],
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
    parancsok: [...alapParancsok, ...vlanParancsok, ...interfeszParancsok, ...showParancsok, ...megNincsParancsok],
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
      for (const [nev, g] of Object.entries(this.gombok)) {
        const lapozoGomb = nev === "tovabb" || nev === "kilep";
        g.hidden = lapoz ? !lapozoGomb : lapozoGomb;
        g.disabled = this.foglalt && !lapoz;
      }
    }
    /**
     * Kimenet kiírása sorban. A { varj: ms } elemeknél vár; lapozható kimenetnél
     * oldalanként megáll (--More--).
     * @param {Array<string|{varj:number}>} elemek
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
      } else if (k === "?") {
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
      if (this.foglalt) return;
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
  var SW = { szel: 520, mag: 96, portSzel: 22, portMag: 17, koz: 4 };
  var Topologia = class {
    /**
     * @param {HTMLElement} szulo
     * @param {{eszkoz: Object, x: number, y: number}[]} eszkozok – az eszközök és a helyük
     * @param {{kattintas?: (eszkoz: Object) => void}} [beallitasok]
     */
    constructor(szulo, eszkozok, beallitasok = {}) {
      this.eszkozok = eszkozok;
      this.beallitasok = beallitasok;
      this.doboz = document.createElement("section");
      this.doboz.className = "hsz-topologia";
      this.doboz.setAttribute("aria-label", "Topológia");
      this.rajz = svg("svg", { viewBox: "0 0 640 190", class: "hsz-topologia__rajz", role: "img" });
      this.rajz.append(svg("title", {}, "A hálózat rajza"));
      this.doboz.append(this.rajz);
      szulo.append(this.doboz);
      this.rajzok = /* @__PURE__ */ new Map();
      for (const e of eszkozok) this.rajzok.set(e.eszkoz, this.switchRajz(e));
      this.frissit();
    }
    /** @private – egy switch kirajzolása */
    switchRajz({ eszkoz, x, y }) {
      const g = svg("g", { class: "hsz-eszkoz", transform: `translate(${x} ${y})`, tabindex: 0, role: "button" });
      g.setAttribute("aria-label", "Switch – kattints, és írj a parancssorba");
      g.append(svg("rect", { x: 0, y: 0, width: SW.szel, height: SW.mag, rx: 10, class: "hsz-eszkoz__haz" }));
      g.append(svg("rect", { x: 8, y: 8, width: SW.szel - 16, height: SW.mag - 16, rx: 6, class: "hsz-eszkoz__elolap" }));
      g.append(svg("circle", { cx: 28, cy: 34, r: 4.5, class: "hsz-led hsz-led--be" }));
      g.append(svg("text", { x: 38, y: 37, class: "hsz-eszkoz__apro" }, "SYS"));
      g.append(svg("circle", { cx: 28, cy: 54, r: 4.5, class: "hsz-led" }));
      g.append(svg("text", { x: 38, y: 57, class: "hsz-eszkoz__apro" }, "MODE"));
      const portElemek = /* @__PURE__ */ new Map();
      const kezdX = 82;
      for (const p of eszkoz.portok) {
        let px, py;
        const sorszam = Number(p.szam.split("/")[1]);
        if (p.tipus === "FastEthernet") {
          const oszlop = Math.floor((sorszam - 1) / 2);
          const csoport = Math.floor(oszlop / 6);
          px = kezdX + oszlop * (SW.portSzel + SW.koz) + csoport * 10;
          py = sorszam % 2 === 1 ? 24 : 24 + SW.portMag + 14;
        } else {
          px = kezdX + 12 * (SW.portSzel + SW.koz) + 2 * 10 + 34 + (sorszam - 1) * (SW.portSzel + 10);
          py = 24 + (SW.portMag + 14) / 2;
        }
        const pg = svg("g", { class: "hsz-port" });
        const cim = svg("title");
        pg.append(cim);
        pg.append(svg("rect", { x: px, y: py, width: SW.portSzel, height: SW.portMag, rx: 2, class: "hsz-port__aljzat" }));
        pg.append(svg("rect", { x: px + 6, y: py + SW.portMag - 6, width: SW.portSzel - 12, height: 4, class: "hsz-port__nyelv" }));
        const led = svg("rect", { x: px + 6, y: py - 6, width: SW.portSzel - 12, height: 3, rx: 1, class: "hsz-led" });
        pg.append(led);
        if (p.tipus === "FastEthernet" && sorszam % 2 === 1) {
          pg.append(svg("text", { x: px + SW.portSzel / 2, y: py - 9, class: "hsz-eszkoz__apro hsz-kozep" }, String(sorszam)));
        } else if (p.tipus === "FastEthernet") {
          pg.append(svg("text", { x: px + SW.portSzel / 2, y: py + SW.portMag + 10, class: "hsz-eszkoz__apro hsz-kozep" }, String(sorszam)));
        } else {
          pg.append(svg("text", { x: px + SW.portSzel / 2, y: py + SW.portMag + 10, class: "hsz-eszkoz__apro hsz-kozep" }, `G${sorszam}`));
        }
        g.append(pg);
        portElemek.set(p.nev, { pg, cim, led });
      }
      const felirat = svg("text", { x: SW.szel / 2, y: SW.mag + 30, class: "hsz-eszkoz__nev hsz-kozep" });
      const tipus = svg("text", { x: SW.szel / 2, y: SW.mag + 50, class: "hsz-eszkoz__tipus hsz-kozep" }, "2960-24 jellegű switch");
      g.append(felirat, tipus);
      const kattint = () => this.beallitasok.kattintas && this.beallitasok.kattintas(eszkoz);
      g.addEventListener("click", kattint);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          kattint();
        }
      });
      this.rajz.append(g);
      return { felirat, portElemek };
    }
    /** Újrarajzolja a változó részeket (gépnév, portállapot). */
    frissit() {
      for (const { eszkoz } of this.eszkozok) {
        const r = this.rajzok.get(eszkoz);
        r.felirat.textContent = eszkoz.hostname;
        for (const p of eszkoz.portok) {
          const pe = r.portElemek.get(p.nev);
          pe.pg.classList.toggle("hsz-port--lekapcsolva", p.leallitva);
          pe.cim.textContent = `${p.nev} – ${p.leallitva ? "lekapcsolva (shutdown)" : "bekapcsolva, de nincs kábel"}`;
        }
      }
    }
  };

  // src/fo.js
  var VERZIO = true ? "0.1.0" : "fejlesztői";
  var HIBAJELENTO = "https://routerrantotta.hu/otlet.html";
  function indit(gyoker) {
    gyoker.classList.add("hsz");
    gyoker.textContent = "";
    const ora = new Ora();
    let elozo = Date.now();
    setInterval(() => {
      const most = Date.now();
      ora.lep(most - elozo);
      elozo = most;
    }, 100);
    const eszkoz = ujSwitch2960();
    const munkamenet = new Munkamenet({ szemelyiseg: ios, eszkoz, ora });
    const kisKepernyo = document.createElement("p");
    kisKepernyo.className = "hsz-kiskepernyo";
    kisKepernyo.textContent = "Tipp: nagyobb képernyőn kényelmesebb a gyakorlás.";
    const racs = document.createElement("div");
    racs.className = "hsz-racs";
    gyoker.append(kisKepernyo, racs);
    let terminal;
    const topologia = new Topologia(racs, [{ eszkoz, x: 60, y: 30 }], {
      kattintas: () => terminal.fokusz()
    });
    const jelzo = document.createElement("a");
    jelzo.className = "hsz-jelzo";
    jelzo.target = "_blank";
    jelzo.rel = "noopener";
    jelzo.textContent = "Hibás a kimenet? Jelezd!";
    const jelzoFrissit = (parancs) => {
      const p = new URLSearchParams({ oldal: "szimulator/index.html" });
      if (parancs) p.set("parancs", parancs.slice(0, 200));
      jelzo.href = `${HIBAJELENTO}?${p}`;
    };
    jelzoFrissit("");
    terminal = new Terminal(racs, munkamenet, { parancsUtan: jelzoFrissit });
    terminal.cim(`${eszkoz.hostname} – konzol`);
    munkamenet.figyel(() => {
      topologia.frissit();
      terminal.cim(`${eszkoz.hostname} – konzol`);
    });
    const lab = document.createElement("div");
    lab.className = "hsz-lab";
    const verzio = document.createElement("span");
    verzio.textContent = `IOS-szerű parancssor · Haloszim v${VERZIO.replace(/\.0$/, "")}`;
    lab.append(verzio, jelzo);
    gyoker.append(lab);
    return { eszkoz, munkamenet, ora, terminal };
  }
  if (typeof window !== "undefined") {
    window.Haloszim = { indit, verzio: VERZIO };
  }
})();
